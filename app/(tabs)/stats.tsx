import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import {
  getStatsSummary,
  getDailyReviews,
  getDailyRatings,
  getDueForecast,
  getDeckProgress,
  getWeakCards,
} from '@/src/stats/StatsAggregator';
import { getAllDecks } from '@/src/db/repositories';
import {
  ChartCard,
  DailyReviewsChart,
  RatingStackChart,
  DueForecastChart,
  ProgressChart,
} from '@/src/components/charts/StatsCharts';
import { Deck } from '@/src/models/types';
import { useAppContext } from '@/src/context/AppContext';

export default function StatsScreen() {
  const { dbReady } = useAppContext();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [summary, setSummary] = useState<Awaited<ReturnType<typeof getStatsSummary>> | null>(null);
  const [dailyReviews, setDailyReviews] = useState<Awaited<ReturnType<typeof getDailyReviews>>>([]);
  const [dailyRatings, setDailyRatings] = useState<Awaited<ReturnType<typeof getDailyRatings>>>([]);
  const [dueForecast, setDueForecast] = useState<Awaited<ReturnType<typeof getDueForecast>>>([]);
  const [progress, setProgress] = useState<Awaited<ReturnType<typeof getDeckProgress>>>([]);
  const [weakCards, setWeakCards] = useState<Awaited<ReturnType<typeof getWeakCards>>>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!dbReady) return;
    const allDecks = await getAllDecks();
    setDecks(allDecks);

    const deckId = selectedDeckId;
    const s = await getStatsSummary(deckId ?? undefined);
    setSummary(s);
    setDailyReviews(await getDailyReviews(deckId, 30));
    setDailyRatings(await getDailyRatings(deckId, 14));
    setWeakCards(await getWeakCards(deckId, 5));

    if (deckId) {
      setDueForecast(await getDueForecast(deckId, 7));
      setProgress(await getDeckProgress(deckId, 30));
    } else if (allDecks[0]) {
      setDueForecast(await getDueForecast(allDecks[0].id, 7));
      setProgress(await getDeckProgress(allDecks[0].id, 30));
    }
  }, [dbReady, selectedDeckId]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
          tintColor={Colors.primary}
        />
      }
    >
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
        <FilterChip
          label="All Decks"
          selected={selectedDeckId === null}
          onPress={() => setSelectedDeckId(null)}
        />
        {decks.map((d) => (
          <FilterChip
            key={d.id}
            label={d.name}
            selected={selectedDeckId === d.id}
            onPress={() => setSelectedDeckId(d.id)}
          />
        ))}
      </ScrollView>

      {summary && (
        <View style={styles.summaryGrid}>
          <SummaryTile label="Due Today" value={summary.dueToday} />
          <SummaryTile label="Reviews Today" value={summary.reviewsToday} />
          <SummaryTile label="Total Reviews" value={summary.totalReviews} />
          <SummaryTile label="Learned" value={summary.learnedCards} />
          <SummaryTile label="Retention" value={summary.retentionRate} suffix="%" />
          <SummaryTile label="Streak" value={summary.streak} suffix="d" />
        </View>
      )}

      {summary && (
        <ChartCard title="Rating Breakdown">
          <View style={styles.ratingRow}>
            <RatingPill label="Again" count={summary.ratingBreakdown.again} color={Colors.again} />
            <RatingPill label="Hard" count={summary.ratingBreakdown.hard} color={Colors.hard} />
            <RatingPill label="Good" count={summary.ratingBreakdown.good} color={Colors.good} />
            <RatingPill label="Easy" count={summary.ratingBreakdown.easy} color={Colors.easy} />
          </View>
        </ChartCard>
      )}

      <ChartCard title="Daily Reviews (30 days)">
        <DailyReviewsChart data={dailyReviews} />
      </ChartCard>

      <ChartCard title="Daily Ratings (14 days)">
        <RatingStackChart data={dailyRatings} />
      </ChartCard>

      {dueForecast.length > 0 && (
        <ChartCard title="Due Forecast (7 days)">
          <DueForecastChart data={dueForecast} />
        </ChartCard>
      )}

      {progress.length > 0 && (
        <ChartCard title="Deck Progress">
          <ProgressChart data={progress} />
        </ChartCard>
      )}

      {weakCards.length > 0 && (
        <ChartCard title="Weak Cards">
          {weakCards.map((c) => (
            <View key={c.cardId} style={styles.weakItem}>
              <Text style={styles.weakText} numberOfLines={1}>{c.frontText}</Text>
              <Text style={styles.weakCount}>{c.failCount} fails</Text>
            </View>
          ))}
        </ChartCard>
      )}
    </ScrollView>
  );
}

function FilterChip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

function SummaryTile({ label, value, suffix }: { label: string; value: number; suffix?: string }) {
  return (
    <View style={styles.summaryTile}>
      <Text style={styles.summaryValue}>{value}{suffix ?? ''}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function RatingPill({ label, count, color }: { label: string; count: number; color: string }) {
  return (
    <View style={[styles.ratingPill, { borderColor: color }]}>
      <Text style={[styles.ratingPillCount, { color }]}>{count}</Text>
      <Text style={styles.ratingPillLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  filterRow: { marginBottom: Spacing.md, maxHeight: 40 },
  chip: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    marginRight: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  chipSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  chipText: { color: Colors.textMuted, fontSize: FontSize.sm },
  chipTextSelected: { color: Colors.text, fontWeight: '600' },
  summaryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginBottom: Spacing.md },
  summaryTile: {
    width: '30%',
    backgroundColor: Colors.surface,
    borderRadius: 10,
    padding: Spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  summaryValue: { color: Colors.text, fontSize: FontSize.lg, fontWeight: '700' },
  summaryLabel: { color: Colors.textMuted, fontSize: 10, textAlign: 'center', marginTop: 2 },
  ratingRow: { flexDirection: 'row', justifyContent: 'space-around' },
  ratingPill: { alignItems: 'center', borderWidth: 1, borderRadius: 8, padding: Spacing.sm, minWidth: 70 },
  ratingPillCount: { fontSize: FontSize.lg, fontWeight: '700' },
  ratingPillLabel: { color: Colors.textMuted, fontSize: FontSize.sm },
  weakItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  weakText: { color: Colors.text, flex: 1, fontSize: FontSize.sm },
  weakCount: { color: Colors.again, fontSize: FontSize.sm, fontWeight: '600' },
});
