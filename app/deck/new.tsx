import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import { LocaleButton } from '@/src/components/LocalePicker';
import { VoicePicker } from '@/src/components/VoicePicker';
import {
  PasteCardsPanel,
  PasteCardsState,
} from '@/src/components/import/PasteCardsPanel';
import { createDeck } from '@/src/db/repositories';
import {
  importCsvToDeck,
  importPastedRowsToDeck,
  pickApkgFile,
  pickCsvFile,
  previewCsvFile,
} from '@/src/services/import/ImportService';
import { useAppContext } from '@/src/context/AppContext';

type CardSource = 'paste' | 'csv' | 'none';

export default function NewDeckScreen() {
  const { settings } = useAppContext();
  const [name, setName] = useState('');
  const [frontLocale, setFrontLocale] = useState(settings.defaultFrontLocale);
  const [backLocale, setBackLocale] = useState(settings.defaultBackLocale);
  const [picker, setPicker] = useState<'front' | 'back' | null>(null);
  const [loading, setLoading] = useState(false);
  const [pasteState, setPasteState] = useState<PasteCardsState | null>(null);
  const [cardSource, setCardSource] = useState<CardSource>('none');
  const [csvFileUri, setCsvFileUri] = useState<string | null>(null);
  const [csvFileName, setCsvFileName] = useState('');
  const [csvCardCount, setCsvCardCount] = useState(0);

  const handlePasteChange = useCallback((state: PasteCardsState) => {
    setPasteState(state);
    if (state.hasText) {
      setCardSource('paste');
      setCsvFileUri(null);
      setCsvFileName('');
      setCsvCardCount(0);
    } else {
      setCardSource((prev) => (prev === 'paste' ? 'none' : prev));
    }
  }, []);

  const handlePickCsv = async () => {
    const uri = await pickCsvFile();
    if (!uri) return;

    try {
      const { rows, errors } = await previewCsvFile(uri);
      if (rows.length === 0) {
        Alert.alert(
          'No cards found',
          errors[0] ?? 'The file has no valid two-column rows.',
        );
        return;
      }

      const fileName = uri.split('/').pop() ?? 'CSV file';
      setCsvFileUri(uri);
      setCsvFileName(fileName);
      setCsvCardCount(rows.length);
      setCardSource('csv');
      setPasteState(null);
    } catch {
      Alert.alert('Error', 'Could not read the CSV file.');
    }
  };

  const handleImportApkg = async () => {
    const fileUri = await pickApkgFile();
    if (!fileUri) return;
    router.push({ pathname: '/import/apkg', params: { fileUri } });
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Please enter a deck name');
      return;
    }

    const hasPaste = cardSource === 'paste' && (pasteState?.hasText ?? false);
    const hasCsv = cardSource === 'csv' && csvFileUri;

    if (hasPaste) {
      if (pasteState?.parseResult.configError) {
        Alert.alert('Invalid settings', pasteState.parseResult.configError);
        return;
      }
      if (pasteState.parseResult.rows.length === 0) {
        Alert.alert('No valid cards', 'Fix parsing errors or clear the pasted text.');
        return;
      }
    }

    if (hasCsv && csvCardCount === 0) {
      Alert.alert('No valid cards', 'Choose a CSV file with at least one valid row.');
      return;
    }

    setLoading(true);
    try {
      const deck = await createDeck({ name: name.trim(), frontLocale, backLocale });

      if (hasPaste && pasteState) {
        const result = await importPastedRowsToDeck(deck.id, pasteState.parseResult.rows);
        router.replace(`/deck/${deck.id}`);
        if (result.skipped > 0 || result.errors.length > 0) {
          Alert.alert(
            'Deck Created',
            `Created ${result.created} cards. Skipped ${result.skipped}.${result.errors.length ? `\n\n${result.errors.slice(0, 3).join('\n')}` : ''}`,
          );
        }
      } else if (hasCsv && csvFileUri) {
        const result = await importCsvToDeck(deck.id, csvFileUri);
        router.replace(`/deck/${deck.id}`);
        if (result.skipped > 0 || result.errors.length > 0) {
          Alert.alert(
            'Deck Created',
            `Created ${result.created} cards. Skipped ${result.skipped}.${result.errors.length ? `\n\n${result.errors.slice(0, 3).join('\n')}` : ''}`,
          );
        }
      } else {
        router.replace(`/deck/${deck.id}`);
      }
    } catch {
      Alert.alert('Error', 'Failed to create deck');
    } finally {
      setLoading(false);
    }
  };

  const pasteCount =
    cardSource === 'paste' && !pasteState?.parseResult.configError
      ? pasteState?.parseResult.rows.length ?? 0
      : 0;
  const importCount = cardSource === 'csv' ? csvCardCount : pasteCount;
  const createTitle = importCount > 0 ? `Create Deck (${importCount} cards)` : 'Create Deck';

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
      >
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

        <Text style={[styles.section, styles.cardsSection]}>Add cards (optional)</Text>
        <Text style={styles.hint}>
          Paste text, import a CSV file, or import an Anki deck. CSV uses the first two columns when
          front/back headers are missing.
        </Text>

        <View style={styles.importActions}>
          <Button title="Choose CSV File" variant="secondary" onPress={handlePickCsv} />
          <Button title="Import Anki (.apkg)" variant="secondary" onPress={handleImportApkg} />
        </View>

        {cardSource === 'csv' && csvFileUri && (
          <View style={styles.fileBadge}>
            <Text style={styles.fileBadgeText}>
              {csvCardCount} card{csvCardCount === 1 ? '' : 's'} from {csvFileName}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setCardSource('none');
                setCsvFileUri(null);
                setCsvFileName('');
                setCsvCardCount(0);
              }}
            >
              <Text style={styles.clearLink}>Clear</Text>
            </TouchableOpacity>
          </View>
        )}

        <Text style={styles.subsection}>Or paste text</Text>
        <PasteCardsPanel onChange={handlePasteChange} />

        <Button title={createTitle} onPress={handleCreate} loading={loading} style={styles.createBtn} />
      </ScrollView>

      <VoicePicker
        visible={picker === 'front'}
        selectedLocale={frontLocale}
        onSelect={setFrontLocale}
        onClose={() => setPicker(null)}
        title="Front Language"
      />
      <VoicePicker
        visible={picker === 'back'}
        selectedLocale={backLocale}
        onSelect={setBackLocale}
        onClose={() => setPicker(null)}
        title="Back Language"
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.background },
  container: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Spacing.md, paddingBottom: Spacing.xl },
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
  subsection: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginTop: Spacing.md,
    marginBottom: Spacing.sm,
  },
  cardsSection: { marginTop: Spacing.lg },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md, lineHeight: 20 },
  importActions: { gap: Spacing.sm, marginBottom: Spacing.md },
  fileBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  fileBadgeText: { color: Colors.text, fontSize: FontSize.sm, flex: 1 },
  clearLink: { color: Colors.primary, fontSize: FontSize.sm, fontWeight: '600' },
  createBtn: { marginTop: Spacing.lg },
});
