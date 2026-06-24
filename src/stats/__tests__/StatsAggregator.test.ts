import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { isYoung, isMature, classifyReviewCategory, classifyCardCountCategory } from '../cardState';
import {
  computeTodayStats,
  computeFutureDueChart,
  computeCardCounts,
  computeReviewsChart,
  computeAddedChart,
  computeCalendarHeatmap,
  countNewCardsStudied,
} from '../statsCompute';
import { pastDayScrollX } from '../../components/stats/statsScrollChart';
import type { ReviewLogDetailedRow, SchedulingStatsRow } from '../../db/repositories';

function schedRow(
  overrides: Partial<SchedulingStatsRow> & Pick<SchedulingStatsRow, 'cardId'>,
): SchedulingStatsRow {
  return {
    deckId: 'deck1',
    suspended: false,
    phase: 'review',
    intervalDays: 10,
    ease: 2.5,
    dueAt: Date.now(),
    ...overrides,
  };
}

function logRow(overrides: Partial<ReviewLogDetailedRow>): ReviewLogDetailedRow {
  return {
    reviewedAt: Date.now(),
    rating: 'good',
    deckId: 'deck1',
    cardId: 'c1',
    phaseBefore: 'review',
    intervalDaysBefore: 10,
    easeBefore: 2.5,
    reviewDurationMs: 1000,
    ...overrides,
  };
}

describe('cardState', () => {
  it('young/mature split at 21-day boundary', () => {
    assert.equal(isYoung(20.9), true);
    assert.equal(isYoung(21), false);
    assert.equal(isMature(21), true);
    assert.equal(isMature(20), false);
  });

  it('classifies review logs by phase and interval', () => {
    assert.equal(classifyReviewCategory('learning', 0), 'learning');
    assert.equal(classifyReviewCategory('relearning', 5), 'relearn');
    assert.equal(classifyReviewCategory('review', 5), 'young');
    assert.equal(classifyReviewCategory('review', 21), 'mature');
  });

  it('classifies card count categories', () => {
    assert.equal(classifyCardCountCategory('new', 0, false), 'new');
    assert.equal(classifyCardCountCategory('review', 30, false), 'mature');
    assert.equal(classifyCardCountCategory('review', 5, true), 'suspended');
  });
});

describe('computeTodayStats', () => {
  it('returns empty state when no logs today', () => {
    const yesterday = Date.now() - 86_400_000;
    const result = computeTodayStats([logRow({ reviewedAt: yesterday })]);
    assert.equal(result.studied, false);
    assert.equal(result.reviewCount, 0);
  });

  it('aggregates today review counts', () => {
    const now = new Date();
    now.setHours(12, 0, 0, 0);
    const logs = [
      logRow({ reviewedAt: now.getTime(), rating: 'again', phaseBefore: 'learning' }),
      logRow({ reviewedAt: now.getTime(), rating: 'good', phaseBefore: 'review', intervalDaysBefore: 25 }),
      logRow({ reviewedAt: now.getTime(), rating: 'good', phaseBefore: 'relearning', reviewDurationMs: 2000 }),
    ];
    const result = computeTodayStats(logs, now);
    assert.equal(result.studied, true);
    assert.equal(result.reviewCount, 3);
    assert.equal(result.againCount, 1);
    assert.equal(result.passPercent, 67);
    assert.equal(result.learnCount, 1);
    assert.equal(result.reviewPhaseCount, 1);
    assert.equal(result.relearnCount, 1);
    assert.equal(result.timeStudiedMs, 4000);
  });
});

