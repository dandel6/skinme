import { Modal, Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { DEV_STRINGS } from '../../lib/dev/strings';

type Option = { key: string; label: string };

type Props = {
  visible: boolean;
  title: string;
  options: Option[];
  onSelect: (key: string) => void;
  onClose: () => void;
};

/** 개발자 메뉴 하위 선택 시트 (제품/상태 선택) - __DEV__ 전용 */
export function DevPickerSheet({ visible, title, options, onSelect, onClose }: Props) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title}>{title}</Text>
          <ScrollView style={styles.list}>
            {options.map((option) => (
              <Pressable
                key={option.key}
                style={styles.item}
                onPress={() => onSelect(option.key)}
              >
                <Text style={styles.itemText} numberOfLines={1}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.closeItem} onPress={onClose}>
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
    maxHeight: '70%',
  },
  title: {
    color: '#6B7280',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 1,
  },
  list: {
    flexGrow: 0,
  },
  item: {
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
  },
  itemText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
    paddingHorizontal: 12,
  },
  closeItem: {
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
