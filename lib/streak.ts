// 측정 스트릭(연속 측정 일수) 계산 - 순수함수. KST 날짜 경계 고정(서버 캡과 동일 기준).
// 표시 전용이며 판정 로직과 무관. 부정 피드백 없음 - 보상 표시만.

const KST_OFFSET_MS = 9 * 60 * 60 * 1000; // KST=UTC+9, DST 없음
const DAY_MS = 24 * 60 * 60 * 1000;

/** 특정 시각(ms)의 KST 캘린더 날짜 키(YYYY-MM-DD). */
function kstDateKey(ms: number): string {
  return new Date(ms + KST_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * 스캔 생성시각 목록에서 연속 측정 일수를 계산한다.
 * - 오늘(KST) 측정이 있으면 오늘부터 역순으로 연속 일수, includesToday=true
 * - 오늘은 없고 어제 측정이 있으면 어제부터 역순, includesToday=false
 * - 둘 다 없으면 0
 * DST 없는 KST에서 24h 감산은 항상 이전 캘린더 날짜로 대응된다.
 */
export function computeStreak(
  createdAtIsos: string[],
  now: number,
): { days: number; includesToday: boolean } {
  const dateSet = new Set<string>();
  for (const iso of createdAtIsos) {
    const t = new Date(iso).getTime();
    if (!Number.isNaN(t)) dateSet.add(kstDateKey(t));
  }
  if (dateSet.size === 0) return { days: 0, includesToday: false };

  const todayKey = kstDateKey(now);
  const yesterdayKey = kstDateKey(now - DAY_MS);

  let includesToday: boolean;
  let anchor: number;
  if (dateSet.has(todayKey)) {
    includesToday = true;
    anchor = now;
  } else if (dateSet.has(yesterdayKey)) {
    includesToday = false;
    anchor = now - DAY_MS;
  } else {
    return { days: 0, includesToday: false };
  }

  let days = 0;
  let cursor = anchor;
  while (dateSet.has(kstDateKey(cursor))) {
    days += 1;
    cursor -= DAY_MS;
  }
  return { days, includesToday };
}
