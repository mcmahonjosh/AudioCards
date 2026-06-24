import {
  getReviewLogsSince,
  getReviewLogsDetailedSince,
  getSchedulingStatsRows,
  countDueCards,
  getReviewsToday,
  getLearnedCardCount,
  getTotalReviews,
} from '@/src/db/repositories';
import { localDateString, startOfDay } from '@/src/db/mappers';
import {
  computeTodayStats,
  computeFutureDueChart,
  computeCalendarHeatmap,
  computeReviewsChart,
  computeCardCounts,
  computeIntervalHistogram,
  computeEaseHistogram,
  computeHourlyBreakdown,
  computeAnswerButtonGroups,
  computeAddedChart,
  countNewCardsStudied,
  rangeToSince,
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
} from './statsCompute';

export type {
  StatsRange,
  IntervalRange,
  TodayStats,
  FutureDueChartData,
  CalendarHeatmapData,
  ReviewsChartData,
  CardCountsData,
  IntervalHistogramData,
  EaseHistogramData,
  HourlyPoint,
  AnswerButtonGroupData,
  AddedChartData,
};

export interface StatsSummary {
  dueToday: number;
  reviewsToday: number;
  totalReviews: number;
  learnedCards: number;
  retentionRate: number;
  streak: number;
  ratingBreakdown: { again: number; hard: number; good: number; easy: number };
}

function computeStreak(logs: { reviewedAt: number }[]): number {
  const days = new Set<string>();
  for (const log of logs) {
    days.add(localDateString(new Date(log.reviewedAt)));
  }

  let streak = 0;
  const today = new Date();
  for (let i = 0; i < 365; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const key = localDateString(d);
    if (days.has(key)) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
}

export async function getStatsSummary(deckId?: string): Promise<StatsSummary> {
  const now = new Date();
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const logs = await getReviewLogsSince(deckId ?? null, since30);

  const ratingBreakdown = { again: 0, hard: 0, good: 0, easy: 0 };
  for (const log of logs) {
    const r = log.rating as keyof typeof ratingBreakdown;
    if (r in ratingBreakdown) ratingBreakdown[r]++;
  }

  const total = logs.length;
  const retentionRate =
    total > 0
      ? Math.round(((total - ratingBreakdown.again) / total) * 100)
      : 0;

  const allLogs = await getReviewLogsSince(deckId ?? null, new Date(0));

  return {
    dueToday: await countDueCards(deckId ?? null, now),
    reviewsToday: await getReviewsToday(deckId),
    totalReviews: await getTotalReviews(deckId),
    learnedCards: await getLearnedCardCount(deckId),
    retentionRate,
    streak: computeStreak(allLogs),
    ratingBreakdown,
  };
}

export async function getTodayStats(deckId?: string): Promise<TodayStats> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const logs = await getReviewLogsDetailedSince(deckId ?? null, start);
  return computeTodayStats(logs);
}

export async function getFutureDueChart(
  deckId: string | undefined,
  options: { range: StatsRange; includeBacklog: boolean },
): Promise<FutureDueChartData> {
  const rows = await getSchedulingStatsRows(deckId);
  return computeFutureDueChart(rows, options, undefined, deckId);
}

export async function getCalendarHeatmap(
  deckId: string | undefined,
  year: number,
): Promise<CalendarHeatmapData> {
  const since = startOfDay(new Date(year, 0, 1));
  const logs = await getReviewLogsDetailedSince(deckId ?? null, since);
  return computeCalendarHeatmap(logs, year);
}

export async function getReviewsChart(
  deckId: string | undefined,
  options: { range: StatsRange; mode: 'count' | 'time' },
): Promise<ReviewsChartData> {
  const since = rangeToSince(options.range);
  const logs = await getReviewLogsDetailedSince(deckId ?? null, since);
  return computeReviewsChart(logs, options);
}

export async function getCardCountsBreakdown(
  deckId: string | undefined,
  options: { separateSuspended: boolean },
): Promise<CardCountsData> {
  const rows = await getSchedulingStatsRows(deckId);
  const logs = await getReviewLogsDetailedSince(deckId ?? null, new Date(0));
  const newCardsStudied = countNewCardsStudied(logs);
  return computeCardCounts(rows, options, newCardsStudied);
}

export async function getIntervalHistogram(
  deckId: string | undefined,
  range: IntervalRange,
): Promise<IntervalHistogramData> {
  const rows = await getSchedulingStatsRows(deckId);
  return computeIntervalHistogram(rows, range);
}

export async function getEaseHistogram(deckId?: string): Promise<EaseHistogramData> {
  const rows = await getSchedulingStatsRows(deckId);
  return computeEaseHistogram(rows);
}

export async function getHourlyBreakdown(
  deckId: string | undefined,
  range: StatsRange,
): Promise<HourlyPoint[]> {
  const since = rangeToSince(range);
  const logs = await getReviewLogsDetailedSince(deckId ?? null, since);
  return computeHourlyBreakdown(logs, range);
}

export async function getAnswerButtonGroups(
  deckId: string | undefined,
  range: StatsRange,
): Promise<AnswerButtonGroupData[]> {
  const since = rangeToSince(range);
  const logs = await getReviewLogsDetailedSince(deckId ?? null, since);
  return computeAnswerButtonGroups(logs, range);
}

export async function getAddedChart(
  deckId: string | undefined,
  range: StatsRange,
): Promise<AddedChartData> {
  const since = rangeToSince(range);
  const logs = await getReviewLogsDetailedSince(deckId ?? null, since);
  return computeAddedChart(logs, range, undefined, deckId);
}

export { formatDurationMs } from './statsCompute';
