import React, { useCallback, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  useWindowDimensions,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import {
  getTodayStats,
  getFutureDueChart,
  getCalendarHeatmap,
  getReviewsChart,
  getCardCountsBreakdown,
  getIntervalHistogram,
  getEaseHistogram,
  getHourlyBreakdown,
  getAnswerButtonGroups,
  getAddedChart,
  formatDurationMs,
  type StatsRange,
  type IntervalRange,
  type TodayStats,
  type FutureDueChartData,
  type CalendarHeatmapData,
  type ReviewsChartData,
  type CardCountsData,
  type IntervalHistogramData,
  type EaseHistogramData,
  type HourlyPoint,
  type AnswerButtonGroupData,
  type AddedChartData,
} from '@/src/stats/StatsAggregator';
import { getAllDecks } from '@/src/db/repositories';
import { Deck } from '@/src/models/types';
import { useAppContext } from '@/src/context/AppContext';
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
  const { dbReady } = useAppContext();
  const [decks, setDecks] = useState<Deck[]>([]);
  const [selectedDeckId, setSelectedDeckId] = useState<string | null>(null);
  const [globalHistory, setGlobalHistory] = useState<GlobalHistory>('12m');
  const [refreshing, setRefreshing] = useState(false);

  const [today, setToday] = useState<TodayStats | null>(null);
  const [futureDueRange, setFutureDueRange] = useState<StatsRange>('1m');
  const [futureDueBacklog, setFutureDueBacklog] = useState(false);
  const [futureDue, setFutureDue] = useState<FutureDueChartData | null>(null);
  const [calendarYear, setCalendarYear] = useState(new Date().getFullYear());
  const [calendar, setCalendar] = useState<CalendarHeatmapData | null>(null);
  const [reviewsRange, setReviewsRange] = useState<StatsRange>('1m');
  const [reviewsTimeMode, setReviewsTimeMode] = useState(false);
  const [reviews, setReviews] = useState<ReviewsChartData | null>(null);
  const [separateSuspended, setSeparateSuspended] = useState(true);
  const [cardCounts, setCardCounts] = useState<CardCountsData | null>(null);
  const [intervalRange, setIntervalRange] = useState<IntervalRange>('1m');
  const [intervals, setIntervals] = useState<IntervalHistogramData | null>(null);
  const [ease, setEase] = useState<EaseHistogramData | null>(null);
  const [hourlyRange, setHourlyRange] = useState<StatsRange>('1m');
  const [hourly, setHourly] = useState<HourlyPoint[]>([]);
  const [answerRange, setAnswerRange] = useState<StatsRange>('1m');
  const [answerButtons, setAnswerButtons] = useState<AnswerButtonGroupData[]>([]);
  const [addedRange, setAddedRange] = useState<StatsRange>('1m');
  const [added, setAdded] = useState<AddedChartData | null>(null);

  useEffect(() => {
    const defaultRange: StatsRange = globalHistory === '12m' ? '1y' : 'all';
    setFutureDueRange(defaultRange === 'all' ? 'all' : '1m');
    setReviewsRange(defaultRange === 'all' ? '1y' : '1m');
    setHourlyRange(defaultRange === 'all' ? '1y' : '1m');
    setAnswerRange(defaultRange === 'all' ? '1y' : '1m');
    setAddedRange(defaultRange === 'all' ? 'all' : '1m');
  }, [globalHistory]);

  const deckId = selectedDeckId ?? undefined;

  const load = useCallback(async () => {
    if (!dbReady) return;
    const allDecks = await getAllDecks();
    setDecks(allDecks);

    const [
      todayData,
      futureDueData,
      calendarData,
      reviewsData,
      countsData,
      intervalData,
      easeData,
      hourlyData,
      answerData,
      addedData,
    ] = await Promise.all([
      getTodayStats(deckId),
      getFutureDueChart(deckId, { range: futureDueRange, includeBacklog: futureDueBacklog }),
      getCalendarHeatmap(deckId, calendarYear),
      getReviewsChart(deckId, { range: reviewsRange, mode: reviewsTimeMode ? 'time' : 'count' }),
      getCardCountsBreakdown(deckId, { separateSuspended }),
      getIntervalHistogram(deckId, intervalRange),
      getEaseHistogram(deckId),
      getHourlyBreakdown(deckId, hourlyRange),
      getAnswerButtonGroups(deckId, answerRange),
      getAddedChart(deckId, addedRange),
    ]);

    setToday(todayData);
    setFutureDue(futureDueData);
    setCalendar(calendarData);
    setReviews(reviewsData);
    setCardCounts(countsData);
    setIntervals(intervalData);
    setEase(easeData);
    setHourly(hourlyData);
    setAnswerButtons(answerData);
    setAdded(addedData);
  }, [
    dbReady,
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

  useFocusEffect(useCallback(() => { load(); }, [load]));

  useEffect(() => {
    if (dbReady) load();
  }, [selectedDeckId, dbReady, load]);

  const selectedDeckName =
    selectedDeckId === null
      ? 'All Decks'
      : decks.find((d) => d.id === selectedDeckId)?.name ?? 'Deck';

  return (
    <ScrollView
      style={styles.container}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={async () => {
            setRefreshing(true);
            await load();
            setRefreshing(false);
          }}
          tintColor={Colors.primary}
        />
      }
    >
      <View style={styles.header}>
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
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[styles.chip, selected && styles.chipSelected]}
      onPress={onPress}
    >
      <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
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
