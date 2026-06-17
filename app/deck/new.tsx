import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput, Alert } from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import { LocaleButton, LocalePicker } from '@/src/components/LocalePicker';
import { createDeck } from '@/src/db/repositories';
import { useAppContext } from '@/src/context/AppContext';

export default function NewDeckScreen() {
  const { settings } = useAppContext();
  const [name, setName] = useState('');
  const [frontLocale, setFrontLocale] = useState(settings.defaultFrontLocale);
  const [backLocale, setBackLocale] = useState(settings.defaultBackLocale);
  const [picker, setPicker] = useState<'front' | 'back' | null>(null);
  const [loading, setLoading] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }
    setLoading(true);
    try {
      const deck = await createDeck({ name: name.trim(), frontLocale, backLocale });
      router.replace(`/deck/${deck.id}`);
    } catch (e) {
      Alert.alert('Error', 'Failed to create deck');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Deck Name</Text>
      <TextInput
        style={styles.input}
        value={name}
        onChangeText={setName}
        placeholder="e.g. Spanish Vocabulary"
        placeholderTextColor={Colors.textMuted}
        autoFocus
      />

      <Text style={styles.section}>Card Languages</Text>
      <Text style={styles.hint}>Front and back language defaults for new cards in this deck.</Text>

      <LocaleButton locale={frontLocale} label="Front Language" onPress={() => setPicker('front')} />
      <LocaleButton locale={backLocale} label="Back Language" onPress={() => setPicker('back')} />

      <Button title="Create Deck" onPress={handleCreate} loading={loading} style={styles.createBtn} />

      <LocalePicker
        visible={picker === 'front'}
        selected={frontLocale}
        onSelect={setFrontLocale}
        onClose={() => setPicker(null)}
        title="Front Language"
      />
      <LocalePicker
        visible={picker === 'back'}
        selected={backLocale}
        onSelect={setBackLocale}
        onClose={() => setPicker(null)}
        title="Back Language"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  label: { color: Colors.text, fontSize: FontSize.md, marginBottom: Spacing.sm },
  input: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    color: Colors.text,
    fontSize: FontSize.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
  },
  section: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '600', marginBottom: Spacing.sm },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md },
  createBtn: { marginTop: Spacing.lg },
});
