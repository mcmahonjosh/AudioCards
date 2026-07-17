import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { getLocaleLabel } from '@/src/services/tts/locales';
import { ttsService } from '@/src/services/tts/TtsService';
import {
  getVoiceQualityBadge,
  getVoicesForExactLocale,
  listLanguagesFromVoices,
  listRegionsForLanguage,
  resolveSelectedVoice,
  resolveVoiceLocale,
  splitLocale,
  VoiceInfo,
  VoiceQualityBadge,
} from '@/src/services/tts/voiceMatcher';

export type VoicePickerSelection = {
  locale: string;
  voiceId: string;
};

interface Props {
  visible: boolean;
  selectedLocale: string;
  selectedVoiceId?: string | null;
  onSelect: (selection: VoicePickerSelection) => void;
  onClose: () => void;
  title?: string;
}

type PickerMode = 'main' | 'language' | 'region';

function QualityBadge({ badge }: { badge: VoiceQualityBadge }) {
  const enhanced = badge === 'Enhanced';
  return (
    <View style={[styles.badge, enhanced ? styles.badgeEnhanced : styles.badgeStandard]}>
      <Text
        style={[
          styles.badgeText,
          enhanced ? styles.badgeTextEnhanced : styles.badgeTextStandard,
        ]}
      >
        {badge}
      </Text>
    </View>
  );
}

