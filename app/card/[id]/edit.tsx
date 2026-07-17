import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  ScrollView,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import { LocaleButton } from '@/src/components/LocalePicker';
import { VoicePicker } from '@/src/components/VoicePicker';
import { CardContentRenderer } from '@/src/components/card/CardContentRenderer';
import { getCardById, updateCard, deleteCard } from '@/src/db/repositories';
import { ttsService } from '@/src/services/tts/TtsService';
import { findVoiceById } from '@/src/services/tts/voiceMatcher';
import { useAppContext } from '@/src/context/AppContext';

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useAppContext();
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [frontLocale, setFrontLocale] = useState('en-US');
  const [backLocale, setBackLocale] = useState('es-MX');
  const [frontVoiceId, setFrontVoiceId] = useState<string | null>(null);
  const [backVoiceId, setBackVoiceId] = useState<string | null>(null);
  const [frontVoiceName, setFrontVoiceName] = useState('');
  const [backVoiceName, setBackVoiceName] = useState('');
  const [contentFormat, setContentFormat] = useState<'plain' | 'html'>('plain');
  const [picker, setPicker] = useState<'front' | 'back' | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      getCardById(id).then((card) => {
        if (card) {
          setFrontText(card.frontText);
          setBackText(card.backText);
          setFrontLocale(card.frontLocale);
          setBackLocale(card.backLocale);
          setFrontVoiceId(card.frontVoiceId);
          setBackVoiceId(card.backVoiceId);
          setContentFormat(card.contentFormat);
        }
      });
    }
  }, [id]);

  useEffect(() => {
    ttsService.initialize().then(() => {
      const voices = ttsService.getVoices();
      setFrontVoiceName(findVoiceById(voices, frontVoiceId)?.name ?? '');
      setBackVoiceName(findVoiceById(voices, backVoiceId)?.name ?? '');
    });
  }, [frontVoiceId, backVoiceId]);

  const previewFront = () =>
    ttsService.speak(frontText || 'Preview', frontLocale, {
      rate: settings.speechRate,
      volume: settings.speechVolume,
      voiceOverride: frontVoiceId ?? undefined,
    });
  const previewBack = () =>
    ttsService.speak(backText || 'Preview', backLocale, {
      rate: settings.speechRate,
      volume: settings.speechVolume,
      voiceOverride: backVoiceId ?? undefined,
    });

  const handleSave = async () => {
    if (!id || !frontText.trim() || !backText.trim()) {
      Alert.alert('Error', 'Front and back text are required');
      return;
    }
    setLoading(true);
    try {
      await updateCard(id, {
        frontText: frontText.trim(),
        backText: backText.trim(),
        frontLocale,
        backLocale,
        frontVoiceId,
        backVoiceId,
        contentFormat,
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to update card');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Delete Card', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          if (id) {
            await deleteCard(id);
            router.back();
          }
        },
      },
    ]);
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Front</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={frontText}
        onChangeText={setFrontText}
        multiline
        textAlignVertical="top"
        placeholderTextColor={Colors.textMuted}
      />
      {frontText.trim().length > 0 && (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Preview</Text>
          <CardContentRenderer
            text={frontText}
            contentFormat={contentFormat}
            maxHeight={160}
          />
        </View>
      )}
      <LocaleButton
        locale={frontLocale}
        label="Front Voice"
        subtitle={frontVoiceName || undefined}
        onPress={() => setPicker('front')}
      />
      <Button title="Preview Front Audio" variant="secondary" onPress={previewFront} style={styles.previewBtn} />

      <Text style={styles.label}>Back</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={backText}
        onChangeText={setBackText}
        multiline
        textAlignVertical="top"
        placeholderTextColor={Colors.textMuted}
      />
      {backText.trim().length > 0 && (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Preview</Text>
          <CardContentRenderer
            text={backText}
            contentFormat={contentFormat}
            maxHeight={160}
          />
        </View>
      )}
      <LocaleButton
        locale={backLocale}
        label="Back Voice"
        subtitle={backVoiceName || undefined}
        onPress={() => setPicker('back')}
      />
      <Button title="Preview Back Audio" variant="secondary" onPress={previewBack} style={styles.previewBtn} />

      <Button title="Save Changes" onPress={handleSave} loading={loading} style={styles.saveBtn} />
      <Button title="Delete Card" variant="again" onPress={handleDelete} />

      <VoicePicker
        visible={picker === 'front'}
        selectedLocale={frontLocale}
        selectedVoiceId={frontVoiceId}
        onSelect={({ locale, voiceId }) => {
          setFrontLocale(locale);
          setFrontVoiceId(voiceId);
        }}
        onClose={() => setPicker(null)}
        title="Front Voice"
      />
      <VoicePicker
        visible={picker === 'back'}
        selectedLocale={backLocale}
        selectedVoiceId={backVoiceId}
        onSelect={({ locale, voiceId }) => {
          setBackLocale(locale);
          setBackVoiceId(voiceId);
        }}
        onClose={() => setPicker(null)}
        title="Back Voice"
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  label: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600', marginBottom: Spacing.sm, marginTop: Spacing.md },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  multiline: { minHeight: 160, textAlignVertical: 'top' },
  previewBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  previewLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  previewBtn: { marginTop: Spacing.sm, marginBottom: Spacing.md },
  saveBtn: { marginTop: Spacing.lg, marginBottom: Spacing.md },
});
