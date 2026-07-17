import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildInitialSessionQueue,
  pickNextCard,
  reinsertCardByDue,
  leavesSessionForToday,
  getDeckSessionCounts,
} from '../sessionQueue';
import { CardSchedulingState, CardWithScheduling } from '@/src/models/types';
import { endOfToday } from '@/src/db/mappers';

const now = new Date('2025-06-01T12:00:00');

function makeScheduling(
  overrides: Partial<CardSchedulingState> & Pick<CardSchedulingState, 'phase'>,
): CardSchedulingState {
  const id = overrides.cardId ?? 'card-1';
  return {
    cardId: id,
    deckId: 'deck-1',
    dueAt: now,
    reviewCount: overrides.phase === 'new' ? 0 : 1,
    lapseCount: 0,
    lastReviewedAt: null,
    algorithm: 'sm2',
    algorithmState: { ease: 2.5, intervalDays: 0, learningStepIndex: 0 },
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function makeCard(
  id: string,
  scheduling: Partial<CardSchedulingState> & Pick<CardSchedulingState, 'phase'>,
): CardWithScheduling {
  const sched = makeScheduling({ cardId: id, ...scheduling });
  return {
    id,
    deckId: 'deck-1',
    frontText: `front ${id}`,
    backText: `back ${id}`,
    frontLocale: 'en-US',
    backLocale: 'es-MX',
    frontVoiceId: null,
    backVoiceId: null,
    contentFormat: 'plain',
    suspended: false,
    createdAt: now,
    updatedAt: now,
    scheduling: sched,
  };
}

describe('buildInitialSessionQueue', () => {
  it('orders learning, review, then new cards', () => {
    const learning = makeCard('l1', {
      phase: 'learning',
      dueAt: new Date('2025-06-01T11:00:00'),
    });
    const review = makeCard('r1', {
      phase: 'review',
      dueAt: new Date('2025-06-01T10:00:00'),
      reviewCount: 2,
      algorithmState: { ease: 2.5, intervalDays: 3, learningStepIndex: 0 },
    });
    const fresh = makeCard('n1', { phase: 'new', reviewCount: 0 });

    const queue = buildInitialSessionQueue([review, fresh, learning], now, {
      includeNewCards: true,
      newCardsLimit: 20,
      newCardsIntroducedToday: 0,
    });

    assert.deepEqual(
      queue.map((c) => c.id),
      ['l1', 'r1', 'n1'],
    );
  });

  it('respects new-card daily limit', () => {
    const cards = [
      makeCard('n1', { phase: 'new' }),
      makeCard('n2', { phase: 'new' }),
      makeCard('n3', { phase: 'new' }),
    ];
    const queue = buildInitialSessionQueue(cards, now, {
      includeNewCards: true,
      newCardsLimit: 2,
      newCardsIntroducedToday: 1,
    });
    assert.equal(queue.length, 1);
    assert.equal(queue[0].id, 'n1');
  });

  it('excludes new cards when includeNewCards is false', () => {
    const cards = [
      makeCard('n1', { phase: 'new' }),
      makeCard('r1', {
        phase: 'review',
        dueAt: new Date('2025-06-01T10:00:00'),
        reviewCount: 1,
        algorithmState: { ease: 2.5, intervalDays: 1, learningStepIndex: 0 },
      }),
    ];
    const queue = buildInitialSessionQueue(cards, now, {
      includeNewCards: false,
      newCardsLimit: 20,
      newCardsIntroducedToday: 0,
    });
    assert.deepEqual(queue.map((c) => c.id), ['r1']);
  });
});

describe('pickNextCard', () => {
  it('prefers learning before review and new', () => {
    const queue = [
      makeCard('n1', { phase: 'new' }),
      makeCard('r1', {
        phase: 'review',
        dueAt: new Date('2025-06-01T10:00:00'),
        reviewCount: 2,
        algorithmState: { ease: 2.5, intervalDays: 2, learningStepIndex: 0 },
      }),
      makeCard('l1', {
        phase: 'learning',
        dueAt: new Date('2025-06-01T11:30:00'),
        reviewCount: 1,
      }),
    ];
    const pick = pickNextCard(queue, now);
    assert.equal(pick.type, 'card');
    if (pick.type === 'card') assert.equal(queue[pick.index].id, 'l1');
  });

  it('picks intraday future learning when nothing else is due', () => {
    const queue = [
      makeCard('l1', {
        phase: 'learning',
        dueAt: new Date('2025-06-01T18:00:00'),
        reviewCount: 1,
      }),
    ];
    const pick = pickNextCard(queue, now);
    assert.equal(pick.type, 'card');
    if (pick.type === 'card') assert.equal(queue[pick.index].id, 'l1');
  });

  it('returns done for empty queue', () => {
    assert.deepEqual(pickNextCard([], now), { type: 'done' });
  });
});

describe('reinsertCardByDue', () => {
  it('keeps cards sorted by due time', () => {
    const early = makeCard('e', {
      phase: 'learning',
      dueAt: new Date('2025-06-01T14:00:00'),
      reviewCount: 1,
    });
    const late = makeCard('l', {
      phase: 'learning',
      dueAt: new Date('2025-06-01T16:00:00'),
      reviewCount: 1,
    });
    const middle = makeCard('m', {
      phase: 'learning',
      dueAt: new Date('2025-06-01T15:00:00'),
      reviewCount: 1,
    });

    const queue = reinsertCardByDue([early, late], middle);
    assert.deepEqual(
      queue.map((c) => c.id),
      ['e', 'm', 'l'],
    );
  });
});

describe('leavesSessionForToday', () => {
  it('returns true when due is tomorrow', () => {
    const tomorrow = new Date(endOfToday(now).getTime() + 60_000);
    assert.equal(leavesSessionForToday(tomorrow, now), true);
  });

  it('returns false when due is later today', () => {
    const laterToday = new Date('2025-06-01T18:00:00');
    assert.equal(leavesSessionForToday(laterToday, now), false);
  });
});

describe('getDeckSessionCounts', () => {
  it('matches queue semantics for mixed cards', () => {
    const cards = [
      makeCard('l1', {
        phase: 'learning',
        dueAt: new Date('2025-06-01T18:00:00'),
        reviewCount: 1,
      }),
      makeCard('r1', {
        phase: 'review',
        dueAt: new Date('2025-06-01T10:00:00'),
        reviewCount: 2,
        algorithmState: { ease: 2.5, intervalDays: 2, learningStepIndex: 0 },
      }),
      makeCard('n1', { phase: 'new' }),
      makeCard('n2', { phase: 'new' }),
    ];

    const counts = getDeckSessionCounts(cards, now, {
      newCardsLimit: 1,
      newCardsIntroducedToday: 0,
    });

    assert.deepEqual(counts, { new: 1, learning: 1, review: 1 });
  });
});
