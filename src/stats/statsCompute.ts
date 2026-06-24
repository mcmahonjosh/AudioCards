import { localDateString, startOfDay } from '@/src/db/mappers';
import type { ReviewLogDetailedRow, SchedulingStatsRow } from '@/src/db/repositories';
import {
  classifyAnswerButtonGroup,
  classifyCardCountCategory,
  classifyReviewCategory,
} from './cardState';
import { StatsColors } from './statsColors';

export type StatsRange = '1m' | '3m' | '1y' | 'all';
export type IntervalRange = '1m' | '50p' | '95p' | 'all';

const MS_PER_DAY = 86_400_000;

export function rangeToDays(range: StatsRange): number | null {
  switch (range) {
    case '1m':
      return 30;
    case '3m':
      return 90;
    case '1y':
      return 365;
    case 'all':
      return null;
  }
}

export function rangeToSince(range: StatsRange, now = new Date()): Date {
  const days = rangeToDays(range);
  if (days === null) return new Date(0);
  const since = new Date(now);
  since.setDate(since.getDate() - days);
  since.setHours(0, 0, 0, 0);
  return since;
}

export interface TodayStats {
  studied: boolean;
  reviewCount: number;
  againCount: number;
  passPercent: number;
  learnCount: number;
  reviewPhaseCount: number;
  relearnCount: number;
  timeStudiedMs: number;
}

export function computeTodayStats(
  logs: ReviewLogDetailedRow[],
  now = new Date(),
): TodayStats {
  const todayStart = startOfDay(now).getTime();
  const todayLogs = logs.filter((l) => l.reviewedAt >= todayStart);

  if (todayLogs.length === 0) {
    return {
      studied: false,
      reviewCount: 0,
      againCount: 0,
      passPercent: 0,
      learnCount: 0,
      reviewPhaseCount: 0,
      relearnCount: 0,
      timeStudiedMs: 0,
    };
  }

  let againCount = 0;
  let learnCount = 0;
  let reviewPhaseCount = 0;
  let relearnCount = 0;
  let timeStudiedMs = 0;

  for (const log of todayLogs) {
    if (log.rating === 'again') againCount++;
    const cat = classifyReviewCategory(log.phaseBefore, log.intervalDaysBefore);
    if (cat === 'learning') learnCount++;
    else if (cat === 'relearn') relearnCount++;
    else reviewPhaseCount++;
    timeStudiedMs += log.reviewDurationMs ?? 0;
  }

  const reviewCount = todayLogs.length;
  const passPercent =
    reviewCount > 0 ? Math.round(((reviewCount - againCount) / reviewCount) * 100) : 0;

  return {
    studied: true,
    reviewCount,
    againCount,
    passPercent,
    learnCount,
    reviewPhaseCount,
    relearnCount,
    timeStudiedMs,
  };
}

export interface FutureDuePoint {
  dayOffset: number;
  due: number;
  cumulative: number;
}

export interface FutureDueChartData {
  points: FutureDuePoint[];
  total: number;
  averagePerDay: number;
  dueTomorrow: number;
}

