import { StyleSheet, Text, View } from 'react-native';
import {
  metricKeyForPriorityItem,
  splitGuideByIngredients,
  type Ingredient,
} from '../../constants/ingredients';
import { priorityContinuityLine, STRINGS } from '../../constants/strings';
import type { SkinAnalysis } from '../../lib/analysis/schema';
import { metricValue } from '../../lib/trend';
import { cardShadow, COLORS } from '../../lib/ui';

type Props = {
  analysis: SkinAnalysis;
  previousResult?: SkinAnalysis | null; // 직전 스캔 - 우선순위 연속성 표시용
  onIngredientPress?: (ingredient: Ingredient) => void; // 성분 가이드 바텀시트
};

function metricLabelFor(key: ReturnType<typeof metricKeyForPriorityItem>): string | null {
  if (!key) return null;
  if (key === 'overall') return null;
  if (key === 'oil_moisture') return STRINGS.oilMoistureLabel;
  return STRINGS.metricLabels[key];
}

export function PriorityCard({ analysis, previousResult, onIngredientPress }: Props) {
  // 직전 스캔과 같은 우선순위면 지표 점수 변화를 한 줄로
  let continuity: string | null = null;
  if (previousResult && previousResult.one_priority.item === analysis.one_priority.item) {
    const key = metricKeyForPriorityItem(analysis.one_priority.item);
    const label = metricLabelFor(key);
    if (key && label) {
      const prev = metricValue(previousResult, key);
      const curr = metricValue(analysis, key);
      if (prev !== null && curr !== null) {
        continuity = priorityContinuityLine(label, prev, curr);
      }
    }
  }

  // guide 내 성분명만 탭 가능(민트+밑줄) - 정적 사전 매칭, 제품 추천 아님
  const segments = splitGuideByIngredients(analysis.one_priority.guide);

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{STRINGS.priorityTitle}</Text>
      <Text style={styles.item}>{analysis.one_priority.item}</Text>
      {continuity && <Text style={styles.continuity}>{continuity}</Text>}
      <Text style={styles.guide}>
        {segments.map((segment, index) =>
          segment.ingredient && onIngredientPress ? (
            <Text
              key={`${segment.text}-${index}`}
              style={styles.ingredient}
              onPress={() => onIngredientPress(segment.ingredient!)}
            >
              {segment.text}
            </Text>
          ) : (
            <Text key={`${segment.text}-${index}`}>{segment.text}</Text>
          ),
        )}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderColor: '#111111',
    borderRadius: 12,
    padding: 16,
    gap: 8,
    backgroundColor: COLORS.card,
    ...cardShadow,
  },
  title: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  item: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '700',
  },
  continuity: {
    color: '#374151',
    fontSize: 13,
    fontVariant: ['tabular-nums'],
  },
  guide: {
    color: '#374151',
    fontSize: 13,
    lineHeight: 20,
  },
  ingredient: {
    color: COLORS.accent,
    fontWeight: '700',
    textDecorationLine: 'underline',
  },
});
