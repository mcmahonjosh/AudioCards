import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import {
  VOICE_COMMANDS,
  VOICE_INTRO_PARAGRAPHS,
  VOICE_TTS_HINT,
} from '@/src/content/howToUse';

interface VoiceIntroModalProps {
  visible: boolean;
  onAcknowledge: () => void;
  dismissOnly?: boolean;
  onDismiss?: () => void;
}

export function VoiceIntroModal({
  visible,
  onAcknowledge,
  dismissOnly = false,
  onDismiss,
}: VoiceIntroModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Voice & hands-free</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {VOICE_INTRO_PARAGRAPHS.map((paragraph) => (
              <Text key={paragraph} style={styles.body}>
                {paragraph}
              </Text>
            ))}
            <Text style={styles.subheading}>Commands during review</Text>
            {VOICE_COMMANDS.map(({ command, description }) => (
              <Text key={command} style={styles.body}>
                <Text style={styles.command}>{command}</Text>
                {' — '}
                {description}
              </Text>
            ))}
            <Text style={styles.hint}>{VOICE_TTS_HINT}</Text>
          </ScrollView>
          <Button
            title={dismissOnly ? 'Close' : 'Got it'}
            onPress={dismissOnly ? onDismiss : onAcknowledge}
            style={styles.button}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'center',
    padding: Spacing.md,
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  subheading: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  scroll: {
    maxHeight: 420,
    marginBottom: Spacing.md,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  command: {
    color: Colors.text,
    fontWeight: '600',
  },
  hint: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: Spacing.sm,
  },
  button: {
    marginTop: Spacing.sm,
  },
});