export function computeFutureDueChart(
  rows: SchedulingStatsRow[],
  options: { range: StatsRange; includeBacklog: boolean },
  now = new Date(),
  deckId?: string,
): FutureDueChartData {
  const scoped = deckId ? rows.filter((r) => r.deckId === deckId) : rows;
  const active = scoped.filter((r) => !r.suspended && r.phase !== 'new');
  const todayStart = startOfDay(now).getTime();

  const overdue = active.filter((r) => r.dueAt < todayStart);
  const backlogCount = overdue.length;

  let maxDay = rangeToDays(options.range) ?? 365;
  if (options.range === 'all') {
    const maxDue = active.reduce((max, r) => Math.max(max, r.dueAt), todayStart);
    maxDay = Math.max(30, Math.ceil((maxDue - todayStart) / MS_PER_DAY));
  }

  const points: FutureDuePoint[] = [];
  let cumulative = 0;

  if (options.includeBacklog && backlogCount > 0) {
    const byOffset = new Map<number, number>();
    for (const r of overdue) {
      const dueDay = startOfDay(new Date(r.dueAt)).getTime();
      const daysOverdue = Math.max(1, Math.round((todayStart - dueDay) / MS_PER_DAY));
      const offset = -daysOverdue;
      byOffset.set(offset, (byOffset.get(offset) ?? 0) + 1);
    }
    const offsets = [...byOffset.keys()].sort((a, b) => a - b);
    for (const offset of offsets) {
      const due = byOffset.get(offset) ?? 0;
      cumulative += due;
      points.push({ dayOffset: offset, due, cumulative });
    }
  }

  let total = options.includeBacklog ? backlogCount : 0;
  for (let d = 0; d <= maxDay; d++) {
    const dayStart = todayStart + d * MS_PER_DAY;
    const dayEnd = dayStart + MS_PER_DAY - 1;

    let due: number;
    if (d === 0) {
      due = active.filter((r) => {
        const dueDay = startOfDay(new Date(r.dueAt)).getTime();
        return dueDay === todayStart;
      }).length;
      if (!options.includeBacklog) {
        due += backlogCount;
      }
    } else {
      const targetDay = todayStart + d * MS_PER_DAY;
      due = active.filter((r) => {
        const dueDay = startOfDay(new Date(r.dueAt)).getTime();
        return dueDay === targetDay;
      }).length;
    }

    cumulative += due;
    points.push({ dayOffset: d, due, cumulative });
    total += due;
  }

  const futureDays = maxDay + 1;
  const averagePerDay = futureDays > 0 ? Math.round((total / futureDays) * 10) / 10 : 0;

  const tomorrowStart = todayStart + MS_PER_DAY;
  const dueTomorrow = active.filter((r) => {
    const dueDay = startOfDay(new Date(r.dueAt)).getTime();
    return dueDay === tomorrowStart;
  }).length;

  return { points, total, averagePerDay, dueTomorrow };
}

export interface CalendarCell {
  date: string;
  count: number;
  dow: number;
}

export interface CalendarWeekColumn {
  weekIndex: number;
  cells: (CalendarCell | null)[];
}

export interface CalendarHeatmapData {
  year: number;
  weeks: CalendarWeekColumn[];
  maxCount: number;
}

export function computeCalendarHeatmap(
  logs: ReviewLogDetailedRow[],
  year: number,
): CalendarHeatmapData {
  const counts: Record<string, number> = {};
  for (const log of logs) {
    const d = new Date(log.reviewedAt);
    if (d.getFullYear() !== year) continue;
    const key = localDateString(d);
    counts[key] = (counts[key] ?? 0) + 1;
  }

  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);

  const gridStart = new Date(jan1);
  gridStart.setDate(gridStart.getDate() - gridStart.getDay());

  const gridEnd = new Date(dec31);
  gridEnd.setDate(gridEnd.getDate() + (6 - gridEnd.getDay()));

  const weeks: CalendarWeekColumn[] = [];
  let maxCount = 0;
  let weekIndex = 0;

  for (let d = new Date(gridStart); d <= gridEnd; ) {
    const cells: (CalendarCell | null)[] = [];
    for (let dow = 0; dow < 7; dow++) {
      const inYear = d.getFullYear() === year;
      if (inYear) {
        const date = localDateString(d);
        const count = counts[date] ?? 0;
        maxCount = Math.max(maxCount, count);
        cells.push({ date, count, dow });
      } else {
        cells.push(null);
      }
      d.setDate(d.getDate() + 1);
    }
    weeks.push({ weekIndex, cells });
    weekIndex++;
  }

  return { year, weeks, maxCount };
}

export interface ReviewsDayPoint {
  dayOffset: number;
  learning: number;
  young: number;
  mature: number;
  relearn: number;
  total: number;
  cumulative: number;
}

export interface ReviewsChartData {
  points: ReviewsDayPoint[];
  daysStudied: number;
  daysInPeriod: number;
  daysStudiedPercent: number;
  total: number;
  averageStudiedDays: number;
  averageOverPeriod: number;
}

