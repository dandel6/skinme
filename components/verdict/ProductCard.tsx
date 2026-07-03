import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import type { ProductRow } from '../../hooks/useProducts';
import { cardShadow, COLORS, hitSlop44 } from '../../lib/ui';
import { DAY_MS } from '../../lib/verdict/computeVerdict';

type CardState = 'waiting' | 'ready' | 'done';

function cardState(product: ProductRow, now: number): CardState {
  if (product.verdict) return 'done';
  return now >= new Date(product.verdict_at).getTime() ? 'ready' : 'waiting';
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}.${pad(d.getMonth() + 1)}.${pad(d.getDate())}`;
}

type Props = {
  product: ProductRow;
  onRunVerdict: (product: ProductRow) => void; // [판정 가능] 탭
  onOpenReport: (product: ProductRow) => void; // [판정 완료] 탭
  onLongPress: (product: ProductRow) => void; // 500ms 길게 누르기 → 수정/삭제 액션 시트
  cycle?: number; // 같은 이름 제품의 n번째 사이클 (2 이상이면 "n차 추적" 뱃지)
};

export function ProductCard({ product, onRunVerdict, onOpenReport, onLongPress, cycle }: Props) {
  const now = Date.now();
  const state = cardState(product, now);
  const daysLeft = Math.max(1, Math.ceil((new Date(product.verdict_at).getTime() - now) / DAY_MS));

  const handlePress = () => {
    if (state === 'ready') onRunVerdict(product);
    else if (state === 'done') onOpenReport(product);
    // waiting은 탭 동작 없음 (길게 누르기는 모든 상태에서 동작)
  };

  return (
    <Pressable
      onPress={handlePress}
      onLongPress={() => onLongPress(product)}
      delayLongPress={500}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.topRow}>
        <Text style={styles.name} numberOfLines={1}>
          {product.name}
        </Text>
        {cycle !== undefined && cycle >= 2 && (
          <View style={styles.cycleBadge}>
            <Text style={styles.cycleBadgeText}>
              {cycle}
              {STRINGS.cycleBadgeSuffix}
            </Text>
          </View>
        )}
        {/* 케밥 → 수정/삭제 액션 시트 (롱프레스와 동일 동작, 병행 유지) */}
        <Pressable
          hitSlop={hitSlop44}
          onPress={() => onLongPress(product)}
          style={({ pressed }) => [styles.kebab, pressed && styles.kebabPressed]}
        >
          <Text style={styles.kebabText}>⋯</Text>
        </Pressable>
        {state === 'waiting' && (
          <View style={[styles.badge, styles.badgeWaiting]}>
            <Text style={styles.badgeWaitingText}>
              {STRINGS.verdictWaitingPrefix} D-{daysLeft}
            </Text>
          </View>
        )}
        {state === 'ready' && (
          <View style={[styles.badge, styles.badgeReady]}>
            <Text style={styles.badgeReadyText}>{STRINGS.verdictReady}</Text>
          </View>
        )}
        {state === 'done' && (
          <View style={[styles.badge, styles.badgeDone]}>
            <Text style={styles.badgeDoneText}>{STRINGS.verdictDone}</Text>
          </View>
        )}
      </View>
      <Text style={styles.dates}>
        {STRINGS.verdictStartedPrefix} {formatDate(product.started_at)} → {formatDate(product.verdict_at)}
      </Text>
      {state === 'waiting' && <Text style={styles.waitingHint}>{STRINGS.verdictWaitingHint}</Text>}
      {state === 'ready' && <Text style={styles.hint}>{STRINGS.verdictReadyHint}</Text>}
      {state === 'done' && product.verdict && (
        <Text
          style={[
            styles.summary,
            product.verdict.outcome === 'improved' && styles.summaryImproved,
            product.verdict.outcome === 'worsened' && styles.summaryWorsened,
          ]}
        >
          {STRINGS.verdictOutcomeLabels[product.verdict.outcome]} (
          {Math.round(product.verdict.structural_delta) > 0 ? '+' : ''}
          {Math.round(product.verdict.structural_delta)})
        </Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    backgroundColor: COLORS.card,
    ...cardShadow,
  },
  kebab: {
    paddingHorizontal: 4,
  },
  kebabPressed: {
    opacity: 0.6,
  },
  kebabText: {
    color: '#6B7280',
    fontSize: 18,
    fontWeight: '700',
  },
  pressed: {
    backgroundColor: '#F9FAFB',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  name: {
    flex: 1,
    color: '#111111',
    fontSize: 16,
    fontWeight: '600',
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  cycleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: COLORS.accent,
  },
  cycleBadgeText: {
    color: COLORS.accent,
    fontSize: 11,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  badgeWaiting: { backgroundColor: '#F3F4F6' },
  badgeWaitingText: { color: '#4B5563', fontSize: 12, fontWeight: '600', fontVariant: ['tabular-nums'] },
  badgeReady: { backgroundColor: '#111111' },
  badgeReadyText: { color: '#ffffff', fontSize: 12, fontWeight: '600' },
  badgeDone: { backgroundColor: '#DBEAFE' },
  badgeDoneText: { color: '#1E40AF', fontSize: 12, fontWeight: '600' },
  dates: {
    color: '#6B7280',
    fontSize: 12,
    fontVariant: ['tabular-nums'],
  },
  hint: {
    color: '#374151',
    fontSize: 13,
  },
  waitingHint: {
    color: '#9CA3AF',
    fontSize: 12,
  },
  summary: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  summaryImproved: {
    color: COLORS.accent, // 개선 상태 - 포인트 컬러 통일
  },
  summaryWorsened: {
    color: COLORS.danger,
  },
});
