import React, { useCallback, useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import {
  computeStatsFromRaw,
  formatDurationMs,
  type StatsRange,
  type IntervalRange,
} from '@/src/stats/StatsAggregator';
import { useStatsContext } from '@/src/context/StatsContext';
import {
  StatsSectionCard,
  StatsRadioRow,
  StatsCheckbox,
  StatsSummaryRow,
} from '@/src/components/stats/StatsLayout';
import { FutureDueChart } from '@/src/components/stats/FutureDueChart';
import { CalendarHeatmap } from '@/src/components/stats/CalendarHeatmap';
import { ReviewsChart } from '@/src/components/stats/ReviewsChart';
import { CardCountsPie } from '@/src/components/stats/CardCountsPie';
import { IntervalHistogram } from '@/src/components/stats/IntervalHistogram';
import { EaseHistogram } from '@/src/components/stats/EaseHistogram';
import { HourlyChart } from '@/src/components/stats/HourlyChart';
import { AnswerButtonsChart } from '@/src/components/stats/AnswerButtonsChart';
import { AddedChart } from '@/src/components/stats/AddedChart';

type GlobalHistory = '12m' | 'all';

const PERIOD_OPTIONS: { value: StatsRange; label: string }[] = [
  { value: '1m', label: '1 month' },
  { value: '3m', label: '3 months' },
  { value: '1y', label: '1 year' },
  { value: 'all', label: 'all' },
];

const REVIEWS_PERIOD_OPTIONS = PERIOD_OPTIONS.filter((o) => o.value !== 'all');

const INTERVAL_OPTIONS: { value: IntervalRange; label: string }[] = [
  { value: '1m', label: '1 month' },
  { value: '50p', label: '50%' },
  { value: '95p', label: '95%' },
  { value: 'all', label: 'all' },
];

export default function StatsScreen() {
  const { width } = useWindowDimensions();
  const { rawData, status, isRefreshing, isStale, refreshStatsData } = useStatsContext();
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [globalHistory, setGlobalHistory] = useState<GlobalHistory>('12m');
  const [refreshing, setRefreshing] = useState(false);

  const [futureDueRange, setFutureDueRange] = useState<StatsRange>('1m');
  const [futureDueBacklog, setFutureDueBacklog] = useState(false);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [reviewsRange, setReviewsRange] = useState<StatsRange>('1m');
  const [reviewsTimeMode, setReviewsTimeMode] = useState(false);
  const [separateSuspended, setSeparateSuspended] = useState(true);
  const [intervalRange, setIntervalRange] = useState<IntervalRange>('1m');
  const [hourlyRange, setHourlyRange] = useState<StatsRange>('1m');
  const [answerRange, setAnswerRange] = useState<StatsRange>('1m');
  const [addedRange, setAddedRange] = useState<StatsRange>('1m');

  useEffect(() => {
    const defaultRange: StatsRange = globalHistory === '12m' ? '1y' : 'all';
    setFutureDueRange(defaultRange === 'all' ? 'all' : '1m');
    setReviewsRange(defaultRange === 'all' ? '1y' : '1m');
    setHourlyRange(defaultRange === 'all' ? '1y' : '1m');
    setAnswerRange(defaultRange === 'all' ? '1y' : '1m');
    setAddedRange(defaultRange === 'all' ? 'all' : '1m');
  }, [globalHistory]);

  const deckId = selectedDeckId ?? undefined;
  const decks = rawData?.decks ?? [];

  const computed = useMemo(() => {
    if (!rawData) return null;
    return computeStatsFromRaw(rawData, {
      deckId,
      futureDueRange,
      futureDueBacklog,
      calendarYear,
      reviewsRange,
      reviewsTimeMode,
      separateSuspended,
      intervalRange,
      hourlyRange,
      answerRange,
      addedRange,
    });
  }, [
    rawData,
    deckId,
    futureDueRange,
    futureDueBacklog,
    calendarYear,
    reviewsRange,
    reviewsTimeMode,
    separateSuspended,
    intervalRange,
    hourlyRange,
    answerRange,
    addedRange,
  ]);

  useFocusEffect(
    useCallback(() => {
      const task = InteractionManager.runAfterInteractions(() => {
        if (isStale || !rawData) {
          void refreshStatsData();
        }
      });
      return () => task.cancel();
    }, [isStale, rawData, refreshStatsData]),
  );

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshStatsData();
    setRefreshing(false);
  }, [refreshStatsData]);

  const selectedDeckName =
    selectedDeckId === null
      ? 'All Decks'
      : decks.find((d) => d.id === selectedDeckId)?.name ?? 'Deck';

  const showColdLoading = status === 'loading' && !rawData;
  const showError = status === 'error' && !rawData;

  if (showColdLoading) {
    return (
      <View style={styles.loadingContainer}>
        <View style={styles.header}>
          <Text style={styles.loadingTitle}>Stats</Text>
        </View>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading stats…</Text>
      </View>
    );
  }

  if (showError) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.loadingText}>Could not load stats.</Text>
        <TouchableOpacity onPress={() => void refreshStatsData()}>
          <Text style={styles.retryText}>Tap to retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const today = computed?.today ?? null;
  const futureDue = computed?.futureDue ?? null;
  const calendar = computed?.calendar ?? null;
  const reviews = computed?.reviews ?? null;
  const cardCounts = computed?.cardCounts ?? null;
  const intervals = computed?.intervals ?? null;
  const ease = computed?.ease ?? null;
  const hourly = computed?.hourly ?? [];
  const answerButtons = computed?.answerButtons ?? [];
  const added = computed?.added ?? null;

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing || isRefreshing}
          onRefresh={handleRefresh}
          tintColor={Colors.primary}
        />
      }
    >
      {isRefreshing && rawData ? (
        <Text style={styles.updatingText}>Updating…</Text>
      ) : null}

      <View style={styles.header}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterRow}>
          <FilterChip
            label="All Decks"
            testID="stats-filter-all"
            selected={selectedDeckId === null}
            onPress={() => setSelectedDeckId(null)}
          />
          {decks.map((d) => (
            <FilterChip
              key={d.id}
              label={d.name}
              testID={`stats-filter-deck-${d.id}`}
              selected={selectedDeckId === d.id}
              onPress={() => setSelectedDeckId(d.id)}
            />
          ))}
        </ScrollView>
        <Text style={styles.scopeLabel}>{selectedDeckName}</Text>
        <StatsRadioRow
          options={[
            { value: '12m' as GlobalHistory, label: '12 months' },
            { value: 'all' as GlobalHistory, label: 'All history' },
          ]}
          value={globalHistory}
          onChange={setGlobalHistory}
        />
      </View>

      <StatsSectionCard title="Today">
        {today && !today.studied ? (
          <Text style={styles.prose}>No cards have been studied today.</Text>
        ) : today ? (
          <Text style={styles.prose}>
            {today.reviewCount} reviews, {today.againCount} again ({today.passPercent}% pass),{' '}
            {today.learnCount} learn, {today.reviewPhaseCount} review, {today.relearnCount}{' '}
            relearn, {formatDurationMs(today.timeStudiedMs)} studied
          </Text>
        ) : null}
      </StatsSectionCard>

      <StatsSectionCard
        title="Future Due"
        subtitle="The number of reviews due in the future."
      >
        <StatsCheckbox label="Backlog" value={futureDueBacklog} onChange={setFutureDueBacklog} />
        <StatsRadioRow options={PERIOD_OPTIONS} value={futureDueRange} onChange={setFutureDueRange} />
        {futureDue && futureDue.points.length > 0 && (
          <FutureDueChart data={futureDue} width={width} />
        )}
        {futureDue && (
          <StatsSummaryRow
            lines={[
              `Total: ${futureDue.total} reviews`,
              `Average: ${futureDue.averagePerDay} reviews/day`,
              `Due tomorrow: ${futureDue.dueTomorrow} reviews`,
            ]}
          />
        )}
      </StatsSectionCard>

      <StatsSectionCard title="Calendar">
        {calendar && (
          <CalendarHeatmap data={calendar} onYearChange={setCalendarYear} />
        )}
      </StatsSectionCard>

      <StatsSectionCard
        title="Reviews"
        subtitle={
          reviewsTimeMode
            ? 'The time you have spent reviewing.'
            : 'The number of questions you have answered.'
        }
      >
        <StatsCheckbox label="Time" value={reviewsTimeMode} onChange={setReviewsTimeMode} />
        <StatsRadioRow
          options={REVIEWS_PERIOD_OPTIONS}
          value={reviewsRange}
          onChange={setReviewsRange}
        />
        {reviews && reviews.points.length > 0 && (
          <ReviewsChart data={reviews} width={width} timeMode={reviewsTimeMode} />
        )}
        {reviews && (
          <StatsSummaryRow
            lines={[
              `Days studied: ${reviews.daysStudied} of ${reviews.daysInPeriod} (${reviews.daysStudiedPercent}%)`,
              reviewsTimeMode
                ? `Total: ${reviews.total} seconds`
                : `Total: ${reviews.total} reviews`,
              reviewsTimeMode
                ? `Average for days studied: ${reviews.averageStudiedDays} seconds/day`
                : `Average for days studied: ${reviews.averageStudiedDays} reviews/day`,
              reviewsTimeMode
                ? `Average over period: ${reviews.averageOverPeriod} seconds/day`
                : `Average over period: ${reviews.averageOverPeriod} reviews/day`,
            ]}
          />
        )}
      </StatsSectionCard>

      <StatsSectionCard title="Card Counts">
        <StatsCheckbox
          label="Separate suspended cards"
          value={separateSuspended}
          onChange={setSeparateSuspended}
        />
        {cardCounts && <CardCountsPie data={cardCounts} />}
      </StatsSectionCard>

      <StatsSectionCard
        title="Review Intervals"
        subtitle="Delays until reviews are shown again."
      >
        <StatsRadioRow options={INTERVAL_OPTIONS} value={intervalRange} onChange={setIntervalRange} />
        {intervals && intervals.bins.length > 0 && (
          <IntervalHistogram data={intervals} width={width} />
        )}
        {intervals && (
          <StatsSummaryRow lines={[`Average interval: ${intervals.averageInterval} days`]} />
        )}
      </StatsSectionCard>

      <StatsSectionCard
        title="Card Ease"
        subtitle="The lower the ease, the more frequently a card will appear."
      >
        {ease && ease.bins.length > 0 && <EaseHistogram data={ease} width={width} />}
        {ease && (
          <StatsSummaryRow lines={[`Average ease: ${ease.averageEasePercent}%`]} />
        )}
      </StatsSectionCard>

      <StatsSectionCard
        title="Hourly Breakdown"
        subtitle="Review success rate for each hour of the day."
      >
        <StatsRadioRow
          options={REVIEWS_PERIOD_OPTIONS}
          value={hourlyRange}
          onChange={setHourlyRange}
        />
        {hourly.some((h) => h.volume > 0) && <HourlyChart data={hourly} width={width} />}
      </StatsSectionCard>

      <StatsSectionCard
        title="Answer Buttons"
        subtitle="The number of times you have pressed each button."
      >
        <StatsRadioRow options={REVIEWS_PERIOD_OPTIONS} value={answerRange} onChange={setAnswerRange} />
        {answerButtons.some((g) => g.again + g.hard + g.good + g.easy > 0) && (
          <AnswerButtonsChart data={answerButtons} width={width} />
        )}
      </StatsSectionCard>

      <StatsSectionCard title="Added" subtitle="The number of new cards you have studied.">
        <StatsRadioRow options={PERIOD_OPTIONS} value={addedRange} onChange={setAddedRange} />
        {added && added.points.length > 0 && <AddedChart data={added} width={width} />}
        {added && (
          <StatsSummaryRow
            lines={[
              `Total: ${added.total} new cards studied`,
              `Average: ${added.averagePerDay} new cards/day`,
            ]}
          />
        )}
      </StatsSectionCard>
    </ScrollView>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
  testID,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  return (
    <TouchableOpacity
      testID={testID}
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  loadingContainer: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.md,
  },
  loadingTitle: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginBottom: Spacing.lg,
  },
  loadingText: { color: Colors.textMuted, fontSize: FontSize.md },
  retryText: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '600' },
  updatingText: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  header: { marginBottom: Spacing.sm },
  filterRow: { marginBottom: Spacing.sm, maxHeight: 40 },
  scopeLabel: { color: Colors.textMuted, fontSize: FontSize.sm, marginBottom: Spacing.xs },
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
  prose: { color: Colors.textSecondary, fontSize: FontSize.sm, lineHeight: 22 },
});
