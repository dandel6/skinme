import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import ViewShot from 'react-native-view-shot';
import { shareViewShot } from '../../lib/shareReport';
import { COLORS, pressedStyle } from '../../lib/ui';
import type { Verdict } from '../../lib/verdict/computeVerdict';
import { verdictConfidence } from '../../lib/verdict/confidence';
import { ChangeRow, HeldRow, SectionLabel } from './ChangeRow';
import { ShareableCard } from './ShareableCard';

type Props = {
  name: string;
  verdict: Verdict;
  banner?: string; // 개발자 미리보기 배너 등
  startedAt?: string; // 공유 카드 기간 표시용 (없으면 카드에서 기간 생략)
  verdictAt?: string;
  // 리포트 완료 후 다음 루프 배선 - 콜백이 없으면(미리보기 모드) 섹션 미표시
  onRegisterNext?: () => void; // "다음으로 확인할 제품이 있나요?" → 등록
  onExtendTrack?: () => void; // "이 제품 4주 더 추적하기" → 같은 이름 새 사이클
};

/** 판정 리포트 본문 - report(실제)와 dev 미리보기가 공유. 계측기 톤. */
export function VerdictReportView({
  name,
  verdict,
  banner,
  startedAt,
  verdictAt,
  onRegisterNext,
  onExtendTrack,
}: Props) {
  const shotRef = useRef<ViewShot>(null);
  const [sharing, setSharing] = useState(false);

  // 공유: 오버레이가 그려진 뒤 ViewShot.capture() → 공유 → 오버레이 제거.
  useEffect(() => {
    if (!sharing) return;
    const timer = setTimeout(async () => {
      await shareViewShot(shotRef);
      setSharing(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [sharing]);
  // 정수 반올림 표기 - 측정 오차 ±5 시스템에서 0.1 단위는 정밀도 과장
  const roundedDelta = Math.round(verdict.structural_delta);
  const signedDelta = `${roundedDelta > 0 ? '+' : ''}${roundedDelta}`;
  const confidence = verdictConfidence(verdict);
  const computedDate = new Date(verdict.computed_at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const computedLabel = `${computedDate.getFullYear()}.${pad(computedDate.getMonth() + 1)}.${pad(computedDate.getDate())}`;

  return (
    <View style={styles.root}>
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      {banner && <Text style={styles.banner}>{banner}</Text>}
      <Text style={styles.productName}>{name}</Text>
      <View style={styles.confidenceChip}>
        <Text style={styles.confidenceChipText}>{STRINGS.confidenceLabels[confidence]}</Text>
      </View>
      {confidence === 'low' && (
        <Text style={styles.confidenceLowNote}>{STRINGS.reportConfidenceLowNote}</Text>
      )}
      <Text style={styles.outcomeWrap}>
        <Text
          style={[
            styles.outcome,
            verdict.outcome === 'improved' && styles.outcomeImproved,
            verdict.outcome === 'worsened' && styles.outcomeWorsened,
          ]}
        >
          {STRINGS.verdictOutcomeLabels[verdict.outcome]}
        </Text>
        <Text style={styles.delta}>  {signedDelta}</Text>
      </Text>
      <Text style={styles.evidence}>
        {STRINGS.baselineKindLabels[verdict.baseline_kind]} · {STRINGS.reportBaseline}{' '}
        {verdict.baseline_scan_count}개 · {STRINGS.reportCurrent} {verdict.current_scan_count}개
        스캔
      </Text>

      <SectionLabel text={STRINGS.structuralSection} />
      <ChangeRow label={STRINGS.metricLabels.pores} change={verdict.structural.pores} />
      <ChangeRow label={STRINGS.metricLabels.texture} change={verdict.structural.texture} />
      <ChangeRow label={STRINGS.metricLabels.blemish} change={verdict.structural.blemish} />

      <SectionLabel text={STRINGS.colorSection} />
      {'held' in verdict.color ? (
        <HeldRow reason={verdict.color.hold_reason} />
      ) : (
        <>
          <ChangeRow label={STRINGS.metricLabels.redness} change={verdict.color.redness} />
          <ChangeRow
            label={STRINGS.metricLabels.tone_evenness}
            change={verdict.color.tone_evenness}
          />
          <ChangeRow label={STRINGS.metricLabels.pigment} change={verdict.color.pigment} />
          <Text style={styles.colorCounts}>
            {STRINGS.reportBaseline} {verdict.color.baseline_scan_count}개 ·{' '}
            {STRINGS.reportCurrent} {verdict.color.current_scan_count}개 (조명 양호 스캔)
          </Text>
        </>
      )}

      <Text style={styles.computedAt}>{computedLabel}</Text>

      <Pressable
        style={pressedStyle(styles.shareButton)}
        onPress={() => setSharing(true)}
        disabled={sharing}
      >
        <Text style={styles.shareButtonText}>{STRINGS.shareButton}</Text>
      </Pressable>

      {(onRegisterNext || onExtendTrack) && (
        <View style={styles.nextLoop}>
          {onRegisterNext && (
            <>
              <Text style={styles.nextTitle}>{STRINGS.reportNextTitle}</Text>
              <Pressable style={pressedStyle(styles.nextRegister)} onPress={onRegisterNext}>
                <Text style={styles.nextRegisterText}>{STRINGS.productRegister}</Text>
              </Pressable>
            </>
          )}
          {onExtendTrack && (
            <Pressable style={pressedStyle(styles.extend)} onPress={onExtendTrack}>
              <Text style={styles.extendText}>{STRINGS.reportExtendTrack}</Text>
            </Pressable>
          )}
        </View>
      )}
    </ScrollView>
      {/* 공유 캡처용 - 메인 윈도우 안(Modal 아님)이라야 view-shot이 내용을 담는다 */}
      {sharing && (
        <View style={styles.captureOverlay}>
          <Text style={styles.capturePreviewLabel}>{STRINGS.sharePreviewLabel}</Text>
          <ViewShot ref={shotRef} options={{ format: 'png', quality: 1 }}>
            <ShareableCard
              name={name}
              verdict={verdict}
              startedAt={startedAt}
              verdictAt={verdictAt}
            />
          </ViewShot>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 24,
    paddingBottom: 48,
  },
  captureOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  capturePreviewLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
  banner: {
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 16,
    overflow: 'hidden',
  },
  productName: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  confidenceChip: {
    alignSelf: 'flex-start',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  confidenceChipText: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
  },
  confidenceLowNote: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 6,
  },
  outcomeWrap: {
    marginTop: 8,
  },
  outcome: {
    color: '#111111',
    fontSize: 40,
    fontWeight: '700',
  },
  outcomeImproved: {
    color: COLORS.accent, // 개선 상태 - 포인트 컬러 통일
  },
  outcomeWorsened: {
    color: COLORS.danger,
  },
  delta: {
    color: '#374151',
    fontSize: 20,
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
  evidence: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  colorCounts: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 8,
    fontVariant: ['tabular-nums'],
  },
  computedAt: {
    color: '#9CA3AF',
    fontSize: 12,
    marginTop: 24,
    fontVariant: ['tabular-nums'],
  },
  shareButton: {
    marginTop: 20,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareButtonText: {
    color: '#374151',
    fontSize: 14,
    fontWeight: '600',
  },
  nextLoop: {
    marginTop: 24,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E5E7EB',
    paddingTop: 20,
    gap: 12,
  },
  nextTitle: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
  },
  nextRegister: {
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextRegisterText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  extend: {
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: COLORS.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  extendText: {
    color: COLORS.accent,
    fontSize: 14,
    fontWeight: '600',
  },
});
