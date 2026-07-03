import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { STRINGS } from '../../constants/strings';

type Props = {
  visible: boolean;
  onClose: () => void;
  onSubmit: (name: string) => Promise<boolean>; // 성공 시 true → 닫힘
  note?: string; // 진입점별 안내 (예: 오늘 탭 - 기준선 문구)
  warning?: string; // 동시 추적 경고 등 - 등록은 막지 않는 비차단 안내
  initialName?: string; // 이름 수정 모드: 현재 이름 프리필
  title?: string;
  submitLabel?: string;
};

export function RegisterModal({
  visible,
  onClose,
  onSubmit,
  note,
  warning,
  initialName,
  title,
  submitLabel,
}: Props) {
  const [name, setName] = useState(initialName ?? '');
  const [submitting, setSubmitting] = useState(false);
  const trimmed = name.trim();

  // 열릴 때마다 프리필 재적용 (수정 대상이 바뀌어도 반영)
  useEffect(() => {
    if (visible) setName(initialName ?? '');
  }, [visible, initialName]);

  const handleSubmit = async () => {
    if (!trimmed || submitting) return;
    setSubmitting(true);
    const ok = await onSubmit(trimmed);
    setSubmitting(false);
    if (ok) {
      setName('');
      onClose();
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>{title ?? STRINGS.productRegister}</Text>
          {note && <Text style={styles.note}>{note}</Text>}
          {warning && <Text style={styles.warning}>{warning}</Text>}
          <TextInput
            style={styles.input}
            value={name}
            onChangeText={setName}
            placeholder={STRINGS.productNamePlaceholder}
            placeholderTextColor="#9CA3AF"
            autoFocus
            maxLength={60}
            returnKeyType="done"
            onSubmitEditing={handleSubmit}
          />
          <View style={styles.row}>
            <Pressable
              style={({ pressed }) => [styles.button, styles.cancel, pressed && styles.pressed]}
              onPress={onClose}
              disabled={submitting}
            >
              <Text style={styles.cancelText}>{STRINGS.registerCancel}</Text>
            </Pressable>
            <Pressable
              style={({ pressed }) => [
                styles.button,
                styles.submit,
                (!trimmed || submitting) && styles.disabled,
                pressed && styles.pressed,
              ]}
              onPress={handleSubmit}
              disabled={!trimmed || submitting}
            >
              <Text style={styles.submitText}>{submitLabel ?? STRINGS.registerSubmit}</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'center',
    padding: 24,
  },
  sheet: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 20,
    gap: 16,
  },
  title: {
    color: '#111111',
    fontSize: 17,
    fontWeight: '700',
  },
  note: {
    color: '#6B7280',
    fontSize: 13,
    marginTop: -8,
  },
  warning: {
    color: '#92400E',
    backgroundColor: '#FFFBEB',
    borderColor: '#FDE68A',
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    fontSize: 12,
    lineHeight: 17,
    marginTop: -8,
    overflow: 'hidden',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#111111',
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancel: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  cancelText: {
    color: '#374151',
    fontSize: 15,
    fontWeight: '600',
  },
  submit: {
    backgroundColor: '#111111',
  },
  submitText: {
    color: '#ffffff',
    fontSize: 15,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
