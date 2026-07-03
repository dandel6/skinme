import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { RegisterModal } from '../components/verdict/RegisterModal';
import { VerdictReportView } from '../components/verdict/VerdictReportView';
import { concurrentTrackingWarning, STRINGS } from '../constants/strings';
import { useProducts } from '../hooks/useProducts';
import { supabase } from '../lib/supabase';
import { verdictSchema, type Verdict } from '../lib/verdict/computeVerdict';

type ReportData = { name: string; verdict: Verdict; startedAt: string; verdictAt: string };

export default function ReportScreen() {
  const router = useRouter();
  const { productId } = useLocalSearchParams<{ productId?: string }>();
  const { register, products } = useProducts();
  const [report, setReport] = useState<ReportData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [registerVisible, setRegisterVisible] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        if (!productId) throw new Error('missing productId');
        const { data, error: dbError } = await supabase
          .from('products')
          .select('name, verdict, started_at, verdict_at')
          .eq('id', productId)
          .single();
        if (dbError) throw dbError;
        const parsed = verdictSchema.safeParse(data.verdict);
        if (!parsed.success) throw new Error('invalid verdict json');
        setReport({
          name: data.name,
          verdict: parsed.data,
          startedAt: data.started_at,
          verdictAt: data.verdict_at,
        });
      } catch (caught) {
        console.log('[report] load failed:', caught instanceof Error ? caught.message : String(caught));
        setError(STRINGS.reportLoadFailed);
      }
    })();
  }, [productId]);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.error}>{error}</Text>
      </View>
    );
  }
  if (!report) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color="#111111" />
      </View>
    );
  }

  return (
    <>
      <VerdictReportView
        name={report.name}
        verdict={report.verdict}
        startedAt={report.startedAt}
        verdictAt={report.verdictAt}
        onRegisterNext={() => setRegisterVisible(true)}
        onExtendTrack={async () => {
          // 같은 이름으로 새 사이클(started_at=now) - 기존 리포트는 이력으로 보존
          const ok = await register(report.name);
          if (ok) router.push('/verdict');
        }}
      />
      <RegisterModal
        visible={registerVisible}
        onClose={() => setRegisterVisible(false)}
        warning={(() => {
          const pending = products.find((p) => p.verdict === null);
          return pending ? concurrentTrackingWarning(pending.name) : undefined;
        })()}
        onSubmit={async (name) => {
          const ok = await register(name);
          if (ok) router.push('/verdict');
          return ok;
        }}
      />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
  },
  error: {
    color: '#B91C1C',
    fontSize: 14,
    textAlign: 'center',
  },
});
