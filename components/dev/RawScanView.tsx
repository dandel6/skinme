import { useRef } from 'react';
import { Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { DEV_STRINGS } from '../../lib/dev/strings';
import { consumeRawScan } from '../../lib/repro';

/** 최근 스캔 result JSON 원본(basis 원문 포함) 열람 - __DEV__ 전용 */
export function RawScanView() {
  const jsonRef = useRef<string | null | undefined>(undefined);
  if (jsonRef.current === undefined) {
    jsonRef.current = consumeRawScan();
  }
  const json = jsonRef.current;

  if (!json) {
    return (
      <View style={styles.center}>
        <Text style={styles.empty}>{DEV_STRINGS.rawScanEmpty}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content}>
      <Text style={styles.json} selectable>
        {json}
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    padding: 16,
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
  json: {
    color: '#111111',
    fontSize: 12,
    lineHeight: 18,
    // iOS에는 'monospace' 패밀리가 없음 - 플랫폼 분기
    fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }),
  },
});