describe('computeFutureDueChart', () => {
  const now = new Date('2025-06-17T12:00:00');

  it('counts due tomorrow', () => {
    const tomorrow = new Date('2025-06-18T08:00:00').getTime();
    const rows = [
      schedRow({ cardId: 'a', dueAt: tomorrow }),
      schedRow({ cardId: 'b', dueAt: tomorrow }),
      schedRow({ cardId: 'c', dueAt: new Date('2025-06-20').getTime() }),
    ];
    const result = computeFutureDueChart(rows, { range: '1m', includeBacklog: false }, now);
    assert.equal(result.dueTomorrow, 2);
  });

  it('includes backlog on today when backlog disabled', () => {
    const overdue = new Date('2025-06-15T08:00:00').getTime();
    const rows = [schedRow({ cardId: 'a', dueAt: overdue })];
    const result = computeFutureDueChart(rows, { range: '1m', includeBacklog: false }, now);
    const todayPoint = result.points.find((p) => p.dayOffset === 0);
    assert.ok(todayPoint);
    assert.equal(todayPoint!.due, 1);
  });

  it('places backlog in negative offsets when enabled', () => {
    const overdue = new Date('2025-06-15T08:00:00').getTime();
    const rows = [schedRow({ cardId: 'a', dueAt: overdue })];
    const result = computeFutureDueChart(rows, { range: '1m', includeBacklog: true }, now);
    const backlogPoint = result.points.find((p) => p.dayOffset < 0);
    assert.ok(backlogPoint);
    assert.equal(backlogPoint!.due, 1);
    const todayPoint = result.points.find((p) => p.dayOffset === 0);
    assert.equal(todayPoint!.due, 0);
  });

  it('includes backlog in total when backlog enabled', () => {
    const overdue = new Date('2025-06-15T08:00:00').getTime();
    const rows = [schedRow({ cardId: 'a', dueAt: overdue })];
    const result = computeFutureDueChart(rows, { range: '1m', includeBacklog: true }, now);
    assert.equal(result.total, 1);
  });

  it('filters by deck id', () => {
    const tomorrow = new Date('2025-06-18T08:00:00').getTime();
    const rows = [
      schedRow({ cardId: 'a', deckId: 'deck-a', dueAt: tomorrow }),
      schedRow({ cardId: 'b', deckId: 'deck-b', dueAt: tomorrow }),
    ];
    const all = computeFutureDueChart(rows, { range: '1m', includeBacklog: false }, now);
    const deckA = computeFutureDueChart(rows, { range: '1m', includeBacklog: false }, now, 'deck-a');
    assert.equal(all.dueTomorrow, 2);
    assert.equal(deckA.dueTomorrow, 1);
  });
});

describe('computeCardCounts', () => {
  it('excludes unseen cards and includes new studied in pie', () => {
    const rows = [
      schedRow({ cardId: 'a', phase: 'new', intervalDays: 0 }),
      schedRow({ cardId: 'b', phase: 'learning', intervalDays: 0 }),
      schedRow({ cardId: 'c', phase: 'review', intervalDays: 5 }),
      schedRow({ cardId: 'd', phase: 'review', intervalDays: 30 }),
      schedRow({ cardId: 'e', phase: 'relearning', intervalDays: 0 }),
      schedRow({ cardId: 'f', phase: 'review', intervalDays: 10, suspended: true }),
    ];
    const logs = [logRow({ cardId: 'b', phaseBefore: 'new' })];
    const result = computeCardCounts(rows, { separateSuspended: true }, countNewCardsStudied(logs));
    const sum = result.categories.reduce((s, c) => s + c.count, 0);
    assert.equal(sum, result.pieTotal);
    assert.equal(result.total, 5);
    assert.equal(result.categories.find((c) => c.label === 'Unseen'), undefined);
    assert.equal(result.categories.find((c) => c.label === 'New')?.count, 1);
  });

  it('folds suspended into phase categories when not separated', () => {
    const rows = [
      schedRow({ cardId: 'a', phase: 'review', intervalDays: 30, suspended: true }),
      schedRow({ cardId: 'b', phase: 'new', intervalDays: 0 }),
    ];
    const result = computeCardCounts(rows, { separateSuspended: false });
    assert.equal(result.total, 1);
    assert.equal(result.categories.find((c) => c.label === 'Mature')?.count, 1);
    assert.equal(result.categories.find((c) => c.label === 'Suspended'), undefined);
  });

  it('shows new studied count from review logs', () => {
    const rows = [
      schedRow({ cardId: 'a', phase: 'new', intervalDays: 0 }),
      schedRow({ cardId: 'b', phase: 'review', intervalDays: 30 }),
    ];
    const logs = [logRow({ cardId: 'b', phaseBefore: 'new' })];
    const result = computeCardCounts(
      rows,
      { separateSuspended: true },
      countNewCardsStudied(logs),
    );
    assert.equal(result.total, 1);
    assert.equal(result.categories.find((c) => c.label === 'New')?.count, 1);
    assert.equal(result.categories.find((c) => c.label === 'Mature')?.count, 1);
  });
});

