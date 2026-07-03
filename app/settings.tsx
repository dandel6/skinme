import { useEffect, useState } from 'react';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import {
  Alert,
  Linking,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';
import { STRINGS } from '../constants/strings';
import {
  cancelAllNotifications,
  isWeeklySummaryEnabled,
  setWeeklySummaryEnabled,
} from '../lib/notifications';
import { restorePro } from '../lib/purchases/purchases';
import { isProActive, syncCustomerInfo } from '../lib/purchases/usePro';
import { supabase } from '../lib/supabase';
import { track } from '../lib/analytics';
import { COLORS } from '../lib/ui';

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

// TODO: 출시 전 실제 URL/주소로 교체 (placeholder)
const PRIVACY_URL = 'https://example.com/skinme/privacy';
const CONTACT_MAILTO = 'mailto:contact@skinme.example?subject=SkinMe%20%EB%AC%B8%EC%9D%98';

const SUBSCRIPTION_URL =
  Platform.OS === 'android'
    ? 'https://play.google.com/store/account/subscriptions'
    : 'https://apps.apple.com/account/subscriptions';

export default function SettingsScreen() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [weeklyOn, setWeeklyOn] = useState(true);
  const version = Constants.expoConfig?.version ?? '-';

  useEffect(() => {
    isWeeklySummaryEnabled().then(setWeeklyOn);
  }, []);

  const toggleWeekly = (value: boolean) => {
    setWeeklyOn(value); // 낙관적 반영
    setWeeklySummaryEnabled(value);
  };

  // 파괴적 동작 - 설정 최하단(일상 동선 밖, 홈에서 2뎁스), 확인 다이얼로그 필수
  const handleDeleteAll = () => {
    Alert.alert(STRINGS.settingsDeleteAll, STRINGS.deleteAllConfirmMessage, [
      { text: STRINGS.deleteCancel, style: 'cancel' },
      {
        text: STRINGS.deleteAction,
        style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          setMessage(null);
          try {
            // RLS로 본인 행만 삭제됨 (delete는 필터 필수 → 전행 매칭 조건)
            const { error: scanError } = await supabase
              .from('scans')
              .delete()
              .neq('id', ZERO_UUID);
            if (scanError) throw scanError;
            const { error: productError } = await supabase
              .from('products')
              .delete()
              .neq('id', ZERO_UUID);
            if (productError) throw productError;
            // 계측 이벤트도 삭제(프라이버시 F3). id는 bigint identity - 전행 매칭.
            // best-effort: 테이블/정책 미배포여도 기록삭제 흐름을 막지 않는다.
            const { error: analyticsError } = await supabase
              .from('analytics_events')
              .delete()
              .gte('id', 0);
            if (analyticsError) {
              console.log('[settings] analytics delete skipped:', analyticsError.message);
            }
            await cancelAllNotifications(); // 예약 알림(리포트·반환점) 전부 취소
            router.replace('/today'); // 빈 홈으로 복귀
          } catch (caught) {
            console.log('[settings] delete all failed:', caught instanceof Error ? caught.message : String(caught));
            setMessage(STRINGS.deleteAllFailed);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  // 계정·데이터 완전 삭제 (Play 데이터 삭제 요건) - edge function이 데이터+auth 계정 제거.
  const handleDeleteAccount = () => {
    Alert.alert(STRINGS.settingsDeleteAccount, STRINGS.deleteAccountConfirmMessage, [
      { text: STRINGS.deleteCancel, style: 'cancel' },
      {
        text: STRINGS.deleteAction,
        style: 'destructive',
        onPress: async () => {
          if (busy) return;
          setBusy(true);
          setMessage(null);
          try {
            const { error } = await supabase.functions.invoke('delete-account', { body: {} });
            if (error) throw error;
            await cancelAllNotifications();
            await supabase.auth.signOut();
            router.replace('/'); // 게이트가 새 익명 세션으로 초기화
          } catch (caught) {
            console.log('[settings] delete account failed:', caught instanceof Error ? caught.message : String(caught));
            setMessage(STRINGS.deleteAccountFailed);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openUrl = async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.log('[settings] openURL failed:', error instanceof Error ? error.message : String(error));
    }
  };

  const handleRestore = async () => {
    if (busy) return;
    setBusy(true);
    setMessage(null);
    track('restore_attempted');
    const { info, failed } = await restorePro();
    syncCustomerInfo(info);
    setBusy(false);
    if (isProActive()) track('restore_succeeded');
    setMessage(
      isProActive()
        ? STRINGS.paywallRestoreDone
        : failed
          ? STRINGS.paywallRestoreFailed
          : STRINGS.paywallRestoreNone,
    );
  };

  const rows: { label: string; onPress?: () => void; value?: string }[] = [
    { label: STRINGS.settingsManageSubscription, onPress: () => openUrl(SUBSCRIPTION_URL) },
    { label: STRINGS.settingsRestore, onPress: handleRestore },
    { label: STRINGS.settingsPrivacy, onPress: () => openUrl(PRIVACY_URL) },
    { label: STRINGS.settingsContact, onPress: () => openUrl(CONTACT_MAILTO) },
    { label: STRINGS.settingsVersion, value: version },
  ];

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <View style={styles.row}>
        <Text style={styles.rowLabel}>{STRINGS.settingsWeeklySummary}</Text>
        <Switch
          value={weeklyOn}
          onValueChange={toggleWeekly}
          trackColor={{ true: COLORS.accent, false: '#D1D5DB' }}
        />
      </View>
      {rows.map((row) => (
        <Pressable
          key={row.label}
          style={({ pressed }) => [styles.row, pressed && row.onPress && styles.rowPressed]}
          onPress={row.onPress}
          disabled={!row.onPress || busy}
        >
          <Text style={styles.rowLabel}>{row.label}</Text>
          {row.value ? (
            <Text style={styles.rowValue}>{row.value}</Text>
          ) : (
            <Text style={styles.chevron}>›</Text>
          )}
        </Pressable>
      ))}
      {message && <Text style={styles.message}>{message}</Text>}
      {/* 위험 구역 - 여백으로 분리, 스캔 개별 삭제로 오인될 자리 아님(설정엔 다른 삭제 없음) */}
      <Pressable
        style={({ pressed }) => [styles.dangerRow, pressed && styles.rowPressed]}
        onPress={handleDeleteAll}
        disabled={busy}
      >
        <Text style={styles.dangerLabel}>{STRINGS.settingsDeleteAll}</Text>
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.dangerRowTight, pressed && styles.rowPressed]}
        onPress={handleDeleteAccount}
        disabled={busy}
      >
        <Text style={styles.dangerLabel}>{STRINGS.settingsDeleteAccount}</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  rowPressed: {
    backgroundColor: '#F9FAFB',
  },
  rowLabel: {
    color: '#111111',
    fontSize: 15,
  },
  rowValue: {
    color: '#6B7280',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },
  chevron: {
    color: '#9CA3AF',
    fontSize: 18,
  },
  message: {
    color: '#374151',
    fontSize: 13,
    textAlign: 'center',
    paddingVertical: 16,
  },
  dangerRow: {
    marginTop: 40,
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  dangerRowTight: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  dangerLabel: {
    color: '#B91C1C',
    fontSize: 15,
  },
});
