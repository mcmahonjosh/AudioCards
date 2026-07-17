import React from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { CURATED_LOCALES, getLocaleLabel } from '@/src/services/tts/locales';

interface Props {
  visible: boolean;
  selected: string;
  onSelect: (locale: string) => void;
  onClose: () => void;
  title?: string;
}

export function LocalePicker({ visible, selected, onSelect, onClose, title }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title ?? 'Select Language'}</Text>
          <ScrollView style={styles.list}>
            {CURATED_LOCALES.map((locale) => (
              <TouchableOpacity
                key={locale.code}
                style={[styles.item, selected === locale.code && styles.selected]}
                onPress={() => {
                  onSelect(locale.code);
                  onClose();
                }}
              >
                <Text style={styles.itemText}>{locale.label}</Text>
                <Text style={styles.code}>{locale.code}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

interface LocaleButtonProps {
  locale: string;
  onPress: () => void;
  label?: string;
  /** Optional voice name shown under the locale label. */
  subtitle?: string;
}

export function LocaleButton({ locale, onPress, label, subtitle }: LocaleButtonProps) {
  return (
    <TouchableOpacity style={styles.localeBtn} onPress={onPress}>
      <Text style={styles.localeBtnLabel}>{label ?? 'Language'}</Text>
      <Text style={styles.localeBtnValue}>{getLocaleLabel(locale)}</Text>
      {subtitle ? <Text style={styles.localeBtnSubtitle}>Voice: {subtitle}</Text> : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
    padding: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.md,
  },
  list: {
    maxHeight: 400,
  },
  item: {
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  selected: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
    paddingHorizontal: Spacing.sm,
  },
  itemText: {
    color: Colors.text,
    fontSize: FontSize.md,
  },
  code: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
  closeBtn: {
    marginTop: Spacing.md,
    alignItems: 'center',
    padding: Spacing.md,
  },
  closeText: {
    color: Colors.primary,
    fontSize: FontSize.md,
  },
  localeBtn: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  localeBtnLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: 4,
  },
  localeBtnValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
  },
  localeBtnSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
});