export function computeReviewsChart(
  logs: ReviewLogDetailedRow[],
  options: { range: StatsRange; mode: 'count' | 'time' },
  now = new Date(),
): ReviewsChartData {
  const days = rangeToDays(options.range) ?? 365;
  const todayStart = startOfDay(now).getTime();
  const periodStart = todayStart - (days - 1) * MS_PER_DAY;

  const byDay = new Map<number, ReviewsDayPoint>();
  for (let i = days - 1; i >= 0; i--) {
    byDay.set(-i, {
      dayOffset: -i,
      learning: 0,
      young: 0,
      mature: 0,
      relearn: 0,
      total: 0,
      cumulative: 0,
    });
  }

  const periodLogs = logs.filter((l) => l.reviewedAt >= periodStart);
  let daysStudied = 0;
  const studiedDays = new Set<number>();

  for (const log of periodLogs) {
    const logDay = startOfDay(new Date(log.reviewedAt)).getTime();
    const dayOffset = Math.round((logDay - todayStart) / MS_PER_DAY);
    const point = byDay.get(dayOffset);
    if (!point) continue;

    studiedDays.add(dayOffset);
    const cat = classifyReviewCategory(log.phaseBefore, log.intervalDaysBefore);
    const value =
      options.mode === 'time' ? (log.reviewDurationMs ?? 0) / 1000 : 1;

    point[cat] += value;
    point.total += value;
  }

  daysStudied = studiedDays.size;
  const points = [...byDay.values()].sort((a, b) => a.dayOffset - b.dayOffset);

  let cumulative = 0;
  let total = 0;
  for (const p of points) {
    cumulative += p.total;
    p.cumulative = cumulative;
    total += p.total;
  }

  const daysInPeriod = days;
  const daysStudiedPercent =
    daysInPeriod > 0 ? Math.round((daysStudied / daysInPeriod) * 100) : 0;
  const averageStudiedDays =
    daysStudied > 0 ? Math.round((total / daysStudied) * 10) / 10 : 0;
  const averageOverPeriod =
    daysInPeriod > 0 ? Math.round((total / daysInPeriod) * 10) / 10 : 0;

  return {
    points,
    daysStudied,
    daysInPeriod,
    daysStudiedPercent,
    total: Math.round(total),
    averageStudiedDays,
    averageOverPeriod,
  };
}

export interface CardCountSlice {
  label: string;
  count: number;
  percent: number;
  color: string;
}

export interface CardCountsData {
  categories: CardCountSlice[];
  /** Cards that have been studied at least once (excludes unseen). */
  total: number;
  pieTotal: number;
}

const CARD_COUNT_LABELS: Record<string, { label: string; color: string }> = {
  learning: { label: 'Learning', color: StatsColors.learning },
  relearning: { label: 'Relearning', color: StatsColors.relearning },
  young: { label: 'Young', color: StatsColors.young },
  mature: { label: 'Mature', color: StatsColors.mature },
  suspended: { label: 'Suspended', color: StatsColors.suspended },
};

export function countNewCardsStudied(logs: ReviewLogDetailedRow[]): number {
  const seen = new Set<string>();
  for (const log of logs) {
    if (log.phaseBefore !== 'new') continue;
    seen.add(log.cardId);
  }
  return seen.size;
}

export function computeCardCounts(
  rows: SchedulingStatsRow[],
  options: { separateSuspended: boolean },
  newCardsStudied = 0,
): CardCountsData {
  const studiedRows = rows.filter((row) => row.phase !== 'new');
  const counts: Record<string, number> = {
    learning: 0,
    relearning: 0,
    young: 0,
    mature: 0,
    suspended: 0,
  };

  for (const row of studiedRows) {
    const suspended = options.separateSuspended && row.suspended;
    const cat = classifyCardCountCategory(
      row.phase,
      row.intervalDays,
      suspended,
    );
    if (cat === 'new') continue;
    counts[cat]++;
  }

  const categories: CardCountSlice[] = [];
  const order = ['learning', 'relearning', 'young', 'mature', 'suspended'] as const;

  if (newCardsStudied > 0) {
    categories.push({
      label: 'New',
      count: newCardsStudied,
      percent: 0,
      color: StatsColors.new,
    });
  }

  for (const key of order) {
    const count = counts[key];
    if (!options.separateSuspended && key === 'suspended') continue;
    if (count === 0 && key === 'suspended' && !options.separateSuspended) continue;
    if (count === 0) continue;

    const meta = CARD_COUNT_LABELS[key];
    categories.push({
      label: meta.label,
      count,
      percent: 0,
      color: meta.color,
    });
  }

  const pieTotal = categories.reduce((sum, cat) => sum + cat.count, 0);
  for (const cat of categories) {
    cat.percent = pieTotal > 0 ? Math.round((cat.count / pieTotal) * 1000) / 10 : 0;
  }

  return { categories, total: studiedRows.length, pieTotal };
}

