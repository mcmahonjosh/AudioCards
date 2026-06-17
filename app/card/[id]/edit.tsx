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
import { LocaleButton, LocalePicker } from '@/src/components/LocalePicker';
import { getCardById, updateCard, deleteCard } from '@/src/db/repositories';
import { ttsService } from '@/src/services/tts/TtsService';
import { useAppContext } from '@/src/context/AppContext';

export default function EditCardScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useAppContext();
  const [frontText, setFrontText] = useState('');
  const [backText, setBackText] = useState('');
  const [frontLocale, setFrontLocale] = useState('en-US');
  const [backLocale, setBackLocale] = useState('es-MX');
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
        }
      });
    }
  }, [id]);

  const previewFront = () =>
    ttsService.speak(frontText || 'Preview', frontLocale, { rate: settings.speechRate });
  const previewBack = () =>
    ttsService.speak(backText || 'Preview', backLocale, { rate: settings.speechRate });

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
        placeholderTextColor={Colors.textMuted}
      />
      <LocaleButton locale={frontLocale} label="Front Language" onPress={() => setPicker('front')} />
      <Button title="Preview Front Audio" variant="secondary" onPress={previewFront} style={styles.previewBtn} />

      <Text style={styles.label}>Back</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={backText}
        onChangeText={setBackText}
        multiline
        placeholderTextColor={Colors.textMuted}
      />
      <LocaleButton locale={backLocale} label="Back Language" onPress={() => setPicker('back')} />
      <Button title="Preview Back Audio" variant="secondary" onPress={previewBack} style={styles.previewBtn} />

      <Button title="Save Changes" onPress={handleSave} loading={loading} style={styles.saveBtn} />
      <Button title="Delete Card" variant="again" onPress={handleDelete} />

      <LocalePicker visible={picker === 'front'} selected={frontLocale} onSelect={setFrontLocale} onClose={() => setPicker(null)} title="Front Language" />
      <LocalePicker visible={picker === 'back'} selected={backLocale} onSelect={setBackLocale} onClose={() => setPicker(null)} title="Back Language" />
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
  multiline: { minHeight: 80, textAlignVertical: 'top' },
  previewBtn: { marginTop: Spacing.sm, marginBottom: Spacing.md },
  saveBtn: { marginTop: Spacing.lg, marginBottom: Spacing.md },
});
