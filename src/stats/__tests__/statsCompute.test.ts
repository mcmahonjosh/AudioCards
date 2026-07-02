import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  computeIntervalHistogram,
  computeEaseHistogram,
  computeHourlyBreakdown,
  computeAnswerButtonGroups,
} from '../statsCompute';
import { computeStatsFromRaw } from '../StatsAggregator';
import type { ReviewLogDetailedRow, SchedulingStatsRow } from '../../db/repositories';

const now = new Date('2025-06-01T12:00:00');

function schedRow(
  overrides: Partial<SchedulingStatsRow> & Pick<SchedulingStatsRow, 'cardId'>,
): SchedulingStatsRow {
  return {
    deckId: 'deck1',
    suspended: false,
    phase: 'review',
    intervalDays: 10,
    ease: 2.5,
    dueAt: now.getTime(),
    ...overrides,
  };
}

function logRow(overrides: Partial<ReviewLogDetailedRow>): ReviewLogDetailedRow {
  return {
    reviewedAt: now.getTime(),
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

describe('computeIntervalHistogram', () => {
  it('builds buckets for review intervals', () => {
    const rows = [
      schedRow({ cardId: 'a', intervalDays: 3 }),
      schedRow({ cardId: 'b', intervalDays: 10 }),
      schedRow({ cardId: 'c', intervalDays: 20 }),
    ];
    const result = computeIntervalHistogram(rows, 'all');
    assert.ok(result.bins.length > 0);
    assert.equal(result.bins.reduce((sum, b) => sum + b.count, 0), 3);
    assert.ok(result.averageInterval > 0);
  });
});

describe('computeEaseHistogram', () => {
  it('groups ease percentages', () => {
    const rows = [
      schedRow({ cardId: 'a', ease: 2.3 }),
      schedRow({ cardId: 'b', ease: 2.5 }),
      schedRow({ cardId: 'c', ease: 2.7 }),
    ];
    const result = computeEaseHistogram(rows);
    assert.ok(result.bins.length > 0);
    assert.equal(result.averageEasePercent, 250);
  });
});

describe('computeHourlyBreakdown', () => {
  it('aggregates volume and pass rate by hour', () => {
    const morning = new Date('2025-06-01T09:00:00').getTime();
    const logs = [
      logRow({ reviewedAt: morning, rating: 'good' }),
      logRow({ reviewedAt: morning, rating: 'again' }),
    ];
    const result = computeHourlyBreakdown(logs, '1m', now);
    assert.equal(result[9].volume, 2);
    assert.equal(result[9].passRate, 50);
  });
});

describe('computeAnswerButtonGroups', () => {
  it('groups ratings by card maturity', () => {
    const logs = [
      logRow({ phaseBefore: 'learning', intervalDaysBefore: 0, rating: 'again' }),
      logRow({ phaseBefore: 'review', intervalDaysBefore: 5, rating: 'good' }),
      logRow({ phaseBefore: 'review', intervalDaysBefore: 30, rating: 'easy' }),
    ];
    const groups = computeAnswerButtonGroups(logs, '1m', now);
    assert.equal(groups.find((g) => g.group === 'learning')?.again, 1);
    assert.equal(groups.find((g) => g.group === 'young')?.good, 1);
    assert.equal(groups.find((g) => g.group === 'mature')?.easy, 1);
  });
});

describe('computeStatsFromRaw deck filter', () => {
  it('filters chart inputs by deck id', () => {
    const reviewedAt = Date.now();
    const raw = {
      logs: [
        logRow({ deckId: 'deck-a', cardId: 'a1', reviewedAt }),
        logRow({ deckId: 'deck-b', cardId: 'b1', reviewedAt }),
      ],
      schedulingRows: [
        schedRow({ deckId: 'deck-a', cardId: 'a1', intervalDays: 5 }),
        schedRow({ deckId: 'deck-b', cardId: 'b1', intervalDays: 40 }),
      ],
      decks: [],
      fetchedAt: reviewedAt,
    };

    const filters = {
      deckId: undefined as string | undefined,
      futureDueRange: '1m' as const,
      futureDueBacklog: false,
      calendarYear: new Date().getFullYear(),
      reviewsRange: '1m' as const,
      reviewsTimeMode: false,
      separateSuspended: false,
      intervalRange: 'all' as const,
      hourlyRange: '1m' as const,
      answerRange: '1m' as const,
      addedRange: '1m' as const,
    };

    const all = computeStatsFromRaw(raw, filters);

    const deckA = computeStatsFromRaw(raw, { ...filters, deckId: 'deck-a' });

    assert.equal(all.intervals.averageInterval, 22.5);
    assert.equal(deckA.intervals.averageInterval, 5);
    assert.equal(all.today.reviewCount, 2);
    assert.equal(deckA.today.reviewCount, 1);
  });
});
