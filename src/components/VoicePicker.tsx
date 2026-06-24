import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { getLocaleLabel } from '@/src/services/tts/locales';
import { ttsService } from '@/src/services/tts/TtsService';
import {
  buildLocaleVoiceOptions,
  localesMatch,
  LocaleVoiceOption,
} from '@/src/services/tts/voiceMatcher';

interface Props {
  visible: boolean;
  selectedLocale: string;
  onSelect: (locale: string) => void;
  onClose: () => void;
  title?: string;
}

function QualityBadge({ enhanced }: { enhanced: boolean }) {
  return (
    <View style={[styles.badge, enhanced ? styles.badgeEnhanced : styles.badgeStandard]}>
      <Text style={[styles.badgeText, enhanced ? styles.badgeTextEnhanced : styles.badgeTextStandard]}>
        {enhanced ? 'Enhanced' : 'Standard'}
      </Text>
    </View>
  );
}

function LocaleSection({
  title,
  description,
  variant,
  options,
  selectedLocale,
  onSelect,
}: {
  title: string;
  description: string;
  variant: 'enhanced' | 'standard';
  options: LocaleVoiceOption[];
  selectedLocale: string;
  onSelect: (locale: string) => void;
}) {
  if (options.length === 0) return null;
  const isEnhanced = variant === 'enhanced';

  return (
    <View style={styles.section}>
      <Text style={[styles.sectionTitle, isEnhanced && styles.sectionTitleEnhanced]}>
        {title}
      </Text>
      <Text style={styles.sectionDescription}>{description}</Text>
      {options.map(({ locale, voice }) => {
        const selected = localesMatch(locale, selectedLocale);
        return (
          <TouchableOpacity
            key={locale}
            style={[
              styles.item,
              isEnhanced ? styles.itemEnhanced : styles.itemStandard,
              selected && styles.selected,
              selected && isEnhanced && styles.selectedEnhanced,
            ]}
            onPress={() => onSelect(locale)}
          >
            <View style={styles.itemTextWrap}>
              <View style={styles.itemTitleRow}>
                <Text style={styles.itemText}>{getLocaleLabel(locale)}</Text>
                <QualityBadge enhanced={isEnhanced} />
              </View>
              <Text style={styles.subtitle}>Voice: {voice.name}</Text>
            </View>
            {selected ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

export function VoicePicker({
  visible,
  selectedLocale,
  onSelect,
  onClose,
  title,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [enhanced, setEnhanced] = useState<LocaleVoiceOption[]>([]);
  const [standard, setStandard] = useState<LocaleVoiceOption[]>([]);

  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    ttsService.initialize().then(() => {
      const grouped = buildLocaleVoiceOptions(ttsService.getVoices());
      setEnhanced(grouped.enhanced);
      setStandard(grouped.standard);
      setLoading(false);
    });
  }, [visible]);

  const handleSelect = (locale: string) => {
    onSelect(locale);
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title ?? 'Select Language'}</Text>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : enhanced.length === 0 && standard.length === 0 ? (
            <Text style={styles.empty}>
              No voices found on this device. Download voices in iOS Settings → Accessibility → Spoken Content → Voices.
            </Text>
          ) : (
            <ScrollView style={styles.list}>
              <Text style={styles.legend}>
                Enhanced voices are high-quality downloads from iPhone Settings. Standard voices are built-in compact voices.
              </Text>
              {enhanced.length === 0 && standard.length > 0 ? (
                <Text style={styles.noEnhancedHint}>
                  No Enhanced voices detected on this device yet. Download them in Settings → Accessibility → Spoken Content → Voices (look for the Enhanced label).
                </Text>
              ) : null}
              <LocaleSection
                title="Enhanced Voices"
                description="Downloaded from Settings → Accessibility → Spoken Content → Voices"
                variant="enhanced"
                options={enhanced}
                selectedLocale={selectedLocale}
                onSelect={handleSelect}
              />
              {enhanced.length > 0 && standard.length > 0 ? (
                <View style={styles.sectionDivider} />
              ) : null}
              <LocaleSection
                title="Standard Voices"
                description="Built-in compact voices included with iOS"
                variant="standard"
                options={standard}
                selectedLocale={selectedLocale}
                onSelect={handleSelect}
              />
            </ScrollView>
          )}

          <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
            <Text style={styles.closeText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
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
    maxHeight: '80%',
    padding: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  legend: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    lineHeight: 20,
  },
  noEnhancedHint: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    lineHeight: 20,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 8,
  },
  list: {
    maxHeight: 460,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginVertical: Spacing.md,
  },
  section: {
    marginBottom: Spacing.sm,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.md,
  },
  sectionTitle: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  sectionTitleEnhanced: {
    color: Colors.accent,
  },
  sectionDescription: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
  },
  item: {
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.sm,
    marginBottom: Spacing.xs,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  itemEnhanced: {
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
    borderColor: 'rgba(0, 212, 170, 0.35)',
  },
  itemStandard: {
    backgroundColor: Colors.surfaceLight,
    borderColor: Colors.border,
  },
  selected: {
    borderWidth: 2,
  },
  selectedEnhanced: {
    borderColor: Colors.accent,
    backgroundColor: 'rgba(0, 212, 170, 0.15)',
  },
  itemTextWrap: {
    flex: 1,
    paddingRight: Spacing.sm,
  },
  itemTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  itemText: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  badge: {
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  badgeEnhanced: {
    backgroundColor: 'rgba(0, 212, 170, 0.2)',
  },
  badgeStandard: {
    backgroundColor: Colors.border,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.3,
  },
  badgeTextEnhanced: {
    color: Colors.accent,
  },
  badgeTextStandard: {
    color: Colors.textSecondary,
  },
  check: {
    color: Colors.accent,
    fontSize: FontSize.md,
    fontWeight: '700',
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
});
