import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildReviewLog } from '../reviewCard';
import { Sm2Scheduler } from '../Sm2Scheduler';
import { DEFAULT_SM2_CONFIG } from '@/src/constants';
import { CardSchedulingState, Rating } from '@/src/models/types';

const scheduler = new Sm2Scheduler();
const now = new Date('2025-06-01T12:00:00');

describe('buildReviewLog', () => {
  it('captures before/after scheduling fields for a rated card', () => {
    const before = scheduler.createInitialState('card-1', 'deck-1', now, DEFAULT_SM2_CONFIG);
    const result = scheduler.scheduleCard(before, 'good', now, DEFAULT_SM2_CONFIG);
    const log = buildReviewLog(before, result, 'good', now, {
      sessionId: 'session-1',
      reviewDurationMs: 1500,
    });

    assert.equal(log.cardId, 'card-1');
    assert.equal(log.deckId, 'deck-1');
    assert.equal(log.sessionId, 'session-1');
    assert.equal(log.rating, 'good');
    assert.equal(log.phaseBefore, 'new');
    assert.equal(log.phaseAfter, result.card.phase);
    assert.equal(log.reviewDurationMs, 1500);
    assert.equal(log.algorithm, 'sm2');
    assert.ok(log.easeBefore != null);
    assert.ok(log.easeAfter != null);
    assert.equal(log.dueAtBefore.getTime(), before.dueAt.getTime());
    assert.equal(log.dueAtAfter.getTime(), result.card.dueAt.getTime());
  });

  it('records scheduled lateness from the prior due date', () => {
    const before: CardSchedulingState = {
      ...scheduler.createInitialState('card-2', 'deck-1', now, DEFAULT_SM2_CONFIG),
      phase: 'review',
      reviewCount: 3,
      dueAt: new Date('2025-05-30T12:00:00'),
      algorithmState: { ease: 2.5, intervalDays: 3, learningStepIndex: 0 },
    };
    const rating: Rating = 'again';
    const result = scheduler.scheduleCard(before, rating, now, DEFAULT_SM2_CONFIG);
    const log = buildReviewLog(before, result, rating, now);

    assert.ok(log.scheduledDaysLate >= 2);
  });
});
