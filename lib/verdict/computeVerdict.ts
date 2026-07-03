import { z } from 'zod';
import { STRINGS } from '../../constants/strings';
import { isHeld, type SkinAnalysis } from '../analysis/schema';

export const DAY_MS = 24 * 60 * 60 * 1000;
const WINDOW_DAYS = 7;
// CLAUDE.md 판정 로직: 구조 지표 평균 변화 +5↑ 개선 / -5↓ 악화 / 사이 변화 없음
const THRESHOLD = 5;

export type ScanForVerdict = {
  created_at: string;
  lighting_ok: boolean;
  result: SkinAnalysis;
};

const metricChangeSchema = z.object({
  baseline: z.number(),
  current: z.number(),
  delta: z.number(),
});

// products.verdict jsonb 스키마 - 렌더 전 검증용
export const verdictSchema = z.object({
  computed_at: z.string(),
  outcome: z.enum(['improved', 'unchanged', 'worsened']),
  structural_delta: z.number(),
  baseline_kind: z.enum(['pre_7d', 'first_scan_after_start']),
  baseline_scan_count: z.number(),
  current_scan_count: z.number(),
  structural: z.object({
    pores: metricChangeSchema,
    texture: metricChangeSchema,
    blemish: metricChangeSchema,
  }),
  color: z.union([
    z.object({
      redness: metricChangeSchema,
      tone_evenness: metricChangeSchema,
      pigment: metricChangeSchema,
      baseline_scan_count: z.number(),
      current_scan_count: z.number(),
    }),
    z.object({ held: z.literal(true), hold_reason: z.string() }),
  ]),
});

export type Verdict = z.infer<typeof verdictSchema>;
export type MetricChange = z.infer<typeof metricChangeSchema>;

export type VerdictComputation =
  | { status: 'ok'; verdict: Verdict }
  | { status: 'no_scans' }; // 비교군 0개 - "판정하려면 최근 스캔이 필요해요"

const STRUCTURAL_KEYS = ['pores', 'texture', 'blemish'] as const;
const COLOR_KEYS = ['redness', 'tone_evenness', 'pigment'] as const;

const round1 = (value: number) => Math.round(value * 10) / 10;
const average = (nums: number[]) => nums.reduce((a, b) => a + b, 0) / nums.length;
const timeOf = (scan: ScanForVerdict) => new Date(scan.created_at).getTime();

function metricChange(baselineScores: number[], currentScores: number[]): MetricChange {
  const baseline = average(baselineScores);
  const current = average(currentScores);
  return { baseline: round1(baseline), current: round1(current), delta: round1(current - baseline) };
}

export function computeVerdict(input: {
  startedAt: string;
  verdictAt: string;
  scans: ScanForVerdict[];
}): VerdictComputation {
  const started = new Date(input.startedAt).getTime();
  const verdictAt = new Date(input.verdictAt).getTime();
  const sorted = [...input.scans].sort((a, b) => timeOf(a) - timeOf(b));

  // 비교군: verdict_at 이전 최근 7일. 0개면 판정 불가.
  const comparison = sorted.filter((scan) => {
    const t = timeOf(scan);
    return t <= verdictAt && t >= verdictAt - WINDOW_DAYS * DAY_MS;
  });
  if (comparison.length === 0) return { status: 'no_scans' };

  // 기준선: started_at 이전 최근 7일. 없으면 시작 이후 첫 스캔으로 폴백.
  let baseline = sorted.filter((scan) => {
    const t = timeOf(scan);
    return t < started && t >= started - WINDOW_DAYS * DAY_MS;
  });
  let baselineKind: Verdict['baseline_kind'] = 'pre_7d';
  if (baseline.length === 0) {
    const firstAfterStart = sorted.find((scan) => timeOf(scan) >= started);
    if (!firstAfterStart) return { status: 'no_scans' };
    baseline = [firstAfterStart];
    baselineKind = 'first_scan_after_start';
  }

  // 구조 지표: 항상 집계
  const structuralEntries = STRUCTURAL_KEYS.map((key) => {
    const change = metricChange(
      baseline.map((scan) => scan.result.structural[key].score),
      comparison.map((scan) => scan.result.structural[key].score),
    );
    return [key, change] as const;
  });
  const structuralDelta = round1(average(structuralEntries.map(([, change]) => change.delta)));
  const outcome: Verdict['outcome'] =
    structuralDelta >= THRESHOLD
      ? 'improved'
      : structuralDelta <= -THRESHOLD
        ? 'worsened'
        : 'unchanged';

  // 색 지표: 양쪽 구간 모두 lighting_ok=true 스캔만 집계. 한쪽이라도 0개면 보류.
  const baselineLit = baseline.filter((scan) => scan.lighting_ok);
  const comparisonLit = comparison.filter((scan) => scan.lighting_ok);
  let color: Verdict['color'];
  if (baselineLit.length === 0 || comparisonLit.length === 0) {
    color = { held: true, hold_reason: STRINGS.colorHoldReasonInsufficient };
  } else {
    const collect = (scans: ScanForVerdict[], key: (typeof COLOR_KEYS)[number]) => {
      const scores: number[] = [];
      for (const scan of scans) {
        const metric = scan.result.color[key];
        if (!isHeld(metric)) scores.push(metric.score);
      }
      return scores;
    };
    const perKey = COLOR_KEYS.map((key) => {
      const baseScores = collect(baselineLit, key);
      const currScores = collect(comparisonLit, key);
      return { key, baseScores, currScores };
    });
    // lighting_ok 스캔은 서버가 점수형을 보장하지만, 방어적으로 빈 표본이면 보류
    if (perKey.some(({ baseScores, currScores }) => baseScores.length === 0 || currScores.length === 0)) {
      color = { held: true, hold_reason: STRINGS.colorHoldReasonInsufficient };
    } else {
      color = {
        redness: metricChange(perKey[0].baseScores, perKey[0].currScores),
        tone_evenness: metricChange(perKey[1].baseScores, perKey[1].currScores),
        pigment: metricChange(perKey[2].baseScores, perKey[2].currScores),
        baseline_scan_count: baselineLit.length,
        current_scan_count: comparisonLit.length,
      };
    }
  }

  return {
    status: 'ok',
    verdict: {
      computed_at: new Date().toISOString(),
      outcome,
      structural_delta: structuralDelta,
      baseline_kind: baselineKind,
      baseline_scan_count: baseline.length,
      current_scan_count: comparison.length,
      structural: {
        pores: structuralEntries[0][1],
        texture: structuralEntries[1][1],
        blemish: structuralEntries[2][1],
      },
      color,
    },
  };
}
