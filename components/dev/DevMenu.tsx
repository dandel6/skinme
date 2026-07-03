import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { DEV_STRINGS } from '../../lib/dev/strings';

type Props = {
  visible: boolean;
  onClose: () => void;
  onReproTest: () => void;
  onSameImageTest: () => void;
  onViewRawScan: () => void;
  onVerdictPreview: () => void;
  onMockPreview: () => void;
  onToggleProBypass: () => void;
  proBypassOn: boolean;
  rawScanAvailable: boolean;
  previewAvailable: boolean; // 등록된 제품 존재 여부
};

/** 히스토리 영역 3초 길게 누르면 진입 - __DEV__ 전용 */
export function DevMenu({
  visible,
  onClose,
  onReproTest,
  onSameImageTest,
  onViewRawScan,
  onVerdictPreview,
  onMockPreview,
  onToggleProBypass,
  proBypassOn,
  rawScanAvailable,
  previewAvailable,
}: Props) {
  const items: { label: string; onPress: () => void; disabled?: boolean }[] = [
    { label: DEV_STRINGS.devReproTest, onPress: onReproTest },
    { label: DEV_STRINGS.devSameImageTest, onPress: onSameImageTest },
    { label: DEV_STRINGS.devViewRawScan, onPress: onViewRawScan, disabled: !rawScanAvailable },
    { label: DEV_STRINGS.devVerdictPreview, onPress: onVerdictPreview, disabled: !previewAvailable },
    { label: DEV_STRINGS.devMockPreview, onPress: onMockPreview },
    {
      label: `${DEV_STRINGS.devProBypassPrefix}: ${proBypassOn ? 'ON' : 'OFF'}`,
      onPress: onToggleProBypass,
    },
  ];
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{DEV_STRINGS.devMenuTitle}</Text>
          {items.map((item) => (
            <Pressable
              key={item.label}
              style={[styles.item, item.disabled && styles.itemDisabled]}
              onPress={item.onPress}
              disabled={item.disabled}
            >
              <Text style={styles.itemText}>{item.label}</Text>
            </Pressable>
          ))}
          <Pressable style={[styles.item, styles.close]} onPress={onClose}>
            <Text style={styles.closeText}>{DEV_STRINGS.devMenuClose}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 32,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 10,
  },
  title: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
    marginBottom: 4,
  },
  item: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  itemDisabled: {
    opacity: 0.4,
  },
  itemText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
  },
  close: {
    borderColor: 'transparent',
  },
  closeText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
