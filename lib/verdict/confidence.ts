import type { Verdict } from './computeVerdict';

export type ConfidenceLevel = 'high' | 'mid' | 'low';

/**
 * 리포트 신뢰도 등급 - 표시 전용. computeVerdict 판정값에는 영향 없음(오직 표시 레이어).
 * 기준선·비교군 스캔 수로 산정:
 *  - high: 양쪽 각 3개 이상
 *  - mid : 양쪽 각 2개 이상
 *  - low : 그 외
 * 기준선이 first_scan_after_start(시작 시점 단일 스캔)면 한 단계 강등.
 */
export function verdictConfidence(verdict: Verdict): ConfidenceLevel {
  const base = verdict.baseline_scan_count;
  const curr = verdict.current_scan_count;
  let rank: number; // 2=high, 1=mid, 0=low
  if (base >= 3 && curr >= 3) rank = 2;
  else if (base >= 2 && curr >= 2) rank = 1;
  else rank = 0;
  if (verdict.baseline_kind === 'first_scan_after_start') rank = Math.max(0, rank - 1);
  return rank === 2 ? 'high' : rank === 1 ? 'mid' : 'low';
}
