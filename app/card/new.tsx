import React, { useState } from 'react';
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
import { createCard, getDeckById } from '@/src/db/repositories';
import { ttsService } from '@/src/services/tts/TtsService';
import { useAppContext } from '@/src/context/AppContext';

export default function NewCardScreen() {
  const { deckId } = useLocalSearchParams<{ deckId: string }>();
  const { settings } = useAppContext();
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [frontLocale, setFrontLocale] = useState(settings.defaultFrontLocale);
  const [backLocale, setBackLocale] = useState(settings.defaultBackLocale);
  const [picker, setPicker] = useState<'front' | 'back' | null>(null);
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (deckId) {
      getDeckById(deckId).then((deck) => {
        if (deck) {
          setFrontLocale(deck.frontLocale);
          setBackLocale(deck.backLocale);
        }
      });
    }
  }, [deckId]);

  const previewFront = () =>
    ttsService.speak(frontText || 'Preview', frontLocale, {
      rate: settings.speechRate,
      volume: settings.speechVolume,
    });
  const previewBack = () =>
    ttsService.speak(backText || 'Preview', backLocale, {
      rate: settings.speechRate,
      volume: settings.speechVolume,
    });

  const handleSave = async () => {
    if (!deckId || !frontText.trim() || !backText.trim()) {
      Alert.alert('Error', 'Front and back text are required');
      return;
    }
    setLoading(true);
    try {
      await createCard({
        deckId,
        frontText: frontText.trim(),
        backText: backText.trim(),
        frontLocale,
        backLocale,
        contentFormat: 'plain',
      });
      router.back();
    } catch {
      Alert.alert('Error', 'Failed to create card');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.label}>Front</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={frontText}
        onChangeText={setFrontText}
        placeholder="Front text"
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
      />
      {frontText.trim().length > 0 && (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Preview</Text>
          <CardContentRenderer text={frontText} contentFormat="plain" maxHeight={160} />
        </View>
      )}
      <LocaleButton locale={frontLocale} label="Front Language" onPress={() => setPicker('front')} />
      <Button title="Preview Front Audio" variant="secondary" onPress={previewFront} style={styles.previewBtn} />

      <Text style={styles.label}>Back</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={backText}
        onChangeText={setBackText}
        placeholder="Back text"
        placeholderTextColor={Colors.textMuted}
        multiline
        textAlignVertical="top"
      />
      {backText.trim().length > 0 && (
        <View style={styles.previewBox}>
          <Text style={styles.previewLabel}>Preview</Text>
          <CardContentRenderer text={backText} contentFormat="plain" maxHeight={160} />
        </View>
      )}
      <LocaleButton locale={backLocale} label="Back Language" onPress={() => setPicker('back')} />
      <Button title="Preview Back Audio" variant="secondary" onPress={previewBack} style={styles.previewBtn} />

      <Button title="Save Card" onPress={handleSave} loading={loading} style={styles.saveBtn} />

      <VoicePicker visible={picker === 'front'} selectedLocale={frontLocale} onSelect={setFrontLocale} onClose={() => setPicker(null)} title="Front Language" />
      <VoicePicker visible={picker === 'back'} selectedLocale={backLocale} onSelect={setBackLocale} onClose={() => setPicker(null)} title="Back Language" />
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
  saveBtn: { marginTop: Spacing.lg, marginBottom: Spacing.xl },
});
