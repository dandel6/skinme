import { useState } from 'react';
import * as Clipboard from 'expo-clipboard';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import type { Ingredient } from '../../constants/ingredients';
import { STRINGS } from '../../constants/strings';
import type { SkinAnalysis } from '../../lib/analysis/schema';
import { metricValue, type TrendMetricKey } from '../../lib/trend';
import { COLORS, pressedStyle } from '../../lib/ui';

type Props = {
  ingredient: Ingredient | null; // null이면 닫힘
  analysis: SkinAnalysis | null; // 현재 지표 점수 연동 문구용
  onClose: () => void;
  onRegister: () => void; // 가이드 → 코어 루프 배선
};

function metricLabelOf(key: TrendMetricKey): string {
  if (key === 'overall') return STRINGS.scoreLabel;
  if (key === 'oil_moisture') return STRINGS.oilMoistureLabel;
  return STRINGS.metricLabels[key];
}

/** 성분 가이드 - 정적 사전 기반 3줄 + 검색어 복사 + 등록 배선. 제품 추천 없음. */
export function IngredientSheet({ ingredient, analysis, onClose, onRegister }: Props) {
  const [copied, setCopied] = useState(false);

  if (!ingredient) return null;

  const score = analysis ? metricValue(analysis, ingredient.relatedMetric) : null;
  const metricLabel = metricLabelOf(ingredient.relatedMetric);
  // 왜 지금 내 피부에: 현재 지표 점수 연동 (보류/없음이면 일반 문구)
  const whyLine =
    score !== null
      ? `지금 ${metricLabel} ${Math.round(score)}점 - ${ingredient.why}`
      : ingredient.why;

  const handleCopy = async () => {
    try {
      await Clipboard.setStringAsync(`${ingredient.name} 세럼`);
      setCopied(true);
    } catch (error) {
      console.log('[ingredient] copy failed:', error instanceof Error ? error.message : String(error));
    }
  };

  const handleClose = () => {
    setCopied(false);
    onClose();
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.name}>{ingredient.name}</Text>

          <Text style={styles.sectionTitle}>{STRINGS.ingredientWhatTitle}</Text>
          <Text style={styles.body}>{ingredient.what}</Text>

          <Text style={styles.sectionTitle}>{STRINGS.ingredientWhyTitle}</Text>
          <Text style={styles.body}>{whyLine}</Text>

          <Text style={styles.sectionTitle}>{STRINGS.ingredientPickTitle}</Text>
          <Text style={styles.body}>{ingredient.pick}</Text>

          <Pressable style={pressedStyle(styles.copyButton)} onPress={handleCopy}>
            <Text style={styles.copyButtonText}>
              {STRINGS.ingredientSearchCopy} - “{ingredient.name} 세럼”
            </Text>
          </Pressable>
          {copied && <Text style={styles.copied}>{STRINGS.copiedToast}</Text>}

          <View style={styles.bridge}>
            <Text style={styles.bridgeText}>{STRINGS.ingredientBridge}</Text>
            <Pressable
              style={pressedStyle(styles.registerButton)}
              onPress={() => {
                handleClose();
                onRegister();
              }}
            >
              <Text style={styles.registerButtonText}>{STRINGS.productRegister}</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: 24,
    paddingBottom: 40,
    gap: 8,
  },
  name: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 4,
  },
  sectionTitle: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 8,
  },
  body: {
    color: '#374151',
    fontSize: 14,
    lineHeight: 21,
  },
  copyButton: {
    marginTop: 16,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  copyButtonText: {
    color: '#111111',
    fontSize: 14,
    fontWeight: '600',
  },
  copied: {
    color: COLORS.accent,
    fontSize: 13,
    textAlign: 'center',
  },
  bridge: {
    marginTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 16,
    gap: 12,
  },
  bridgeText: {
    color: '#6B7280',
    fontSize: 13,
    lineHeight: 20,
  },
  registerButton: {
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  registerButtonText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
});
