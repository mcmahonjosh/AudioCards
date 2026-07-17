import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import {
  formatImportSummary,
  importApkg,
  parseApkgFile,
  pickApkgFile,
} from '@/src/services/import/ImportService';
import { ApkgDeck, ApkgParseResult } from '@/src/services/import/apkgImporter';
import { useAppContext } from '@/src/context/AppContext';
import { invalidateDeck } from '@/src/context/deckInvalidation';
import { firstParam } from '@/src/utils/routeParams';

export default function ApkgImportScreen() {
  const params = useLocalSearchParams<{ fileUri?: string; targetDeckId?: string }>();
  const targetDeckId = firstParam(params.targetDeckId);
  const fileUriParam = firstParam(params.fileUri);
  const { settings } = useAppContext();
  const [parseResult, setParseResult] = useState<ApkgParseResult | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(!!fileUriParam);
  const [pickingFile, setPickingFile] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0, phase: '' });
  const [error, setError] = useState<string | null>(null);

  const loadFile = useCallback(async (uri: string) => {
    setLoading(true);
    setError(null);
    setProgress({ current: 0, total: 100, phase: 'Starting…' });
    try {
      const result = await parseApkgFile(uri, setProgress);
      setParseResult(result);
      setSelected(new Set(result.decks.map((d) => d.id)));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to parse .apkg');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!fileUriParam) return;
    let cancelled = false;
    (async () => {
      if (!cancelled) await loadFile(fileUriParam);
    })();
    return () => {
      cancelled = true;
    };
  }, [fileUriParam, loadFile]);

  const handleChooseFile = async () => {
    setPickingFile(true);
    setError(null);
    try {
      const uri = await pickApkgFile();
      if (!uri) return;
      await loadFile(uri);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Import setup failed');
    } finally {
      setPickingFile(false);
    }
  };

  const decks = parseResult?.decks ?? [];
  const allSelected = decks.length > 0 && selected.size === decks.length;

  const toggleDeck = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelected(new Set());
    } else {
      setSelected(new Set(decks.map((d) => d.id)));
    }
  };

  const selectedNoteCount = useMemo(
    () =>
      decks
        .filter((d) => selected.has(d.id))
        .reduce((sum, d) => sum + d.noteCount, 0),
    [decks, selected],
  );

  const handleImport = async () => {
    if (!parseResult || selected.size === 0) {
      Alert.alert('Select decks', 'Choose at least one Anki deck to import.');
      return;
    }

    setImporting(true);
    try {
      const result = await importApkg(parseResult, {
        selectedDeckIds: [...selected],
        frontLocale: settings.defaultFrontLocale,
        backLocale: settings.defaultBackLocale,
        frontVoiceId: settings.defaultFrontVoiceId,
        backVoiceId: settings.defaultBackVoiceId,
        targetDeckId,
        onProgress: setProgress,
      });
      if (targetDeckId) {
        invalidateDeck(targetDeckId);
      }
      Alert.alert('Import Complete', formatImportSummary(result), [
        {
          text: 'OK',
          onPress: () => {
            if (targetDeckId) {
              router.replace(`/deck/${targetDeckId}`);
            } else {
              router.back();
            }
          },
        },
      ]);
    } catch (e) {
      Alert.alert('Import Failed', e instanceof Error ? e.message : 'Import failed');
    } finally {
      setImporting(false);
    }
  };

  if (loading) {
    const parsePct = progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>{progress.phase || 'Parsing Anki deck…'}</Text>
        {progress.total > 0 && (
          <Text style={styles.loadingPct}>{parsePct}%</Text>
        )}
      </View>
    );
  }

  if (error && !parseResult) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <Button title="Choose .apkg File" onPress={handleChooseFile} loading={pickingFile} style={styles.backBtn} />
        <Button title="Go Back" variant="secondary" onPress={() => router.back()} style={styles.backBtn} />
      </View>
    );
  }

  if (!parseResult) {
    return (
      <View style={styles.center}>
        <Text style={styles.idleTitle}>Import Anki package</Text>
        <Text style={styles.idleSubtitle}>
          {targetDeckId
            ? 'Cards will be appended to your current deck; existing cards stay.'
            : 'Choose an .apkg file to create or update decks named like in Anki.'}
        </Text>
        <Button
          title="Choose .apkg File"
          onPress={handleChooseFile}
          loading={pickingFile}
          style={styles.chooseBtn}
        />
        <Button title="Cancel" variant="secondary" onPress={() => router.back()} style={styles.backBtn} />
      </View>
    );
  }

  if (decks.length === 0) {
    const stats = parseResult.stats;
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No importable decks found in this package.</Text>
        {stats && (
          <Text style={styles.emptyHint}>
            {stats.notesInPackage} notes and {stats.cardsInPackage} cards in file;{' '}
            {stats.notesParsed} could be imported.
          </Text>
        )}
        <Button title="Choose another file" onPress={handleChooseFile} loading={pickingFile} style={styles.backBtn} />
        <Button title="Go Back" variant="secondary" onPress={() => router.back()} style={styles.backBtn} />
      </View>
    );
  }

  const progressPct =
    progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0;

  return (
    <View style={styles.container}>
      <Text style={styles.subtitle}>
        {targetDeckId
          ? 'Select Anki decks to add. Cards will be appended to your current deck; existing cards stay. HTML, images, audio, and scheduling are preserved.'
          : 'Select Anki decks to import. HTML, images, audio, and scheduling are preserved. Re-import decks you imported before to pick up paired audio fields. Embedded audio playback requires a dev or production build with native audio support (not Expo Go).'}
      </Text>

      <TouchableOpacity style={styles.selectAllRow} onPress={toggleAll}>
        <Ionicons
          name={allSelected ? 'checkbox' : 'square-outline'}
          size={22}
          color={Colors.primary}
        />
        <Text style={styles.selectAllText}>
          {allSelected ? 'Deselect all' : 'Select all'}
        </Text>
        <Text style={styles.countBadge}>{selectedNoteCount} notes</Text>
      </TouchableOpacity>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        {decks.map((deck) => (
          <DeckRow
            key={deck.id}
            deck={deck}
            checked={selected.has(deck.id)}
            onToggle={() => toggleDeck(deck.id)}
          />
        ))}
      </ScrollView>

      {importing && (
        <View style={styles.progressBox}>
          <Text style={styles.progressText}>{progress.phase || 'Importing…'}</Text>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
          </View>
          <Text style={styles.progressPct}>{progressPct}%</Text>
        </View>
      )}

      <Button
        title={importing ? 'Importing…' : `Import ${selectedNoteCount} cards`}
        onPress={handleImport}
        loading={importing}
        disabled={selected.size === 0 || importing}
        style={styles.importBtn}
      />
    </View>
  );
}

