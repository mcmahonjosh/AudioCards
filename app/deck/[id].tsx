import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import {
  getDeckById,
  getCardsWithScheduling,
  countDueCards,
  getReviewsToday,
} from '@/src/db/repositories';
import { pickAndImportCsv } from '@/src/services/import/ImportService';
import { Deck, CardWithScheduling } from '@/src/models/types';
import { getLocaleLabel } from '@/src/services/tts/locales';

export default function DeckScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [deck, setDeck] = useState<Deck | null>(null);
  const [cards, setCards] = useState<CardWithScheduling[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [reviewsToday, setReviewsToday] = useState(0);
  const [importModal, setImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'csv' | 'apkg'>('csv');

  const load = useCallback(async () => {
    if (!id) return;
    const d = await getDeckById(id);
    setDeck(d);
    setCards(await getCardsWithScheduling(id));
    setDueCount(await countDueCards(id, new Date()));
    setReviewsToday(await getReviewsToday(id));
  }, [id]);

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

  if (!deck) {
    return (
      <View style={styles.container}>
        <Text style={styles.loading}>Loading...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <MiniStat label="Due" value={dueCount} />
        <MiniStat label="Reviews Today" value={reviewsToday} />
        <MiniStat label="Cards" value={cards.length} />
      </View>

      <Text style={styles.locales}>
        {getLocaleLabel(deck.frontLocale)} → {getLocaleLabel(deck.backLocale)}
      </Text>

      <View style={styles.actions}>
        <Button
          title="Start Review"
          subtitle={dueCount > 0 ? `${dueCount} due` : 'No cards due'}
          onPress={() => router.push(`/deck/${id}/review`)}
          disabled={cards.length === 0}
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
            <Text style={styles.cardFront} numberOfLines={2}>{item.frontText}</Text>
            <View style={styles.cardMeta}>
              <Text style={styles.phase}>{item.scheduling.phase}</Text>
              {item.scheduling.phase !== 'new' && (
                <Text style={styles.due}>
                  {item.scheduling.dueAt <= new Date() ? 'Due' : 'Scheduled'}
                </Text>
              )}
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={importModal} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <Text style={styles.modalTitle}>Import Cards</Text>
            <View style={styles.tabRow}>
              <TouchableOpacity
                style={[styles.tab, importTab === 'csv' && styles.tabActive]}
                onPress={() => setImportTab('csv')}
              >
                <Text style={styles.tabText}>CSV</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.tab, importTab === 'apkg' && styles.tabActive]}
                onPress={() => setImportTab('apkg')}
              >
                <Text style={styles.tabText}>Anki (.apkg)</Text>
              </TouchableOpacity>
            </View>

            {importTab === 'csv' ? (
              <>
                <Text style={styles.importHint}>
                  CSV format: front, back columns required. Optional: tags, front_locale, back_locale
                </Text>
                <Button title="Choose CSV File" onPress={handleImportCsv} />
              </>
            ) : (
              <>
                <View style={styles.comingSoon}>
                  <Ionicons name="time-outline" size={32} color={Colors.textMuted} />
                  <Text style={styles.comingSoonText}>Anki .apkg import coming soon</Text>
                  <Text style={styles.importHint}>
                    Architecture is in place. Use CSV import for now, or export your Anki deck as CSV.
                  </Text>
                </View>
              </>
            )}

            <Button title="Close" variant="ghost" onPress={() => setImportModal(false)} />
          </View>
        </View>
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
  locales: { color: Colors.textMuted, textAlign: 'center', fontSize: FontSize.sm, marginBottom: Spacing.sm },
  actions: { paddingHorizontal: Spacing.md, marginBottom: Spacing.md },
  actionBtn: { marginBottom: Spacing.sm },
  secondaryActions: { flexDirection: 'row', gap: Spacing.sm },
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
  due: { color: Colors.accent, fontSize: FontSize.sm },
  empty: { color: Colors.textMuted, textAlign: 'center', marginTop: Spacing.xl },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  modalSheet: { backgroundColor: Colors.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: Spacing.lg },
  modalTitle: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700', marginBottom: Spacing.md },
  tabRow: { flexDirection: 'row', marginBottom: Spacing.md, gap: Spacing.sm },
  tab: { flex: 1, padding: Spacing.sm, borderRadius: 8, backgroundColor: Colors.surfaceLight, alignItems: 'center' },
  tabActive: { backgroundColor: Colors.primary },
  tabText: { color: Colors.text, fontWeight: '600' },
  importHint: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.md },
  comingSoon: { alignItems: 'center', padding: Spacing.lg, gap: Spacing.sm },
  comingSoonText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
});
