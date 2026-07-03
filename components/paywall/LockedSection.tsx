import { useState, type ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { COLORS } from '../../lib/ui';

type Props = {
  children: ReactNode;
  onPress: () => void; // 탭 → 페이월
  showPanel?: boolean; // 잠금 섹션이 여러 개일 때 패널은 1개만 표시
};

/**
 * 비구독자 잠금 섹션 - 내용이 흐릿하게 비치는 디밍(0.35) 위에
 * 자물쇠 + Pro 뱃지 + 안내 문구. 회색 통짜 가림 금지.
 * 패널은 콘텐츠가 아무리 길어도 첫 화면 높이(뷰포트 70%) 안 중앙에 고정 -
 * 스크롤해야 보이는 위치로 흘러내리지 않는다.
 */
export function LockedSection({ children, onPress, showPanel = true }: Props) {
  const { height: windowHeight } = useWindowDimensions();
  const [contentHeight, setContentHeight] = useState(0);
  const panelZone = Math.min(contentHeight || windowHeight, windowHeight * 0.7);

  return (
    <Pressable onPress={onPress} style={styles.wrap}>
      <View
        style={styles.content}
        pointerEvents="none"
        onLayout={(event) => setContentHeight(event.nativeEvent.layout.height)}
      >
        {children}
      </View>
      {showPanel && (
        <View style={[styles.overlay, { height: panelZone }]} pointerEvents="none">
          <View style={styles.panel}>
            <Ionicons name="lock-closed-outline" size={22} color={COLORS.textPrimary} />
            <View style={styles.badge}>
              <Text style={styles.badgeText}>Pro</Text>
            </View>
            <Text style={styles.label}>{STRINGS.lockedDetail}</Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'relative',
  },
  content: {
    opacity: 0.35, // 내용이 비치게 - 무엇이 잠겼는지 보여준다
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  panel: {
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 16,
    paddingHorizontal: 24,
    paddingVertical: 16,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: COLORS.accent,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1,
  },
  label: {
    color: COLORS.textPrimary,
    fontSize: 14,
    fontWeight: '600',
  },
});
