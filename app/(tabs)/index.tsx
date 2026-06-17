import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { Button } from '@/src/components/Button';
import { getAllDecks, countDueCards, getReviewsToday } from '@/src/db/repositories';
import { getStatsSummary } from '@/src/stats/StatsAggregator';
import { Deck } from '@/src/models/types';
import { useAppContext } from '@/src/context/AppContext';

interface DeckWithDue extends Deck {
  dueCount: number;
}

export default function HomeScreen() {
  const { dbReady } = useAppContext();
  const [decks, setDecks] = useState<DeckWithDue[]>([]);
  const [dueToday, setDueToday] = useState(0);
  const [reviewsToday, setReviewsToday] = useState(0);
  const [streak, setStreak] = useState(0);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!dbReady) return;
    const allDecks = await getAllDecks();
    const withDue: DeckWithDue[] = [];
    for (const deck of allDecks) {
      const dueCount = await countDueCards(deck.id, new Date());
      withDue.push({ ...deck, dueCount });
    }
    const summary = await getStatsSummary();
    setDecks(withDue);
    setDueToday(summary.dueToday);
    setReviewsToday(summary.reviewsToday);
    setStreak(summary.streak);
  }, [dbReady]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const firstDeckWithDue = decks.find((d) => d.dueCount > 0);

  return (
    <View style={styles.container}>
      <View style={styles.statsRow}>
        <StatCard label="Due Today" value={dueToday} color={Colors.primary} />
        <StatCard label="Reviews" value={reviewsToday} color={Colors.accent} />
        <StatCard label="Streak" value={streak} color={Colors.good} suffix="d" />
      </View>

      {dueToday > 0 && firstDeckWithDue && (
        <Button
          title="Start Review"
          subtitle={`${dueToday} cards due`}
          onPress={() => router.push(`/deck/${firstDeckWithDue.id}/review`)}
          style={styles.reviewBtn}
        />
      )}

      <View style={styles.header}>
        <Text style={styles.sectionTitle}>Decks</Text>
        <TouchableOpacity onPress={() => router.push('/deck/new')}>
          <Ionicons name="add-circle" size={28} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={decks}
        keyExtractor={(item) => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
        }
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="albums-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No decks yet</Text>
            <Button title="Create Deck" onPress={() => router.push('/deck/new')} />
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.deckItem}
            onPress={() => router.push(`/deck/${item.id}`)}
          >
            <View>
              <Text style={styles.deckName}>{item.name}</Text>
              <Text style={styles.deckLocales}>
                {item.frontLocale} → {item.backLocale}
              </Text>
            </View>
            <View style={styles.deckRight}>
              {item.dueCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{item.dueCount}</Text>
                </View>
              )}
              <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
            </View>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

function StatCard({
  label,
  value,
  color,
  suffix,
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={[styles.statValue, { color }]}>
        {value}
        {suffix ?? ''}
      </Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  statCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  statValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  statLabel: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  reviewBtn: {
    marginBottom: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '600',
  },
  deckItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  deckName: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
  },
  deckLocales: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    marginTop: 4,
  },
  deckRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badge: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: Colors.text,
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  empty: {
    alignItems: 'center',
    paddingTop: Spacing.xl * 2,
    gap: Spacing.md,
  },
  emptyText: {
    color: Colors.textMuted,
    fontSize: FontSize.md,
  },
});
