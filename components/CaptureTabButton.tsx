import { useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { fetchTodayCount } from '../hooks/useDailyCap';
import { usePro } from '../lib/purchases/usePro';
import { COLORS } from '../lib/ui';

/**
 * 탭바 중앙 촬영 셔터 - 코어 루프(촬영)를 화면 위계 1순위로.
 * 어느 탭에서든 탭 시 촬영. 무료 캡 도달 시 기존 동작 그대로(탭=페이월).
 */
export function CaptureTabButton() {
  const router = useRouter();
  const pathname = usePathname();
  const { isPro } = usePro();
  const [todayCount, setTodayCount] = useState<number | null>(null);

  // 라우트가 바뀔 때마다 캡 상태 갱신 (촬영 완료 복귀 반영)
  useEffect(() => {
    let cancelled = false;
    fetchTodayCount().then((count) => {
      if (!cancelled) setTodayCount(count);
    });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const capped = !isPro && todayCount !== null && todayCount >= 1;

  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
      onPress={() =>
        router.push(
          capped ? { pathname: '/paywall', params: { source: 'cap' } } : '/capture',
        )
      }
      accessibilityRole="button"
    >
      <View style={styles.circle}>
        <Ionicons name="camera" size={28} color="#ffffff" />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  pressed: {
    opacity: 0.8,
  },
  circle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    marginTop: -22, // 탭바 위로 돌출
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000000',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
});
