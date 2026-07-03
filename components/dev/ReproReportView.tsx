import { useRef } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { DEV_STRINGS } from '../../lib/dev/strings';
import {
  compareScans,
  consumeReproPair,
  REPRO_PASS_THRESHOLD,
  type ReproComparison,
  type ReproMetricKey,
} from '../../lib/repro';

function labelFor(key: ReproMetricKey): string {
  return key === 'oil_moisture' ? STRINGS.oilMoistureLabel : STRINGS.metricLabels[key];
}

/** 재현성 테스트 결과 - __DEV__ 전용, 화면 표시만(DB 저장 없음) */
export function ReproReportView() {
  // consume은 1회성 - 리렌더에도 유지되도록 ref에 고정
  const comparisonRef = useRef<ReproComparison | null | undefined>(undefined);
  if (comparisonRef.current === undefined) {
    const pair = consumeReproPair();
    comparisonRef.current = pair ? compareScans(pair.first, pair.second) : null;
  }
  const comparison = comparisonRef.current;

  if (!comparison) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{DEV_STRINGS.reproEmpty}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={[styles.result, comparison.pass ? styles.pass : styles.fail]}>
        {comparison.pass ? DEV_STRINGS.reproPass : DEV_STRINGS.reproFail}
      </Text>
      <Text style={styles.maxDiff}>
        {DEV_STRINGS.reproMaxDiffLabel} {Math.round(comparison.maxDiff)} (기준 ≤
        {REPRO_PASS_THRESHOLD})
      </Text>

      <View style={styles.headerRow}>
        <Text style={styles.headerCellName}> </Text>
        <Text style={styles.headerCell}>{DEV_STRINGS.reproShot1}</Text>
        <Text style={styles.headerCell}>{DEV_STRINGS.reproShot2}</Text>
        <Text style={styles.headerCell}>{DEV_STRINGS.reproDiffLabel}</Text>
      </View>
      {comparison.rows.map((row) => {
        const over = row.diff > REPRO_PASS_THRESHOLD;
        return (
          <View key={row.key} style={[styles.row, over && styles.rowOver]}>
            <Text style={[styles.cellName, over && styles.overText]}>{labelFor(row.key)}</Text>
            <Text style={styles.cell}>{Math.round(row.first)}</Text>
            <Text style={styles.cell}>{Math.round(row.second)}</Text>
            <Text style={[styles.cell, over && styles.overText]}>{Math.round(row.diff)}</Text>
          </View>
        );
      })}
      {comparison.excluded.length > 0 && (
        <Text style={styles.excluded}>
          {comparison.excluded.map(labelFor).join('·')} - {DEV_STRINGS.reproExcludedNote}
        </Text>
      )}
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
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  empty: {
    color: '#6B7280',
    fontSize: 15,
  },
  result: {
    fontSize: 44,
    fontWeight: '700',
    letterSpacing: 2,
  },
  pass: {
    color: '#111111',
  },
  fail: {
    color: '#B91C1C',
  },
  maxDiff: {
    color: '#6B7280',
    fontSize: 14,
    marginTop: 4,
    marginBottom: 20,
    fontVariant: ['tabular-nums'],
  },
  headerRow: {
    flexDirection: 'row',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#111111',
  },
  headerCellName: {
    flex: 1.4,
  },
  headerCell: {
    flex: 1,
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  row: {
    flexDirection: 'row',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
    alignItems: 'center',
  },
  rowOver: {
    backgroundColor: '#FEF2F2',
  },
  cellName: {
    flex: 1.4,
    color: '#374151',
    fontSize: 14,
  },
  cell: {
    flex: 1,
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  overText: {
    color: '#B91C1C',
  },
  excluded: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 12,
  },
});
