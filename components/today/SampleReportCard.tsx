import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { cardShadow, COLORS, pressedStyle } from '../../lib/ui';

// 첫 스캔 유저에게 "14일 뒤의 그림"을 보여주는 축소판 샘플 리포트.
// 정적 예시 데이터(프로덕션 안전 - dev mock 모듈과 무관). SAMPLE 워터마크로 실데이터 오인 방지.
const SAMPLE_ROWS: { label: string; from: number; to: number }[] = [
  { label: STRINGS.metricLabels.blemish, from: 55, to: 65 },
  { label: STRINGS.metricLabels.texture, from: 65, to: 70 },
  { label: STRINGS.metricLabels.pores, from: 60, to: 65 },
];

export function SampleReportCard({ onPress }: { onPress: () => void }) {
  return (
    <Pressable style={pressedStyle(styles.card)} onPress={onPress}>
      <Text style={styles.label}>{STRINGS.sampleReportLabel}</Text>
      <View style={styles.outcomeRow}>
        <Text style={styles.outcome}>{STRINGS.verdictOutcomeLabels.improved}</Text>
        <Text style={styles.delta}>+7</Text>
      </View>
      {SAMPLE_ROWS.map((row) => (
        <View key={row.label} style={styles.row}>
          <Text style={styles.rowLabel}>{row.label}</Text>
          <Text style={styles.rowValue}>
            {row.from} → {row.to}
          </Text>
        </View>
      ))}
      <View style={styles.watermark} pointerEvents="none">
        <Text style={styles.watermarkText}>{STRINGS.sampleWatermark}</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 6,
    backgroundColor: COLORS.card,
    overflow: 'hidden',
    ...cardShadow,
  },
  label: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  outcomeRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
  },
  outcome: {
    color: COLORS.accent,
    fontSize: 24,
    fontWeight: '700',
  },
  delta: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rowLabel: {
    color: '#6B7280',
    fontSize: 13,
  },
  rowValue: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  watermark: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  watermarkText: {
    color: 'rgba(17,17,17,0.08)',
    fontSize: 44,
    fontWeight: '800',
    letterSpacing: 6,
    transform: [{ rotate: '-18deg' }],
  },
});
