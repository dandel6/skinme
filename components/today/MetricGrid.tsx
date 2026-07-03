import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { toMirrorBasis } from '../../lib/mirrorText';
import { cardShadow, COLORS } from '../../lib/ui';
import {
  isHeld,
  type ColorMetric,
  type ScoredMetric,
  type SkinAnalysis,
} from '../../lib/analysis/schema';

// detail=true: 점수 + 근거(evidence) 2줄 + 탭 펼침 (Pro).
// detail=false: 점수(숫자)만 (무료). 근거·개선 해석은 Pro 경계.
function ScoredCard({
  label,
  metric,
  detail,
}: {
  label: string;
  metric: ScoredMetric;
  detail: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (!detail) {
    return (
      <View style={styles.card}>
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.cardScore}>{Math.round(metric.score)}</Text>
      </View>
    );
  }
  return (
    <Pressable
      style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
      onPress={() => setExpanded((value) => !value)}
    >
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardScore}>{Math.round(metric.score)}</Text>
      <Text style={styles.cardEvidence} numberOfLines={expanded ? undefined : 2}>
        {toMirrorBasis(metric.evidence)}
      </Text>
    </Pressable>
  );
}

function ColorCard({
  label,
  metric,
  detail,
}: {
  label: string;
  metric: ColorMetric;
  detail: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  if (isHeld(metric)) {
    if (!detail) {
      return (
        <View style={[styles.card, styles.heldCard]}>
          <Text style={styles.cardLabel}>{label}</Text>
          <Text style={styles.heldText}>{STRINGS.heldPrefix}</Text>
        </View>
      );
    }
    return (
      <Pressable
        style={({ pressed }) => [styles.card, styles.heldCard, pressed && styles.cardPressed]}
        onPress={() => setExpanded((value) => !value)}
      >
        <Text style={styles.cardLabel}>{label}</Text>
        <Text style={styles.heldText} numberOfLines={expanded ? undefined : 2}>
          {STRINGS.heldPrefix} - {metric.hold_reason}
        </Text>
      </Pressable>
    );
  }
  return <ScoredCard label={label} metric={metric} detail={detail} />;
}

/** detail=false면 점수만(무료), true면 근거 포함(Pro). */
export function MetricGrid({
  analysis,
  detail = true,
}: {
  analysis: SkinAnalysis;
  detail?: boolean;
}) {
  const { structural, color, oil_moisture } = analysis;
  const lightingImperfect = analysis.capture_quality.lighting !== 'good';
  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>{STRINGS.structuralSection}</Text>
      <View style={styles.grid}>
        <ScoredCard label={STRINGS.metricLabels.pores} metric={structural.pores} detail={detail} />
        <ScoredCard label={STRINGS.metricLabels.texture} metric={structural.texture} detail={detail} />
        <ScoredCard label={STRINGS.metricLabels.blemish} metric={structural.blemish} detail={detail} />
        <ScoredCard label={STRINGS.oilMoistureLabel} metric={oil_moisture} detail={detail} />
      </View>
      {lightingImperfect && <Text style={styles.oilNote}>{STRINGS.oilLightingNote}</Text>}
      <Text style={styles.section}>{STRINGS.colorSection}</Text>
      <View style={styles.grid}>
        <ColorCard label={STRINGS.metricLabels.redness} metric={color.redness} detail={detail} />
        <ColorCard label={STRINGS.metricLabels.tone_evenness} metric={color.tone_evenness} detail={detail} />
        <ColorCard label={STRINGS.metricLabels.pigment} metric={color.pigment} detail={detail} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: 10,
  },
  section: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 8,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  card: {
    width: '48%',
    flexGrow: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    padding: 16,
    gap: 4,
    backgroundColor: COLORS.card,
    ...cardShadow,
  },
  heldCard: {
    backgroundColor: COLORS.cardMuted,
  },
  cardPressed: {
    opacity: 0.85,
  },
  cardLabel: {
    color: '#374151',
    fontSize: 13,
    fontWeight: '600',
  },
  cardScore: {
    color: '#111111',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  cardEvidence: {
    color: '#6B7280',
    fontSize: 12,
    lineHeight: 17,
  },
  heldText: {
    color: '#9CA3AF',
    fontSize: 12,
    lineHeight: 17,
    marginTop: 4,
  },
  oilNote: {
    color: '#9CA3AF',
    fontSize: 11,
    lineHeight: 16,
    marginTop: 2,
  },
});
