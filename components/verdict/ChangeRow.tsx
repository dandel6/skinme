import { StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import type { MetricChange } from '../../lib/verdict/computeVerdict';

const signed = (value: number) => `${value > 0 ? '+' : ''}${value}`;

/**
 * 지표 1행: 라벨 · 기준선 → 현재 (변화량). 계측기 톤 - tabular-nums.
 * 표기는 정수 반올림 - 측정 오차 ±5 시스템에서 0.1 단위는 정밀도 과장.
 */
export function ChangeRow({ label, change }: { label: string; change: MetricChange }) {
  return (
    <View style={styles.row}>
      <Text style={styles.label}>{label}</Text>
      <Text style={styles.values}>
        {Math.round(change.baseline)} → {Math.round(change.current)}
        <Text style={styles.delta}> ({signed(Math.round(change.delta))})</Text>
      </Text>
    </View>
  );
}

export function SectionLabel({ text }: { text: string }) {
  return <Text style={styles.section}>{text}</Text>;
}

export function HeldRow({ reason }: { reason: string }) {
  return (
    <Text style={styles.held}>
      {STRINGS.verdictHoldPrefix} - {reason}
    </Text>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  label: {
    color: '#374151',
    fontSize: 14,
  },
  values: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  delta: {
    color: '#6B7280',
    fontWeight: '400',
  },
  section: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 16,
  },
  held: {
    color: '#9CA3AF',
    fontSize: 13,
    paddingVertical: 10,
  },
});