function DeckRow({
  deck,
  checked,
  onToggle,
}: {
  deck: ApkgDeck;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <TouchableOpacity style={styles.deckRow} onPress={onToggle}>
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={checked ? Colors.primary : Colors.textMuted}
      />
      <View style={styles.deckInfo}>
        <Text style={styles.deckName}>{deck.name}</Text>
        <Text style={styles.deckCount}>{deck.noteCount} notes</Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  center: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  idleTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '600',
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  idleSubtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    lineHeight: 20,
    textAlign: 'center',
    marginBottom: Spacing.lg,
    paddingHorizontal: Spacing.md,
  },
  chooseBtn: { alignSelf: 'stretch', marginBottom: Spacing.sm },
  subtitle: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  loadingText: { color: Colors.textMuted, marginTop: Spacing.md, textAlign: 'center' },
  loadingPct: { color: Colors.textMuted, marginTop: Spacing.xs, fontSize: FontSize.sm },
  errorText: { color: Colors.again, textAlign: 'center', marginBottom: Spacing.md },
  emptyHint: {
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.md,
    lineHeight: 20,
    paddingHorizontal: Spacing.md,
  },
  backBtn: { marginTop: Spacing.sm, alignSelf: 'stretch' },
  selectAllRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  selectAllText: { color: Colors.text, fontSize: FontSize.md, flex: 1 },
  countBadge: { color: Colors.textMuted, fontSize: FontSize.sm },
  list: { flex: 1 },
  listContent: { paddingBottom: Spacing.md },
  deckRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deckInfo: { flex: 1 },
  deckName: { color: Colors.text, fontSize: FontSize.md, fontWeight: '500' },
  deckCount: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 2 },
  progressBox: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  progressText: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.xs },
  progressBar: {
    height: 6,
    backgroundColor: Colors.border,
    borderRadius: 3,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: Colors.primary },
  progressPct: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  importBtn: { marginBottom: Spacing.md },
});
