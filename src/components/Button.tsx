import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';

interface Props {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'again' | 'hard' | 'good' | 'easy';
  disabled?: boolean;
  loading?: boolean;
  subtitle?: string;
  style?: object;
  testID?: string;
}

const variantColors: Record<string, { bg: string; text: string }> = {
  primary: { bg: Colors.primary, text: Colors.text },
  secondary: { bg: Colors.surfaceLight, text: Colors.text },
  ghost: { bg: 'transparent', text: Colors.primary },
  again: { bg: Colors.again, text: Colors.text },
  hard: { bg: Colors.hard, text: '#1a1a2e' },
  good: { bg: Colors.good, text: '#1a1a2e' },
  easy: { bg: Colors.easy, text: Colors.text },
};

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  subtitle,
  style,
  testID,
}: Props) {
  const colors = variantColors[variant] ?? variantColors.primary;

  return (
    <TouchableOpacity
      testID={testID}
      style={[
        styles.button,
        { backgroundColor: colors.bg },
        disabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color={colors.text} />
      ) : (
        <>
          <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, { color: colors.text }]}>{subtitle}</Text>
          ) : null}
        </>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    borderRadius: 12,
    alignItems: 'center',
    minHeight: 52,
    justifyContent: 'center',
  },
  title: {
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  subtitle: {
    fontSize: FontSize.sm,
    opacity: 0.8,
    marginTop: 2,
  },
  disabled: {
    opacity: 0.5,
  },
});
