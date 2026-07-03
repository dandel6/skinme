import { Pressable, StyleSheet, View } from 'react-native';

type Props = {
  disabled: boolean;
  onPress: () => void;
};

export function ShutterButton({ disabled, onPress }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.ring,
        disabled && styles.ringDisabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <View style={[styles.core, disabled && styles.coreDisabled]} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  ring: {
    width: 76,
    height: 76,
    borderRadius: 38,
    borderWidth: 4,
    borderColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ringDisabled: {
    borderColor: 'rgba(255,255,255,0.35)',
  },
  pressed: {
    transform: [{ scale: 0.94 }],
  },
  core: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: '#ffffff',
  },
  coreDisabled: {
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
});
