import type { PressableStateCallbackType, StyleProp, ViewStyle } from 'react-native';

/** 눌림 피드백 통일 - 투명도 0.7 ("죽은 버튼" 느낌 제거) */
export function pressedStyle(
  base: StyleProp<ViewStyle>,
): (state: PressableStateCallbackType) => StyleProp<ViewStyle> {
  return ({ pressed }) => [base, pressed && { opacity: 0.7 }];
}

/** 카드 미세 그림자 (elevation 1~2, 계측기 톤 유지) */
export const cardShadow = {
  elevation: 2,
  shadowColor: '#000000',
  shadowOpacity: 0.05,
  shadowRadius: 6,
  shadowOffset: { width: 0, height: 2 },
} as const;

/** 작은 컨트롤의 최소 44×44 터치 타깃 보정 */
export const hitSlop44 = { top: 10, bottom: 10, left: 10, right: 10 } as const;

/**
 * 밝은 계측기 테마 - 화이트 베이스 + 카드 위계 + 세이지 민트 포인트 1색.
 * accent는 활성 탭·주요 CTA·개선 상태에만 사용(#4ADE80 가족).
 * AnalyzingView는 예외적으로 다크 유지 - "측정 순간"의 명암 리듬 연출.
 */
export const COLORS = {
  background: '#FFFFFF',
  card: '#F8F9FA',
  cardMuted: '#F3F4F6',
  accent: '#10B981', // CTA·활성 탭 (흰 텍스트 대비 확보용 진한 변형)
  accentBright: '#4ADE80', // 가이드 타원·체크·스캔 라인 등 밝은 변형
  textPrimary: '#111111',
  textSecondary: '#6B7280',
  danger: '#B91C1C',
} as const;