function DropdownRow({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.dropdownRow} onPress={onPress}>
      <Text style={styles.dropdownLabel}>{label}</Text>
      <View style={styles.dropdownValueWrap}>
        <Text style={styles.dropdownValue} numberOfLines={1}>
          {value}
        </Text>
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export function VoicePicker({
  visible,
  selectedLocale,
  selectedVoiceId,
  onSelect,
  onClose,
  title,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [voices, setVoices] = useState<VoiceInfo[]>([]);
  const [language, setLanguage] = useState('en');
  const [locale, setLocale] = useState(selectedLocale);
  const [voiceId, setVoiceId] = useState<string | null>(selectedVoiceId ?? null);
  const [sampleText, setSampleText] = useState('');
  const [pickerMode, setPickerMode] = useState<PickerMode>('main');

  useEffect(() => {
    if (!visible) return;

    setLoading(true);
    const split = splitLocale(selectedLocale);
    setLanguage(split.language);
    setLocale(split.locale);
    setVoiceId(selectedVoiceId ?? null);
    setSampleText('');
    setPickerMode('main');

    ttsService.initialize().then(() => {
      const available = ttsService.getVoices();
      setVoices(available);

      const resolved = resolveSelectedVoice(available, selectedLocale, selectedVoiceId);
      if (resolved) {
        const voiceLocale = splitLocale(resolveVoiceLocale(resolved));
        setLanguage(voiceLocale.language);
        setLocale(voiceLocale.locale);
        setVoiceId(resolved.identifier);
      }
      setLoading(false);
    });
  }, [visible, selectedLocale, selectedVoiceId]);

  const languages = useMemo(() => listLanguagesFromVoices(voices), [voices]);
  const regions = useMemo(
    () => listRegionsForLanguage(voices, language),
    [voices, language],
  );
  const localeVoices = useMemo(
    () => getVoicesForExactLocale(voices, locale),
    [voices, locale],
  );

  const languageLabel =
    languages.find((l) => l.code === language)?.label ?? getLocaleLabel(language);
  const regionLabel =
    regions.find((r) => r.locale.toLowerCase() === locale.toLowerCase())?.label ??
    getLocaleLabel(locale);

  const canPreview = sampleText.trim().length > 0;

  const previewVoice = async (nextVoiceId: string | null, nextLocale: string) => {
    const text = sampleText.trim();
    if (!text || !nextVoiceId) return;
    await ttsService.speak(text, nextLocale, {
      voiceOverride: nextVoiceId,
      rate: 1.0,
      volume: 60,
    });
  };

  const handleLanguageSelect = (code: string) => {
    setLanguage(code);
    const nextRegions = listRegionsForLanguage(voices, code);
    const nextLocale = nextRegions[0]?.locale ?? code;
    setLocale(nextLocale);
    const best = resolveSelectedVoice(voices, nextLocale, null);
    setVoiceId(best?.identifier ?? null);
    setPickerMode('main');
  };

  const handleRegionSelect = (nextLocale: string) => {
    setLocale(nextLocale);
    const best = resolveSelectedVoice(voices, nextLocale, null);
    setVoiceId(best?.identifier ?? null);
    setPickerMode('main');
  };

  const handleVoiceSelect = async (nextVoiceId: string) => {
    setVoiceId(nextVoiceId);
    await previewVoice(nextVoiceId, locale);
  };

  const handlePreview = async () => {
    if (!canPreview) return;
    await previewVoice(voiceId, locale);
  };

  const handleDone = () => {
    if (!voiceId) {
      const best = resolveSelectedVoice(voices, locale, null);
      if (!best) {
        onClose();
        return;
      }
      onSelect({ locale, voiceId: best.identifier });
      onClose();
      return;
    }
    onSelect({ locale, voiceId });
    onClose();
  };

  const renderSelectorPane = (
    paneTitle: string,
    items: { key: string; label: string; selected: boolean; onPress: () => void }[],
  ) => (
    <View style={styles.selectorPane}>
      <TouchableOpacity style={styles.backRow} onPress={() => setPickerMode('main')}>
        <Text style={styles.backText}>‹ Back</Text>
      </TouchableOpacity>
      <Text style={styles.selectorTitle}>{paneTitle}</Text>
      <ScrollView
        style={styles.selectorList}
        contentContainerStyle={styles.selectorListContent}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled
      >
        {items.map((item) => (
          <TouchableOpacity
            key={item.key}
            style={[styles.inlineItem, item.selected && styles.inlineItemSelected]}
            onPress={item.onPress}
          >
            <Text style={styles.inlineItemText}>{item.label}</Text>
            {item.selected ? <Text style={styles.check}>✓</Text> : null}
          </TouchableOpacity>
        ))}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>{title ?? 'Select Voice'}</Text>

          {loading ? (
            <ActivityIndicator color={Colors.primary} style={styles.loader} />
          ) : voices.length === 0 ? (
            <Text style={styles.empty}>
              No voices found on this device. Download voices in iOS Settings → Accessibility →
              Spoken Content → Voices.
            </Text>
          ) : pickerMode === 'language' ? (
            renderSelectorPane(
              'Language',
              languages.map((lang) => ({
                key: lang.code,
                label: lang.label,
                selected: lang.code === language,
                onPress: () => handleLanguageSelect(lang.code),
              })),
            )
          ) : pickerMode === 'region' ? (
            renderSelectorPane(
              'Region',
              regions.map((region) => ({
                key: region.locale,
                label: region.label,
                selected: region.locale.toLowerCase() === locale.toLowerCase(),
                onPress: () => handleRegionSelect(region.locale),
              })),
            )
          ) : (
            <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
              <View style={styles.card}>
                <DropdownRow
                  label="Language"
                  value={languageLabel}
                  onPress={() => setPickerMode('language')}
                />
                <View style={styles.rowDivider} />
                <DropdownRow
                  label="Region"
                  value={regionLabel}
                  onPress={() => setPickerMode('region')}
                />
              </View>

              <View style={styles.card}>
                <Text style={styles.fieldLabel}>Sample text</Text>
                <TextInput
                  style={styles.sampleInput}
                  value={sampleText}
                  onChangeText={setSampleText}
                  placeholder="Type text to preview"
                  placeholderTextColor={Colors.textMuted}
                />
                <TouchableOpacity
                  style={[styles.previewBtn, !canPreview && styles.previewBtnDisabled]}
                  onPress={handlePreview}
                  disabled={!canPreview}
                >
                  <Text
                    style={[
                      styles.previewBtnText,
                      !canPreview && styles.previewBtnTextDisabled,
                    ]}
                  >
                    Preview selected voice
                  </Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionHeader}>VOICE</Text>
              {localeVoices.length === 0 ? (
                <Text style={styles.empty}>
                  No voices installed for {getLocaleLabel(locale)}. Download them in iOS Settings →
                  Accessibility → Spoken Content → Voices.
                </Text>
              ) : (
                localeVoices.map((voice) => {
                  const selected = voice.identifier === voiceId;
                  const badge = getVoiceQualityBadge(voice);
                  return (
                    <TouchableOpacity
                      key={voice.identifier}
                      style={[styles.voiceRow, selected && styles.voiceRowSelected]}
                      onPress={() => handleVoiceSelect(voice.identifier)}
                    >
                      <View style={styles.voiceTextWrap}>
                        <Text style={styles.voiceName}>{voice.name}</Text>
                        <QualityBadge badge={badge} />
                      </View>
                      {selected ? <Text style={styles.check}>✓</Text> : null}
                    </TouchableOpacity>
                  );
                })
              )}

              <Text style={styles.footerHint}>
                Want higher quality voices? In iPhone Settings go to Accessibility → Spoken Content
                → Voices and download Enhanced voices for your languages.
              </Text>
            </ScrollView>
          )}

          {pickerMode === 'main' ? (
            <View style={styles.footerActions}>
              <TouchableOpacity style={styles.closeBtn} onPress={onClose}>
                <Text style={styles.closeText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.doneBtn} onPress={handleDone}>
                <Text style={styles.doneText}>Done</Text>
              </TouchableOpacity>
            </View>
          ) : null}
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
    maxHeight: '90%',
    padding: Spacing.lg,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  loader: {
    marginVertical: Spacing.lg,
  },
  empty: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginVertical: Spacing.md,
    lineHeight: 20,
  },
  list: {
    maxHeight: 520,
  },
  card: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: 'hidden',
  },
  dropdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  dropdownLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  dropdownValueWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '60%',
    gap: Spacing.sm,
  },
  dropdownValue: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  chevron: {
    color: Colors.primary,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  rowDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: Spacing.xs,
  },
  selectorPane: {
    maxHeight: 520,
  },
  backRow: {
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  backText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  selectorTitle: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '700',
    marginBottom: Spacing.sm,
  },
  selectorList: {
    maxHeight: 420,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectorListContent: {
    paddingVertical: Spacing.xs,
  },
  inlineItem: {
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  inlineItemSelected: {
    backgroundColor: 'rgba(108, 99, 255, 0.2)',
  },
  inlineItemText: {
    color: Colors.text,
    fontSize: FontSize.md,
    flex: 1,
  },
  fieldLabel: {
    color: Colors.textSecondary,
    fontSize: FontSize.sm,
    marginBottom: Spacing.xs,
  },
  sampleInput: {
    backgroundColor: Colors.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    marginBottom: Spacing.sm,
  },
  previewBtn: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
  },
  previewBtnDisabled: {
    opacity: 0.45,
  },
  previewBtnText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  previewBtnTextDisabled: {
    color: Colors.textMuted,
  },
  sectionHeader: {
    color: Colors.textMuted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
    marginBottom: Spacing.sm,
  },
  voiceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  voiceRowSelected: {
    backgroundColor: 'rgba(0, 212, 170, 0.08)',
  },
  voiceTextWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flex: 1,
  },
  voiceName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '500',
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
    marginLeft: Spacing.sm,
  },
  footerHint: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  footerActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  closeBtn: {
    alignItems: 'center',
    padding: Spacing.md,
    flex: 1,
  },
  closeText: {
    color: Colors.textSecondary,
    fontSize: FontSize.md,
  },
  doneBtn: {
    alignItems: 'center',
    padding: Spacing.md,
    flex: 1,
  },
  doneText: {
    color: Colors.primary,
    fontSize: FontSize.md,
    fontWeight: '700',
  },
});
