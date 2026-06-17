import {
  getReviewLogsSince,
  countDueCards,
  getReviewsToday,
  getLearnedCardCount,
  getTotalReviews,
  getWeakCards,
  getSchedulingByDeck,
} from '@/src/db/repositories';
import { localDateString, startOfDay } from '@/src/db/mappers';

export interface DailyReviewPoint {
  date: string;
  count: number;
}

export interface DailyRatingPoint {
  date: string;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export interface DueForecastPoint {
  date: string;
  count: number;
}

export interface StatsSummary {
  dueToday: number;
  reviewsToday: number;
  totalReviews: number;
  learnedCards: number;
  retentionRate: number;
  streak: number;
  ratingBreakdown: { again: number; hard: number; good: number; easy: number };
}

function dateRange(days: number): string[] {
  const dates: string[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    dates.push(localDateString(d));
  }
  return dates;
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

export async function getDailyReviews(
  deckId: string | null,
  days = 30,
): Promise<DailyReviewPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const logs = await getReviewLogsSince(deckId, since);

  const counts: Record<string, number> = {};
  for (const d of dateRange(days)) counts[d] = 0;

  for (const log of logs) {
    const key = localDateString(new Date(log.reviewedAt));
    if (key in counts) counts[key]++;
  }

  return dateRange(days).map((date) => ({ date, count: counts[date] }));
}

export async function getDailyRatings(
  deckId: string | null,
  days = 14,
): Promise<DailyRatingPoint[]> {
  const since = new Date();
  since.setDate(since.getDate() - days);
  const logs = await getReviewLogsSince(deckId, since);

  const byDate: Record<string, DailyRatingPoint> = {};
  for (const d of dateRange(days)) {
    byDate[d] = { date: d, again: 0, hard: 0, good: 0, easy: 0 };
  }

  for (const log of logs) {
    const key = localDateString(new Date(log.reviewedAt));
    if (byDate[key]) {
      const r = log.rating as 'again' | 'hard' | 'good' | 'easy';
      byDate[key][r]++;
    }
  }

  return dateRange(days).map((d) => byDate[d]);
}

export async function getDueForecast(
  deckId: string,
  days = 7,
): Promise<DueForecastPoint[]> {
  const scheduling = await getSchedulingByDeck(deckId);
  const now = startOfDay();
  const result: DueForecastPoint[] = [];

  for (let i = 0; i < days; i++) {
    const dayStart = new Date(now);
    dayStart.setDate(dayStart.getDate() + i);
    const dayEnd = new Date(dayStart);
    dayEnd.setHours(23, 59, 59, 999);

    const count = scheduling.filter((s) => {
      const due = s.dueAt.getTime();
      if (i === 0) return due <= dayEnd.getTime() && s.phase !== 'new';
      return due >= dayStart.getTime() && due <= dayEnd.getTime() && s.phase !== 'new';
    }).length;

    result.push({
      date: localDateString(dayStart),
      count,
    });
  }

  return result;
}

export async function getDeckProgress(
  deckId: string,
  days = 30,
): Promise<{ date: string; mature: number }[]> {
  const logs = await getReviewLogsSince(deckId, new Date(Date.now() - days * 86400000));
  const scheduling = await getSchedulingByDeck(deckId);

  const currentMature = scheduling.filter(
    (s) => s.phase === 'review' && s.reviewCount > 0,
  ).length;

  const dates = dateRange(days);
  const progressMap: Record<string, number> = {};
  for (const d of dates) progressMap[d] = currentMature;

  // Approximate historical progress from review logs
  let mature = 0;
  for (const d of dates) {
    const dayEnd = new Date(d);
    dayEnd.setHours(23, 59, 59, 999);
    mature = scheduling.filter(
      (s) =>
        s.phase === 'review' &&
        s.reviewCount > 0 &&
        s.lastReviewedAt &&
        s.lastReviewedAt.getTime() <= dayEnd.getTime(),
    ).length;
    progressMap[d] = mature;
  }

  return dates.map((date) => ({ date, mature: progressMap[date] }));
}

export { getWeakCards };
