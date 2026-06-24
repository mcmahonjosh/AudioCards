import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Switch,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import {
  getDeckById,
  getCardsWithScheduling,
  getReviewsToday,
  getNewCardsIntroducedToday,
  updateDeck,
  deleteDeck,
} from '@/src/db/repositories';
import { pickAndImportCsv, pickApkgFile, importPastedRowsToDeck } from '@/src/services/import/ImportService';
import {
  PasteCardsPanel,
  PasteCardsState,
} from '@/src/components/import/PasteCardsPanel';
import { Deck, CardWithScheduling } from '@/src/models/types';
import { getLocaleLabel } from '@/src/services/tts/locales';
import { formatDueAt } from '@/src/scheduler/time';
import { getDeckSessionCounts, SessionCounts } from '@/src/scheduler/sessionQueue';
import { ttsService } from '@/src/services/tts/TtsService';
import { describeVoice } from '@/src/services/tts/voiceMatcher';
import {
  clampNewCardsPerDay,
  getDeckNewCardsPerDayMode,
  getEffectiveNewCardsPerDay,
  NewCardsPerDayMode,
} from '@/src/scheduler/newCardLimits';
import { plainTextPreview } from '@/src/services/media/ankiHtmlParser';
import { useAppContext } from '@/src/context/AppContext';
import { NumberStepper } from '@/src/components/NumberStepper';
import { Sm2DeckConfig } from '@/src/models/types';
import { normalizeSm2DeckConfig } from '@/src/db/mappers';

