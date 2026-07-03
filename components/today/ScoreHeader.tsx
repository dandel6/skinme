import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { colorHeldNote, STRINGS } from '../../constants/strings';
import { isHeld, type SkinAnalysis } from '../../lib/analysis/schema';

// 종합 점수 등장 시 0→N 카운트업 (600ms ease-out)
function useCountUp(target: number): number {
  const [display, setDisplay] = useState(0);
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    anim.setValue(0);
    const listenerId = anim.addListener(({ value }) => setDisplay(Math.round(value)));
    Animated.timing(anim, {
      toValue: target,
      duration: 600,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false, // JS 리스너로 숫자 텍스트 갱신
    }).start();
    return () => {
      anim.removeListener(listenerId);
    };
  }, [target, anim]);
  return display;
}

const BADGE_COLORS = {
  high: { bg: '#DCFCE7', text: '#166534' },
  mid: { bg: '#FEF9C3', text: '#854D0E' },
  low: { bg: '#F3F4F6', text: '#4B5563' },
} as const;

const COLOR_KEYS = ['redness', 'tone_evenness', 'pigment'] as const;

export function ScoreHeader({ analysis }: { analysis: SkinAnalysis }) {
  const confidence = analysis.capture_quality.confidence;
  const badge = BADGE_COLORS[confidence];
  const displayScore = useCountUp(Math.round(analysis.overall.score));
  // 산정 표시는 result JSON의 실제 구조(held 여부)에서 계산 - 모델 basis 텍스트 비의존.
  // basis 원문은 유저 화면에 노출하지 않는다(개발자 메뉴 > 스캔 원본에서만).
  const heldCount = COLOR_KEYS.filter((key) => isHeld(analysis.color[key])).length;
  const includedLabels = [
    STRINGS.metricLabels.blemish,
    STRINGS.metricLabels.texture,
    STRINGS.metricLabels.pores,
    STRINGS.oilMoistureLabel,
    ...COLOR_KEYS.filter((key) => !isHeld(analysis.color[key])).map(
      (key) => STRINGS.metricLabels[key],
    ),
  ];
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{STRINGS.scoreLabel}</Text>
      <Text style={styles.score}>{displayScore}</Text>
      <View style={[styles.badge, { backgroundColor: badge.bg }]}>
        <Text style={[styles.badgeText, { color: badge.text }]}>
          {STRINGS.confidenceLabels[confidence]}
        </Text>
      </View>
      <Text style={styles.basis}>
        {STRINGS.scoreBasisPrefix}
        {includedLabels.join('·')}
      </Text>
      {heldCount > 0 && <Text style={styles.heldNote}>{colorHeldNote}</Text>}
      <Text style={styles.honesty}>{STRINGS.honestyNote}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    gap: 8,
    paddingVertical: 32, // 종합 점수 주변 여백 확대 (72pt 유지)
  },
  label: {
    color: '#6B7280',
    fontSize: 13,
    letterSpacing: 1,
  },
  score: {
    color: '#111111',
    fontSize: 72,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
    lineHeight: 80,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  basis: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 20,
    paddingHorizontal: 16,
  },
  heldNote: {
    color: '#9CA3AF',
    fontSize: 12,
    textAlign: 'center',
  },
  honesty: {
    color: '#9CA3AF',
    fontSize: 11,
    textAlign: 'center',
    paddingHorizontal: 24,
    lineHeight: 16,
    marginTop: 2,
  },
});