export interface HistogramBin {
  label: string;
  count: number;
  cumulative: number;
}

export interface IntervalHistogramData {
  bins: HistogramBin[];
  averageInterval: number;
}

export function computeIntervalHistogram(
  rows: SchedulingStatsRow[],
  range: IntervalRange,
): IntervalHistogramData {
  const intervals = rows
    .filter((r) => !r.suspended && r.phase === 'review' && r.intervalDays > 0)
    .map((r) => r.intervalDays)
    .sort((a, b) => a - b);

  if (intervals.length === 0) {
    return { bins: [], averageInterval: 0 };
  }

  let maxInterval = intervals[intervals.length - 1];
  if (range === '1m') maxInterval = Math.min(maxInterval, 30);
  else if (range === '50p') maxInterval = intervals[Math.floor(intervals.length * 0.5)] ?? maxInterval;
  else if (range === '95p') maxInterval = intervals[Math.floor(intervals.length * 0.95)] ?? maxInterval;

  const bucketCount = Math.min(30, Math.max(10, Math.ceil(maxInterval)));
  const bucketSize = maxInterval / bucketCount;
  const bins: HistogramBin[] = [];
  let cumulative = 0;

  for (let i = 0; i < bucketCount; i++) {
    const lo = i * bucketSize;
    const hi = (i + 1) * bucketSize;
    const count = intervals.filter((v) => v >= lo && (i === bucketCount - 1 ? v <= hi : v < hi)).length;
    cumulative += count;
    bins.push({
      label: `${Math.round(lo)}`,
      count,
      cumulative,
    });
  }

  const averageInterval =
    Math.round((intervals.reduce((s, v) => s + v, 0) / intervals.length) * 10) / 10;

  return { bins, averageInterval };
}

export interface EaseHistogramData {
  bins: { label: string; count: number }[];
  averageEasePercent: number;
}

export function computeEaseHistogram(rows: SchedulingStatsRow[]): EaseHistogramData {
  const easeValues = rows
    .filter((r) => !r.suspended && r.phase === 'review' && r.ease != null && r.ease > 0)
    .map((r) => r.ease!);

  if (easeValues.length === 0) {
    return { bins: [], averageEasePercent: 0 };
  }

  const minEase = Math.floor(Math.min(...easeValues) * 10) / 10;
  const maxEase = Math.ceil(Math.max(...easeValues) * 10) / 10;
  const bucketSize = 0.1;
  const bins: { label: string; count: number }[] = [];

  for (let lo = minEase; lo <= maxEase; lo += bucketSize) {
    const hi = lo + bucketSize;
    const count = easeValues.filter((v) => v >= lo && v < hi).length;
    bins.push({ label: `${Math.round(lo * 100)}%`, count });
  }

  const avg = easeValues.reduce((s, v) => s + v, 0) / easeValues.length;
  return { bins, averageEasePercent: Math.round(avg * 100) };
}

export interface HourlyPoint {
  hour: number;
  volume: number;
  passRate: number;
}

export function computeHourlyBreakdown(
  logs: ReviewLogDetailedRow[],
  range: StatsRange,
  now = new Date(),
): HourlyPoint[] {
  const since = rangeToSince(range, now).getTime();
  const filtered = logs.filter((l) => l.reviewedAt >= since);

  const byHour: { volume: number; pass: number }[] = Array.from({ length: 24 }, () => ({
    volume: 0,
    pass: 0,
  }));

  for (const log of filtered) {
    const hour = new Date(log.reviewedAt).getHours();
    byHour[hour].volume++;
    if (log.rating !== 'again') byHour[hour].pass++;
  }

  return byHour.map((h, hour) => ({
    hour,
    volume: h.volume,
    passRate: h.volume > 0 ? Math.round((h.pass / h.volume) * 100) : 0,
  }));
}