function cardDueLabel(scheduling: CardWithScheduling['scheduling']): string {
  const now = new Date();
  if (scheduling.phase === 'new') return 'New';
  if (scheduling.dueAt <= now) return 'Due';
  return `Scheduled · ${formatDueAt(scheduling.dueAt, now)}`;
}

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { settings } = useAppContext();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<CardWithScheduling[]>([]);
  const [sessionCounts, setSessionCounts] = useState<SessionCounts>({ new: 0, learning: 0, review: 0 });
  const [reviewsToday, setReviewsToday] = useState(0);
  const [newCardsIntroducedToday, setNewCardsIntroducedToday] = useState(0);
  const [importModal, setImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'csv' | 'apkg' | 'paste'>('csv');
  const [pasteState, setPasteState] = useState<PasteCardsState | null>(null);
  const [pasteImporting, setPasteImporting] = useState(false);
  const [renameModal, setRenameModal] = useState(false);
  const [renameValue, setRenameValue] = useState('');
  const [schedulerModal, setSchedulerModal] = useState(false);
  const [schedulerUseGlobal, setSchedulerUseGlobal] = useState(true);
  const [schedulerCustomLimit, setSchedulerCustomLimit] = useState(20);
  const [frontVoiceLabel, setFrontVoiceLabel] = useState('');
  const [backVoiceLabel, setBackVoiceLabel] = useState('');

  const load = useCallback(async () => {
    if (!id) return;
    const d = await getDeckById(id);
    setDeck(d);
    const loadedCards = await getCardsWithScheduling(id);
    setCards(loadedCards);
    const introducedToday = await getNewCardsIntroducedToday(id);
    setNewCardsIntroducedToday(introducedToday);
    const effectiveLimit = d
      ? getEffectiveNewCardsPerDay(d, settings)
      : settings.defaultNewCardsPerDay;
    setSessionCounts(
      getDeckSessionCounts(loadedCards, new Date(), {
        newCardsLimit: effectiveLimit,
        newCardsIntroducedToday: introducedToday,
      }),
    );
    setReviewsToday(await getReviewsToday(id));
    await ttsService.initialize();
    if (d) {
      setFrontVoiceLabel(describeVoice(ttsService.resolveVoice(d.frontLocale)));
      setBackVoiceLabel(describeVoice(ttsService.resolveVoice(d.backLocale)));
    }
  }, [id, settings.defaultNewCardsPerDay]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const handleImportCsv = async () => {
    if (!id) return;
    const result = await pickAndImportCsv(id);
    if (result) {
      Alert.alert(
        'Import Complete',
        `Created ${result.created} cards. Skipped ${result.skipped}.${result.errors.length ? `\n\nErrors:\n${result.errors.slice(0, 3).join('\n')}` : ''}`,
      );
      setImportModal(false);
      load();
    }
  };

  const handleImportApkg = async () => {
    setImportModal(false);
    const fileUri = await pickApkgFile();
    if (!fileUri) return;
    router.push({ pathname: '/import/apkg', params: { fileUri } });
  };

  const handlePasteChange = useCallback((state: PasteCardsState) => {
    setPasteState(state);
  }, []);

  const handleImportPaste = async () => {
    if (!id || !pasteState?.hasText) return;
    if (pasteState.parseResult.configError) {
      Alert.alert('Invalid settings', pasteState.parseResult.configError);
      return;
    }
    if (pasteState.parseResult.rows.length === 0) {
      Alert.alert('No valid cards', 'Fix parsing errors or paste card text.');
      return;
    }

    setPasteImporting(true);
    try {
      const result = await importPastedRowsToDeck(id, pasteState.parseResult.rows);
      Alert.alert(
        'Import Complete',
        `Created ${result.created} cards. Skipped ${result.skipped}.${result.errors.length ? `\n\nErrors:\n${result.errors.slice(0, 3).join('\n')}` : ''}`,
      );
      setImportModal(false);
      load();
    } catch (e) {
      Alert.alert('Import Failed', e instanceof Error ? e.message : 'Import failed');
    } finally {
      setPasteImporting(false);
    }
  };

  const openRename = () => {
    if (!deck) return;
    setRenameValue(deck.name);
    setRenameModal(true);
  };

  const openScheduler = () => {
    if (!deck) return;
    const config = deck.config as Sm2DeckConfig;
    const mode = getDeckNewCardsPerDayMode(config);
    setSchedulerUseGlobal(mode === 'global');
    setSchedulerCustomLimit(clampNewCardsPerDay(config.newCardsPerDay));
    setSchedulerModal(true);
  };

  const confirmScheduler = async () => {
    if (!id || !deck) return;
    const mode: NewCardsPerDayMode = schedulerUseGlobal ? 'global' : 'custom';
    const nextConfig = normalizeSm2DeckConfig({
      ...(deck.config as Sm2DeckConfig),
      newCardsPerDayMode: mode,
      newCardsPerDay: schedulerCustomLimit,
    });
    try {
      await updateDeck(id, { config: nextConfig });
      setSchedulerModal(false);
      load();
    } catch {
      Alert.alert('Save failed', 'Could not update scheduler settings.');
    }
  };

  const confirmRename = async () => {
    if (!id) return;
    const next = renameValue.trim();
    if (!next) {
      Alert.alert('Invalid name', 'Deck name cannot be empty.');
      return;
    }
    try {
      await updateDeck(id, { name: next });
      setRenameModal(false);
      load();
    } catch {
      Alert.alert('Rename failed', 'Could not rename this deck.');
    }
  };

  const confirmDelete = async () => {
    if (!id || !deck) return;
    Alert.alert(
      'Delete Deck?',
      `This will permanently delete "${deck.name}" and all its cards, scheduling, and review history.\n\nCards: ${cards.length}`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteDeck(id);
              router.back();
            } catch {
              Alert.alert('Delete failed', 'Could not delete this deck.');
            }
          },
        },
      ],
    );
  };

  if (!deck) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  const queueTotal =
    sessionCounts.new + sessionCounts.learning + sessionCounts.review;
  const effectiveNewCardsLimit = getEffectiveNewCardsPerDay(deck, settings);
  const newCardsRemaining = Math.max(0, effectiveNewCardsLimit - newCardsIntroducedToday);

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <MiniStat label="New" value={sessionCounts.new} />
        <MiniStat label="Learning" value={sessionCounts.learning} />
        <MiniStat label="Review" value={sessionCounts.review} />
        <MiniStat label="Done Today" value={reviewsToday} />
      </View>

      <Text style={styles.locales}>
        {getLocaleLabel(deck.frontLocale)} → {getLocaleLabel(deck.backLocale)}
      </Text>
      <Text style={styles.voiceHint}>
        Voices: {frontVoiceLabel || '…'} → {backVoiceLabel || '…'}
      </Text>

      <View style={styles.actions}>
        <Button
          title="Start Review"
          subtitle={
            queueTotal > 0
              ? `${queueTotal} in queue (${sessionCounts.new} new, ${sessionCounts.learning} learning, ${sessionCounts.review} review)`
              : 'Nothing due right now'
          }
          onPress={() => router.push(`/deck/${id}/review`)}
          disabled={queueTotal === 0}
          style={styles.actionBtn}
        />
        <View style={styles.secondaryActions}>
          <Button
            title="Add Card"
            variant="secondary"
            onPress={() => router.push(`/card/new?deckId=${id}`)}
            style={styles.smallBtn}
          />
          <Button
            title="Import"
            variant="secondary"
            onPress={() => setImportModal(true)}
            style={styles.smallBtn}
          />
        </View>
        <View style={[styles.secondaryActions, styles.secondaryActionsSpaced]}>
          <Button
            title="Scheduler"
            variant="secondary"
            onPress={openScheduler}
            style={styles.smallBtn}
          />
          <Button
            title="Rename"
            variant="secondary"
            onPress={openRename}
            style={styles.smallBtn}
          />
          <Button
            title="Delete"
            variant="ghost"
            onPress={confirmDelete}
            style={styles.smallBtn}
          />
        </View>
      </View>

      <FlatList
        data={cards}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.empty}>No cards yet. Add or import some!</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.cardItem}
            onPress={() => router.push(`/card/${item.id}/edit`)}
          >
            <Text style={styles.cardFront} numberOfLines={2}>
              {plainTextPreview(item.frontText, item.contentFormat)}
            </Text>
            <View style={styles.cardMeta}>
              <Text style={styles.phase}>{item.scheduling.phase}</Text>
              <Text
                style={[
                  styles.due,
                  item.scheduling.dueAt <= new Date() && item.scheduling.phase !== 'new'
                    ? styles.dueNow
                    : null,
                ]}
              >
                {cardDueLabel(item.scheduling)}
              </Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={importModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalSheet, importTab === 'paste' && styles.modalSheetTall]}>
            <Text style={styles.modalTitle}>Import Cards</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, importTab === 'csv' && styles.tabActive]}
                onPress={() => setImportTab('csv')}
              >
                <Text style={styles.tabText}>CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, importTab === 'paste' && styles.tabActive]}
                onPress={() => setImportTab('paste')}
              >
                <Text style={styles.tabText}>Paste</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, importTab === 'apkg' && styles.tabActive]}
                onPress={() => setImportTab('apkg')}
              >
                <Text style={styles.tabText}>Anki</Text>
              </TouchableOpacity>
            </View>

            {importTab === 'csv' ? (
              <>
                <Text style={styles.importHint}>
                  Two columns required: front and back. Uses front/back column names when present;
                  otherwise the first column is front and the second is back.
                </Text>
                <Button title="Choose CSV File" onPress={handleImportCsv} />
              </>
            ) : importTab === 'paste' ? (
              <ScrollView style={styles.pasteScroll} keyboardShouldPersistTaps="handled">
                <PasteCardsPanel onChange={handlePasteChange} />
                <Button
                  title={
                    pasteState?.parseResult.rows.length
                      ? `Import ${pasteState.parseResult.rows.length} cards`
                      : 'Import cards'
                  }
                  onPress={handleImportPaste}
                  loading={pasteImporting}
                  disabled={
                    pasteImporting ||
                    !pasteState?.hasText ||
                    !!pasteState?.parseResult.configError ||
                    pasteState?.parseResult.rows.length === 0
                  }
                  style={styles.pasteImportBtn}
                />
              </ScrollView>
            ) : (
              <>
                <Text style={styles.importHint}>
                  Imports note types with HTML, images, audio, and scheduling. Choose which Anki
                  decks to import. Re-import existing decks to refresh paired audio fields. Embedded
                  audio playback needs a native build (EAS dev/production), not Expo Go.
                </Text>
                <Button title="Choose .apkg File" onPress={handleImportApkg} />
              </>
            )}

            <Button title="Close" variant="ghost" onPress={() => setImportModal(false)} />
          </View>
        </View>
      </Modal>

      <Modal visible={schedulerModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.renameModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.renameModalSheet}>
            <Text style={styles.modalTitle}>Scheduler</Text>
            <Text style={styles.importHint}>New cards per day</Text>
            <View style={styles.schedulerRow}>
              <Text style={styles.schedulerLabel}>Use global limit</Text>
              <Switch
                value={schedulerUseGlobal}
                onValueChange={setSchedulerUseGlobal}
                trackColor={{ false: Colors.border, true: Colors.primary }}
              />
            </View>
            {schedulerUseGlobal ? (
              <Text style={styles.importHint}>
                Global limit: {settings.defaultNewCardsPerDay} new cards per day
              </Text>
            ) : (
              <>
                <Text style={styles.importHint}>Custom limit for this deck</Text>
                <NumberStepper
                  value={schedulerCustomLimit}
                  onChange={(v) => setSchedulerCustomLimit(clampNewCardsPerDay(v))}
                />
              </>
            )}
            <Text style={styles.importHint}>
              Introduced today: {newCardsIntroducedToday} / {effectiveNewCardsLimit}
              {newCardsRemaining > 0
                ? ` · ${newCardsRemaining} remaining`
                : ' · daily limit reached'}
            </Text>
            <View style={styles.secondaryActions}>
              <Button
                title="Cancel"
                variant="ghost"
                onPress={() => setSchedulerModal(false)}
                style={styles.smallBtn}
              />
              <Button title="Save" onPress={confirmScheduler} style={styles.smallBtn} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={renameModal} animationType="fade" transparent>
        <KeyboardAvoidingView
          style={styles.renameModalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.renameModalSheet}>
            <Text style={styles.modalTitle}>Rename Deck</Text>
            <Text style={styles.importHint}>New name</Text>
            <TextInput
              value={renameValue}
              onChangeText={setRenameValue}
              placeholder="Deck name"
              placeholderTextColor={Colors.textMuted}
              autoFocus
              style={styles.textInput}
            />
            <View style={styles.secondaryActions}>
              <Button title="Cancel" variant="ghost" onPress={() => setRenameModal(false)} style={styles.smallBtn} />
              <Button title="Save" onPress={confirmRename} style={styles.smallBtn} />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.miniStat}>
      <Text style={styles.miniValue}>{value}</Text>
      <Text style={styles.miniLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loading: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  statsRow: { flexDirection: 'row', padding: Spacing.md, gap: Spacing.sm },
  miniStat: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  miniValue: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  miniLabel: { color: Colors.textMuted, fontSize: 11 },
  locales: { color: Colors.textMuted, textAlign: 'center', fontSize: FontSize.sm, marginBottom: Spacing.xs },
  voiceHint: {
    color: Colors.textMuted,
    textAlign: 'center',
    fontSize: FontSize.sm,
    marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  actions: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  actionBtn: { marginBottom: Spacing.sm },
  secondaryActions: { flexDirection: 'row', gap: Spacing.sm },
  secondaryActionsSpaced: { marginTop: Spacing.sm },
  schedulerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  schedulerLabel: { color: Colors.text, fontSize: FontSize.md, flex: 1 },
  smallBtn: { flex: 1 },
  list: { padding: Spacing.md, paddingTop: 0 },
  cardItem: {
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardFront: { color: Colors.text, fontSize: FontSize.md },
  cardMeta: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.sm },
  phase: { color: Colors.primary, fontSize: FontSize.sm, textTransform: 'capitalize' },
  due: { color: Colors.textMuted, fontSize: FontSize.sm },
  dueNow: { color: Colors.accent, fontWeight: '600' },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg, maxHeight: '90%' },
  modalSheetTall: { maxHeight: '92%' },
  pasteScroll: { maxHeight: 420, marginBottom: Spacing.sm },
  pasteImportBtn: { marginTop: Spacing.md },
  renameModalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-start',
    paddingTop: Platform.OS === 'ios' ? 60 : Spacing.xl,
    paddingHorizontal: Spacing.md,
  },
  renameModalSheet: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  modalTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  tabRow: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
  tab: { flex: 1, padding: Spacing.sm, borderRadius: 8, backgroundColor: Colors.surfaceLight, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { color: Colors.text, fontWeight: '600' },
  importHint: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md },
  textInput: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: 10,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: FontSize.md,
    marginBottom: Spacing.md,
  },
  comingSoon: { alignItems: 'center', padding: Spacing.lg, gap: Spacing.sm },
  comingSoonText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
});
