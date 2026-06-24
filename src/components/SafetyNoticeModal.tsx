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

interface SafetyNoticeModalProps {
  visible: boolean;
  onAcknowledge: () => void;
  /** When true, show Close instead of I understand (Settings re-read). */
  dismissOnly?: boolean;
  onDismiss?: () => void;
}

export function SafetyNoticeModal({
  visible,
  onAcknowledge,
  dismissOnly = false,
  onDismiss,
}: SafetyNoticeModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>Study safely</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            <Text style={styles.body}>
              We hope you enjoy hands-free, audio-first flashcard review with Audio Cards.
              Before you begin, please read this important note.
            </Text>
            <Text style={styles.body}>
              Audio Cards can read cards aloud and accept voice commands, but that does not
              mean it is safe to use while driving or during other activities that require
              your full attention. Distracted driving puts you and others at serious risk.
              According to the National Highway Traffic Safety Administration, distracted
              driving contributes to thousands of injuries and deaths each year.
            </Text>
            <Text style={styles.body}>
              It is not just screens that create danger — any cognitive distraction,
              including studying, can impair your ability to drive safely. Only use Audio
              Cards when you are in an environment where you can give your full
              attention, such as at home or as a passenger.
            </Text>
            <Text style={styles.body}>
              This will improve your learning and help keep you and those around you safe.
            </Text>
          </ScrollView>
          <Button
            title={dismissOnly ? 'Close' : 'I understand'}
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
  scroll: {
    maxHeight: 420,
    marginBottom: Spacing.md,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  button: {
    marginTop: Spacing.sm,
  },
});
