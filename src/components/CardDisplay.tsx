import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';

interface Props {
  text: string;
  side: 'front' | 'back';
  locale: string;
  isFlipped: boolean;
}

export function CardDisplay({ text, side, locale, isFlipped }: Props) {
  const showingBack = isFlipped;
  const label = showingBack ? 'Back' : 'Front';
  const displayText = showingBack ? text : text;

  return (
    <View style={[styles.card, showingBack && styles.cardBack]}>
      <View style={styles.header}>
        <Text style={styles.sideLabel}>{label}</Text>
        <Text style={styles.locale}>{locale}</Text>
      </View>
      <Text style={styles.text}>{displayText}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    minHeight: 200,
    borderWidth: 1,
    borderColor: Colors.border,
    justifyContent: 'center',
  },
  cardBack: {
    borderColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sideLabel: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  locale: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  text: {
    color: Colors.text,
    fontSize: FontSize.xl,
    lineHeight: 36,
    textAlign: 'center',
  },
});
