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
import { HOW_TO_USE_SECTIONS } from '@/src/content/howToUse';

interface HowToUseModalProps {
  visible: boolean;
  onClose: () => void;
}

export function HowToUseModal({ visible, onClose }: HowToUseModalProps) {
  return (
    <Modal visible={visible} animationType="fade" transparent statusBarTranslucent>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.sheet}>
          <Text style={styles.title}>How to use Audio Cards</Text>
          <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
            {HOW_TO_USE_SECTIONS.map((section) => (
              <View key={section.title} style={styles.section}>
                <Text style={styles.subheading}>{section.title}</Text>
                {section.body.map((line) => (
                  <Text key={line} style={styles.body}>
                    {line}
                  </Text>
                ))}
              </View>
            ))}
          </ScrollView>
          <Button title="Close" onPress={onClose} style={styles.button} />
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
    maxHeight: '90%',
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
    maxHeight: 480,
    marginBottom: Spacing.md,
  },
  section: {
    marginBottom: Spacing.md,
  },
  subheading: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.sm,
  },
  body: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
    lineHeight: 22,
    marginBottom: Spacing.sm,
  },
  button: {
    marginTop: Spacing.sm,
  },
});
