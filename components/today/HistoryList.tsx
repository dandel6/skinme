import { StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import type { ScanRow } from '../../hooks/useScans';

function formatDate(iso: string): string {
  const date = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}.${pad(date.getMonth() + 1)}.${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function HistoryList({ scans }: { scans: ScanRow[] }) {
  if (scans.length === 0) return null;
  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>{STRINGS.historyTitle}</Text>
      {scans.map((scan) => (
        <View key={scan.id} style={styles.row}>
          <Text style={styles.date}>{formatDate(scan.created_at)}</Text>
          <Text style={styles.score}>{Math.round(scan.result.overall.score)}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 2,
  },
  section: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 6,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#E5E7EB',
  },
  date: {
    color: '#374151',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  score: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
});
