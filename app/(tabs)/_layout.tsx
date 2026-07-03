import { Ionicons } from '@expo/vector-icons';
import { Tabs, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { CaptureTabButton } from '../../components/CaptureTabButton';
import { STRINGS } from '../../constants/strings';
import { COLORS, hitSlop44 } from '../../lib/ui';

export default function TabsLayout() {
  const router = useRouter();
  const settingsButton = () => (
    <Pressable
      onPress={() => router.push('/settings')}
      hitSlop={hitSlop44}
      style={({ pressed }) => [styles.gear, pressed && styles.gearPressed]}
      accessibilityLabel={STRINGS.settingsTitle}
    >
      <Text style={styles.gearText}>⚙</Text>
    </Pressable>
  );
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: COLORS.accent,
        tabBarInactiveTintColor: COLORS.textSecondary,
        headerRight: settingsButton,
        // 중앙 돌출 버튼과의 정렬: 높이·패딩 고정
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabLabel,
      }}
    >
      <Tabs.Screen
        name="today"
        options={{
          title: STRINGS.tabToday,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="scan-outline" size={size} color={color} />
          ),
        }}
      />
      {/* 탭 2개 사이 중앙 셔터 - 더미 라우트, tabBarButton이 촬영으로 라우팅 */}
      <Tabs.Screen
        name="shutter"
        options={{
          title: '',
          tabBarButton: () => <CaptureTabButton />,
        }}
      />
      <Tabs.Screen
        name="verdict"
        options={{
          title: STRINGS.tabVerdict,
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="checkmark-circle-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    height: 62,
    paddingTop: 6,
    paddingBottom: 8,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  gear: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  gearPressed: {
    opacity: 0.7,
  },
  gearText: {
    color: '#374151',
    fontSize: 18,
  },
});
