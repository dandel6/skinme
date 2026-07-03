import { Modal, Pressable, StyleSheet, Text } from 'react-native';
import { STRINGS } from '../../constants/strings';
import type { ProductRow } from '../../hooks/useProducts';

type Props = {
  product: ProductRow | null; // null이면 닫힘
  onClose: () => void;
  onRename: (product: ProductRow) => void;
  onDelete: (product: ProductRow) => void;
};

/** 제품 카드 길게 누르기(500ms) → 이름 수정 / 삭제 */
export function ProductActionSheet({ product, onClose, onRename, onDelete }: Props) {
  return (
    <Modal visible={product !== null} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={styles.title} numberOfLines={1}>
            {product?.name ?? ''}
          </Text>
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            onPress={() => product && onRename(product)}
          >
            <Text style={styles.itemText}>{STRINGS.renameAction}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            onPress={() => product && onDelete(product)}
          >
            <Text style={[styles.itemText, styles.deleteText]}>{STRINGS.deleteAction}</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.item, styles.close, pressed && styles.pressed]}
            onPress={onClose}
          >
            <Text style={styles.closeText}>{STRINGS.close}</Text>
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
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 4,
  },
  item: {
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  itemText: {
    color: '#111111',
    fontSize: 15,
    fontWeight: '600',
  },
  deleteText: {
    color: '#B91C1C',
  },
  close: {
    borderColor: 'transparent',
  },
  closeText: {
    color: '#6B7280',
    fontSize: 14,
  },
});
