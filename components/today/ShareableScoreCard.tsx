import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { COLORS } from '../../lib/ui';

// 무료 공유용 오늘 점수 카드 - 4:5(인스타). 무료 유저도 보는 종합 점수만.
// 절대 미포함: 사진, 유저 식별자, 상세 지표(Pro), evidence.
function fmt(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${p(d.getMonth() + 1)}.${p(d.getDate())}`;
}

type Props = { score: number; dateIso: string };

export const ShareableScoreCard = forwardRef<View, Props>(function ShareableScoreCard(
  { score, dateIso },
  ref,
) {
  return (
    <View ref={ref} style={styles.card}>
      <Text style={styles.label}>{STRINGS.scoreCardLabel}</Text>
      <Text style={styles.score}>{Math.round(score)}</Text>
      <Text style={styles.date}>{fmt(dateIso)}</Text>
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
  label: {
    color: '#6B7280',
    fontSize: 15,
    fontWeight: '600',
  },
  score: {
    color: '#111111',
    fontSize: 120,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    marginTop: 40,
  },
  date: {
    color: '#9CA3AF',
    fontSize: 14,
    textAlign: 'center',
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
