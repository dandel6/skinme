import { isHeld, type SkinAnalysis } from './analysis/schema';

// W2 게이트 기준: 동일 조건 2회 촬영 지표차 ≤5
export const REPRO_PASS_THRESHOLD = 5;

export type ReproMetricKey =
  | 'pores'
  | 'texture'
  | 'blemish'
  | 'oil_moisture'
  | 'redness'
  | 'tone_evenness'
  | 'pigment';

export type ReproRow = {
  key: ReproMetricKey;
  first: number;
  second: number;
  diff: number;
};

export type ReproComparison = {
  rows: ReproRow[];
  excluded: ReproMetricKey[]; // 한쪽이라도 측정 보류인 색 지표
  maxDiff: number;
  pass: boolean;
};

/** 두 스캔의 지표별 점수 차이. 구조+유수분은 항상, 색은 양쪽 다 점수일 때만. */
export function compareScans(first: SkinAnalysis, second: SkinAnalysis): ReproComparison {
  const rows: ReproRow[] = [];
  const excluded: ReproMetricKey[] = [];
  const push = (key: ReproMetricKey, a: number, b: number) =>
    rows.push({ key, first: a, second: b, diff: Math.abs(a - b) });

  for (const key of ['pores', 'texture', 'blemish'] as const) {
    push(key, first.structural[key].score, second.structural[key].score);
  }
  push('oil_moisture', first.oil_moisture.score, second.oil_moisture.score);
  for (const key of ['redness', 'tone_evenness', 'pigment'] as const) {
    const a = first.color[key];
    const b = second.color[key];
    if (!isHeld(a) && !isHeld(b)) push(key, a.score, b.score);
    else excluded.push(key);
  }

  const maxDiff = Math.max(...rows.map((row) => row.diff));
  return { rows, excluded, maxDiff, pass: maxDiff <= REPRO_PASS_THRESHOLD };
}

// ── 화면 간 전달용 인메모리 스토어 (결과는 화면 표시만 - DB 저장은 정상 스캔 파이프라인이 담당)

let reproPair: { first: SkinAnalysis; second: SkinAnalysis } | null = null;

export function setReproPair(first: SkinAnalysis, second: SkinAnalysis): void {
  reproPair = { first, second };
}

export function consumeReproPair(): { first: SkinAnalysis; second: SkinAnalysis } | null {
  const pair = reproPair;
  reproPair = null;
  return pair;
}

// 개발자 메뉴 "최근 스캔 원본 보기" 전달용
let rawScanJson: string | null = null;

export function setRawScan(value: unknown): void {
  rawScanJson = JSON.stringify(value, null, 2);
}

export function consumeRawScan(): string | null {
  const json = rawScanJson;
  rawScanJson = null;
  return json;
}
