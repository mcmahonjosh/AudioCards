import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Switch } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';

interface StatsSectionCardProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}

export function StatsSectionCard({ title, subtitle, children }: StatsSectionCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

interface StatsRadioRowProps<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

export function StatsRadioRow<T extends string>({
  options,
  value,
  onChange,
}: StatsRadioRowProps<T>) {
  return (
    <View style={styles.radioRow}>
      {options.map((opt) => (
        <TouchableOpacity
          key={opt.value}
          style={[styles.radioPill, value === opt.value && styles.radioPillActive]}
          onPress={() => onChange(opt.value)}
        >
          <Text style={[styles.radioText, value === opt.value && styles.radioTextActive]}>
            {opt.label}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

interface StatsCheckboxProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
}

export function StatsCheckbox({ label, value, onChange }: StatsCheckboxProps) {
  return (
    <View style={styles.checkboxRow}>
      <Switch
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.text}
      />
      <Text style={styles.checkboxLabel}>{label}</Text>
    </View>
  );
}

interface StatsSummaryRowProps {
  lines: string[];
}

export function StatsSummaryRow({ lines }: StatsSummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      {lines.map((line) => (
        <Text key={line} style={styles.summaryText}>
          {line}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.xs,
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  radioRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.sm,
  },
  radioPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  radioPillActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  radioText: {
    color: Colors.textMuted,
    fontSize: 12,
  },
  radioTextActive: {
    color: Colors.text,
    fontWeight: '600',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  checkboxLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
  },
  summaryRow: {
    alignItems: 'center',
    marginTop: Spacing.sm,
    gap: 2,
  },
  summaryText: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    textAlign: 'center',
  },
});