describe('computeReviewsChart', () => {
  it('computes days studied percentage', () => {
    const now = new Date('2025-06-17T12:00:00');
    const todayStart = new Date('2025-06-17T00:00:00').getTime();
    const yesterdayStart = todayStart - 86_400_000;
    const logs = [
      logRow({ reviewedAt: todayStart + 3600_000 }),
      logRow({ reviewedAt: yesterdayStart + 3600_000 }),
    ];
    const result = computeReviewsChart(logs, { range: '1m', mode: 'count' }, now);
    assert.equal(result.daysStudied, 2);
    assert.equal(result.daysInPeriod, 30);
    assert.equal(result.daysStudiedPercent, 7);
    assert.equal(result.total, 2);
  });
});

describe('computeCalendarHeatmap', () => {
  it('builds aligned week columns within year padding', () => {
    const logs = [
      logRow({ reviewedAt: new Date('2025-01-15T10:00:00').getTime() }),
      logRow({ reviewedAt: new Date('2025-06-17T10:00:00').getTime() }),
    ];
    const result = computeCalendarHeatmap(logs, 2025);
    assert.ok(result.weeks.length >= 52);
    assert.equal(result.weeks.every((w) => w.cells.length === 7), true);
    const midJan = result.weeks
      .flatMap((w) => w.cells)
      .find((c) => c?.date === '2025-01-15');
    assert.equal(midJan?.count, 1);
  });
});

describe('pastDayScrollX', () => {
  it('adds trailing padding so the last bar is not clipped', () => {
    const x = pastDayScrollX(30, 300);
    assert.ok(x > 0);
  });
});

describe('computeAddedChart', () => {
  it('counts new cards studied per day from review logs', () => {
    const now = new Date('2025-06-17T12:00:00');
    const todayStart = new Date('2025-06-17T00:00:00').getTime();
    const logs = [
      logRow({ cardId: 'c1', reviewedAt: todayStart + 1000, phaseBefore: 'new' }),
      logRow({ cardId: 'c2', reviewedAt: todayStart + 2000, phaseBefore: 'new' }),
      logRow({ cardId: 'c1', reviewedAt: todayStart + 3000, phaseBefore: 'learning' }),
      logRow({ cardId: 'c3', reviewedAt: todayStart + 4000, phaseBefore: 'review' }),
    ];
    const result = computeAddedChart(logs, '1m', now);
    assert.equal(result.total, 2);
    assert.equal(result.points[result.points.length - 1].count, 2);
  });

  it('filters by deck id', () => {
    const now = new Date('2025-06-17T12:00:00');
    const todayStart = new Date('2025-06-17T00:00:00').getTime();
    const logs = [
      logRow({ cardId: 'c1', deckId: 'deck-a', reviewedAt: todayStart + 1000, phaseBefore: 'new' }),
      logRow({ cardId: 'c2', deckId: 'deck-b', reviewedAt: todayStart + 2000, phaseBefore: 'new' }),
    ];
    const all = computeAddedChart(logs, '1m', now);
    const deckA = computeAddedChart(logs, '1m', now, 'deck-a');
    assert.equal(all.total, 2);
    assert.equal(deckA.total, 1);
  });
});