export interface AnswerButtonGroupData {
  group: 'learning' | 'young' | 'mature';
  label: string;
  passPercent: number;
  again: number;
  hard: number;
  good: number;
  easy: number;
}

export function computeAnswerButtonGroups(
  logs: ReviewLogDetailedRow[],
  range: StatsRange,
  now = new Date(),
): AnswerButtonGroupData[] {
  const since = rangeToSince(range, now).getTime();
  const filtered = logs.filter((l) => l.reviewedAt >= since);

  const groups: Record<
    'learning' | 'young' | 'mature',
    { again: number; hard: number; good: number; easy: number }
  > = {
    learning: { again: 0, hard: 0, good: 0, easy: 0 },
    young: { again: 0, hard: 0, good: 0, easy: 0 },
    mature: { again: 0, hard: 0, good: 0, easy: 0 },
  };

  for (const log of filtered) {
    const group = classifyAnswerButtonGroup(log.phaseBefore, log.intervalDaysBefore);
    const rating = log.rating as 'again' | 'hard' | 'good' | 'easy';
    if (rating in groups[group]) groups[group][rating]++;
  }

  const labels = { learning: 'Learning', young: 'Young', mature: 'Mature' } as const;

  return (['learning', 'young', 'mature'] as const).map((group) => {
    const g = groups[group];
    const total = g.again + g.hard + g.good + g.easy;
    const passPercent = total > 0 ? Math.round(((total - g.again) / total) * 100) : 0;
    return { group, label: labels[group], passPercent, ...g };
  });
}

export interface AddedDayPoint {
  dayOffset: number;
  count: number;
  cumulative: number;
}

export interface AddedChartData {
  points: AddedDayPoint[];
  total: number;
  averagePerDay: number;
}

export function computeAddedChart(
  logs: ReviewLogDetailedRow[],
  range: StatsRange,
  now = new Date(),
  deckId?: string,
): AddedChartData {
  const scoped = deckId ? logs.filter((l) => l.deckId === deckId) : logs;
  const days = rangeToDays(range) ?? 365;
  const todayStart = startOfDay(now).getTime();
  const periodStart = todayStart - (days - 1) * MS_PER_DAY;

  const byDay = new Map<number, number>();
  for (let i = days - 1; i >= 0; i--) byDay.set(-i, 0);

  const seenCards = new Set<string>();
  let total = 0;

  const periodLogs = scoped
    .filter((l) => l.reviewedAt >= periodStart && l.phaseBefore === 'new')
    .sort((a, b) => a.reviewedAt - b.reviewedAt);

  for (const log of periodLogs) {
    if (seenCards.has(log.cardId)) continue;
    seenCards.add(log.cardId);

    const reviewDay = startOfDay(new Date(log.reviewedAt)).getTime();
    const dayOffset = Math.round((reviewDay - todayStart) / MS_PER_DAY);
    if (byDay.has(dayOffset)) {
      byDay.set(dayOffset, (byDay.get(dayOffset) ?? 0) + 1);
      total++;
    }
  }

  const points: AddedDayPoint[] = [];
  let cumulative = 0;
  for (let i = days - 1; i >= 0; i--) {
    const count = byDay.get(-i) ?? 0;
    cumulative += count;
    points.push({ dayOffset: -i, count, cumulative });
  }

  const averagePerDay = days > 0 ? Math.round((total / days) * 10) / 10 : 0;
  return { points, total, averagePerDay };
}

export function formatDurationMs(ms: number): string {
  const totalSec = Math.round(ms / 1000);
  const min = Math.floor(totalSec / 60);
  const sec = totalSec % 60;
  if (min === 0) return `${sec} seconds`;
  if (sec === 0) return `${min} minutes`;
  return `${min} minutes ${sec} seconds`;
}
