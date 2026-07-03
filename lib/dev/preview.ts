// 판정 미리보기 (개발자 전용 - __DEV__ require 체인에서만 로드).
// verdict_at을 무시하고 현재 시점 기준으로 computeVerdict를 즉시 실행. DB 저장 없음.
import { skinAnalysisSchema } from '../analysis/schema';
import { supabase } from '../supabase';
import {
  computeVerdict,
  DAY_MS,
  type ScanForVerdict,
  type Verdict,
} from '../verdict/computeVerdict';

export type PreviewPayload =
  | { kind: 'verdict'; name: string; verdict: Verdict }
  | { kind: 'no_scans'; name: string };

let payload: PreviewPayload | null = null;

export function setPreview(next: PreviewPayload): void {
  payload = next;
}

export function consumePreview(): PreviewPayload | null {
  const current = payload;
  payload = null;
  return current;
}

/** 실데이터 미리보기: 비교군 앵커를 verdict_at 대신 지금(now)으로. */
export async function runVerdictPreview(product: {
  id: string;
  name: string;
  started_at: string;
}): Promise<PreviewPayload> {
  const nowIso = new Date().toISOString();
  const from = new Date(new Date(product.started_at).getTime() - 7 * DAY_MS).toISOString();
  const { data, error } = await supabase
    .from('scans')
    .select('created_at, lighting_ok, result')
    .gte('created_at', from)
    .lte('created_at', nowIso)
    .order('created_at', { ascending: true });
  if (error) throw error;
  const scans: ScanForVerdict[] = [];
  for (const row of data ?? []) {
    const parsed = skinAnalysisSchema.safeParse(row.result);
    if (parsed.success) {
      scans.push({ created_at: row.created_at, lighting_ok: row.lighting_ok, result: parsed.data });
    }
  }
  const computation = computeVerdict({
    startedAt: product.started_at,
    verdictAt: nowIso,
    scans,
  });
  if (computation.status === 'no_scans') return { kind: 'no_scans', name: product.name };
  return { kind: 'verdict', name: product.name, verdict: computation.verdict };
}

// ── mock 5종: 개선 / 변화 없음 / 악화 / 판정 불가 / 색 보류

export type MockState = 'improved' | 'unchanged' | 'worsened' | 'no_scans' | 'color_held';
export const MOCK_STATES: MockState[] = [
  'improved',
  'unchanged',
  'worsened',
  'no_scans',
  'color_held',
];

function mockChange(baseline: number, delta: number) {
  return { baseline, current: baseline + delta, delta };
}

export function mockPreview(state: MockState): PreviewPayload {
  const name = `MOCK-${state}`;
  if (state === 'no_scans') return { kind: 'no_scans', name };

  const structuralDelta = state === 'improved' ? 8.3 : state === 'worsened' ? -6.7 : 1.2;
  const verdict: Verdict = {
    computed_at: new Date().toISOString(),
    outcome:
      state === 'improved' ? 'improved' : state === 'worsened' ? 'worsened' : 'unchanged',
    structural_delta: structuralDelta,
    baseline_kind: state === 'unchanged' ? 'first_scan_after_start' : 'pre_7d',
    baseline_scan_count: 3,
    current_scan_count: 4,
    structural: {
      pores: mockChange(62, structuralDelta - 1),
      texture: mockChange(70, structuralDelta),
      blemish: mockChange(55, structuralDelta + 1),
    },
    color:
      state === 'color_held'
        ? { held: true, hold_reason: '조명 양호 스캔 부족' }
        : {
            redness: mockChange(66, structuralDelta / 2),
            tone_evenness: mockChange(72, -1.4),
            pigment: mockChange(64, 2.1),
            baseline_scan_count: 2,
            current_scan_count: 3,
          },
  };
  return { kind: 'verdict', name, verdict };
}
