import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { COLORS } from '../../lib/ui';
import type { MetricChange, Verdict } from '../../lib/verdict/computeVerdict';

// 공유용 카드 - 4:5(인스타 피드). 포함: 제품명·기간·판정·구조 지표 3종.
// 절대 미포함: 사진, 유저 식별자, evidence 원문(모델 텍스트).
function fmt(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

type Props = {
  name: string;
  verdict: Verdict;
  startedAt?: string;
  verdictAt?: string;
};

export const ShareableCard = forwardRef<View, Props>(function ShareableCard(
  { name, verdict, startedAt, verdictAt },
  ref,
) {
  const rd = Math.round(verdict.structural_delta);
  const signed = `${rd > 0 ? '+' : ''}${rd}`;
  const rows: [string, MetricChange][] = [
    [STRINGS.metricLabels.pores, verdict.structural.pores],
    [STRINGS.metricLabels.texture, verdict.structural.texture],
    [STRINGS.metricLabels.blemish, verdict.structural.blemish],
  ];
  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.name}>{name}</Text>
      <Text
        style={[
          styles.outcome,
          verdict.outcome === 'improved' && { color: COLORS.accent },
          verdict.outcome === 'worsened' && { color: COLORS.danger },
        ]}
      >
        {STRINGS.verdictOutcomeLabels[verdict.outcome]} {signed}
      </Text>
      {startedAt && verdictAt && (
        <Text style={styles.period}>
          {fmt(startedAt)} → {fmt(verdictAt)}
        </Text>
      )}
      <View style={styles.metrics}>
        {rows.map(([label, change]) => (
          <View key={label} style={styles.metricRow}>
            <Text style={styles.metricLabel}>{label}</Text>
            <Text style={styles.metricVal}>
              {Math.round(change.baseline)} → {Math.round(change.current)}
            </Text>
          </View>
        ))}
      </View>
      <View style={styles.footer}>
        <Text style={styles.brand}>SkinMe</Text>
        <Text style={styles.copy}>{STRINGS.shareCardCopy}</Text>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    width: 320,
    height: 400, // 4:5
    backgroundColor: '#ffffff',
    padding: 28,
    justifyContent: 'space-between',
  },
  name: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  outcome: {
    color: '#111111',
    fontSize: 44,
    fontWeight: '700',
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  period: {
    color: '#9CA3AF',
    fontSize: 13,
    marginTop: 4,
    fontVariant: ['tabular-nums'],
  },
  metrics: {
    gap: 12,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  metricLabel: {
    color: '#374151',
    fontSize: 16,
  },
  metricVal: {
    color: '#111111',
    fontSize: 18,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  footer: {
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    paddingTop: 14,
  },
  brand: {
    color: COLORS.accent,
    fontSize: 16,
    fontWeight: '700',
  },
  copy: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 2,
  },
});
