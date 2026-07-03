import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { track, type PaywallSource } from '../lib/analytics';
import { STRINGS } from '../constants/strings';
import {
  fetchProPackages,
  purchasePro,
  purchasesAvailable,
  restorePro,
  type PurchasesPackage,
} from '../lib/purchases/purchases';
import { isProActive, PRO_ENTITLEMENT_ID, syncCustomerInfo } from '../lib/purchases/usePro';
import { cardShadow, COLORS, hitSlop44 } from '../lib/ui';

type Packages = { monthly: PurchasesPackage | null; annual: PurchasesPackage | null };

export default function PaywallScreen() {
  const router = useRouter();
  const { source } = useLocalSearchParams<{ source?: string }>();
  const [packages, setPackages] = useState<Packages | 'loading' | 'unavailable'>('loading');
  const [selected, setSelected] = useState<'annual' | 'monthly'>('annual'); // 연간 기본 선택
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    // 진입 경로별 계측 (source 미지정이면 unknown)
    track('paywall_shown', { source: (source as PaywallSource) ?? 'unknown' });
  }, [source]);

  useEffect(() => {
    (async () => {
      if (!purchasesAvailable()) {
        setPackages('unavailable');
        return;
      }
      const result = await fetchProPackages();
      setPackages(result ?? 'unavailable');
    })();
  }, []);

  const selectedPackage =
    typeof packages === 'object'
      ? selected === 'annual'
        ? packages.annual
        : packages.monthly
      : null;

  const handlePurchase = async () => {
    if (busy || !selectedPackage) return;
    setBusy(true);
    setMessage(null);
    track('purchase_started', { plan: selected });
    try {
      const info = await purchasePro(selectedPackage);
      syncCustomerInfo(info);
      if (info?.entitlements.active[PRO_ENTITLEMENT_ID]) {
        track('purchase_completed', { plan: selected });
        router.back();
      }
    } catch (caught) {
      const cancelled = (caught as { userCancelled?: boolean }).userCancelled === true;
      if (cancelled) {
        track('purchase_cancelled', { plan: selected });
      } else {
        console.log('[paywall] purchase failed:', caught instanceof Error ? caught.message : String(caught));
        setMessage(STRINGS.paywallFailed);
      }
    } finally {
      setBusy(false);
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
    if (isProActive()) {
      track('restore_succeeded');
      setMessage(STRINGS.paywallRestoreDone);
      router.back();
    } else {
      setMessage(failed ? STRINGS.paywallRestoreFailed : STRINGS.paywallRestoreNone);
    }
  };

  const planCard = (
    kind: 'annual' | 'monthly',
    pkg: PurchasesPackage | null,
  ) => {
    if (!pkg) return null;
    const active = selected === kind;
    const monthlyEquivalent =
      kind === 'annual' ? Math.round(pkg.product.price / 12).toLocaleString('ko-KR') : null;
    return (
      <Pressable
        key={kind}
        style={({ pressed }) => [styles.plan, active && styles.planActive, pressed && styles.pressed]}
        onPress={() => {
          setSelected(kind);
          track('paywall_plan_selected', { plan: kind });
        }}
      >
        <Text style={styles.planLabel}>
          {kind === 'annual' ? STRINGS.paywallAnnual : STRINGS.paywallMonthly}
        </Text>
        {/* 실청구액을 크게, 월 환산은 병기(작게) */}
        <Text style={styles.planPrice}>{pkg.product.priceString}</Text>
        {monthlyEquivalent && (
          <Text style={styles.planEquivalent}>월 {monthlyEquivalent}원꼴</Text>
        )}
      </Pressable>
    );
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.title}>{STRINGS.paywallTitle}</Text>
      <View style={styles.values}>
        {STRINGS.paywallValues.map((value) => (
          <Text key={value} style={styles.valueRow}>
            · {value}
          </Text>
        ))}
      </View>

      {packages === 'loading' && <ActivityIndicator color="#111111" />}
      {packages === 'unavailable' && (
        <Text style={styles.unavailable}>{STRINGS.paywallUnavailable}</Text>
      )}
      {typeof packages === 'object' && (
        <>
          {!packages.annual && !packages.monthly ? (
            <Text style={styles.unavailable}>{STRINGS.paywallLoadFailed}</Text>
          ) : (
            <View style={styles.plans}>
              {planCard('annual', packages.annual)}
              {planCard('monthly', packages.monthly)}
            </View>
          )}
          <Text style={styles.trialNote}>{STRINGS.paywallTrialNote}</Text>
          <Pressable
            style={({ pressed }) => [
              styles.cta,
              (!selectedPackage || busy) && styles.ctaDisabled,
              pressed && styles.pressed,
            ]}
            onPress={handlePurchase}
            disabled={!selectedPackage || busy}
          >
            <Text style={styles.ctaText}>{STRINGS.paywallCta}</Text>
          </Pressable>
        </>
      )}

      {message && <Text style={styles.message}>{message}</Text>}
      <Pressable
        style={({ pressed }) => [styles.restore, pressed && styles.pressed]}
        hitSlop={hitSlop44}
        onPress={handleRestore}
        disabled={busy}
      >
        <Text style={styles.restoreText}>{STRINGS.paywallRestore}</Text>
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
    padding: 24,
    paddingBottom: 48,
    gap: 20,
  },
  title: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '700',
  },
  values: {
    gap: 6,
  },
  valueRow: {
    color: '#374151',
    fontSize: 15,
    lineHeight: 22,
  },
  plans: {
    flexDirection: 'row',
    gap: 10,
  },
  plan: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 4,
    backgroundColor: COLORS.card,
    ...cardShadow,
  },
  pressed: {
    opacity: 0.7,
  },
  planActive: {
    borderColor: COLORS.accent,
  },
  planLabel: {
    color: '#6B7280',
    fontSize: 13,
    fontWeight: '600',
  },
  planPrice: {
    color: '#111111',
    fontSize: 22,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  planEquivalent: {
    color: '#9CA3AF',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  trialNote: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  cta: {
    height: 54,
    borderRadius: 27,
    backgroundColor: COLORS.accent, // 주요 CTA - 포인트 컬러
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: {
    opacity: 0.4,
  },
  ctaText: {
    color: '#ffffff',
    fontSize: 16,
    fontWeight: '700',
  },
  unavailable: {
    color: '#92400E',
    fontSize: 13,
    lineHeight: 20,
  },
  message: {
    color: '#374151',
    fontSize: 13,
    textAlign: 'center',
  },
  restore: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  restoreText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
