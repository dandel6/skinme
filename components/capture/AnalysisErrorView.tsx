import { Pressable, StyleSheet, Text, View } from 'react-native';
import { STRINGS } from '../../constants/strings';

type Props = {
  message: string;
  onRetake: () => void;
};

export function AnalysisErrorView({ message, onRetake }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.message}>{message}</Text>
      <Pressable
        style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
        onPress={onRetake}
      >
        <Text style={styles.buttonText}>{STRINGS.retakeButton}</Text>
      </Pressable>
      <Text style={styles.privacy}>{STRINGS.privacyNotice}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0F14',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 24,
  },
  message: {
    color: '#F87171',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 24,
  },
  button: {
    height: 52,
    paddingHorizontal: 40,
    borderRadius: 26,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    opacity: 0.7,
  },
  buttonText: {
    color: '#111111',
    fontSize: 16,
    fontWeight: '700',
  },
  privacy: {
    color: 'rgba(229,231,235,0.55)',
    fontSize: 12,
  },
});
