import { useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';
import { consumePreview, type PreviewPayload } from '../../lib/dev/preview';
import { DEV_STRINGS } from '../../lib/dev/strings';
import { VerdictReportView } from '../verdict/VerdictReportView';

/**
 * 판정 미리보기 - __DEV__ 전용. verdict_at 무시, DB 저장 없음.
 * 판정 불가(표본 부족) 상태도 그대로 렌더한다.
 */
export function VerdictPreviewView() {
  const payloadRef = useRef<PreviewPayload | null | undefined>(undefined);
  if (payloadRef.current === undefined) {
    payloadRef.current = consumePreview();
  }
  const payload = payloadRef.current;

  if (!payload) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{DEV_STRINGS.previewEmpty}</Text>
      </View>
    );
  }

  if (payload.kind === 'no_scans') {
    return (
      <View style={styles.center}>
        <Text style={styles.banner}>{DEV_STRINGS.previewBanner}</Text>
        <Text style={styles.productName}>{payload.name}</Text>
        <Text style={styles.noScans}>{STRINGS.verdictNoScans}</Text>
      </View>
    );
  }

  return (
    <VerdictReportView
      name={payload.name}
      verdict={payload.verdict}
      banner={DEV_STRINGS.previewBanner}
    />
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
    padding: 24,
    gap: 12,
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
    overflow: 'hidden',
  },
  productName: {
    color: '#6B7280',
    fontSize: 14,
    fontWeight: '600',
  },
  noScans: {
    color: '#111111',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
  },
  empty: {
    color: '#6B7280',
    fontSize: 15,
  },
});
