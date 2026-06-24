import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { Sm2Scheduler } from '../Sm2Scheduler';
import {
  CardSchedulingState,
  Rating,
  Sm2AlgorithmState,
  Sm2DeckConfig,
} from '@/src/models/types';
import { DEFAULT_SM2_CONFIG } from '@/src/constants';
import {
  addMinutes,
  calendarDaysBetween,
  formatAnkiRatingButtonLabel,
  scheduleReviewDue,
} from '../time';

const config: Sm2DeckConfig = { ...DEFAULT_SM2_CONFIG };
const scheduler = new Sm2Scheduler();
const now = new Date('2025-06-01T12:00:00');

function makeNewCard(): CardSchedulingState {
  return scheduler.createInitialState('card-1', 'deck-1', now, config);
}

function sm2(card: CardSchedulingState): Sm2AlgorithmState {
  return card.algorithmState as Sm2AlgorithmState;
}

function minutesUntil(card: CardSchedulingState): number {
  return (card.dueAt.getTime() - now.getTime()) / (60 * 1000);
}

function learningCard(stepIndex: number): CardSchedulingState {
  const card = makeNewCard();
  return {
    ...card,
    phase: 'learning',
    algorithmState: {
      ease: config.startingEase,
      intervalDays: 0,
      learningStepIndex: stepIndex,
    },
  };
}

function reviewCard(intervalDays: number, ease = 2.5): CardSchedulingState {
  const card = makeNewCard();
  return {
    ...card,
    phase: 'review',
    reviewCount: 3,
    dueAt: now,
    algorithmState: {
      ease,
      intervalDays,
      learningStepIndex: 0,
    },
  };
}

describe('Sm2Scheduler', () => {
  it('creates new card with defaults', () => {
    const card = makeNewCard();
    assert.equal(card.phase, 'new');
    assert.equal(card.reviewCount, 0);
    assert.equal(sm2(card).ease, 2.5);
  });

  it('new card step 0: again 1m, hard ~6m, good 10m, easy 4d', () => {
    const card = makeNewCard();
    const previews = scheduler.previewIntervals(card, now, config);

    assert.equal(previews.again.label, '1m');
    assert.equal(previews.hard.label, '6m');
    assert.equal(previews.good.label, '10m');
    assert.equal(previews.easy.label, '4d');
  });

  it('new card good moves to learning step 1 without incrementing repetitions', () => {
    const result = scheduler.scheduleCard(makeNewCard(), 'good', now, config);
    assert.equal(result.card.phase, 'learning');
    assert.equal(result.card.reviewCount, 0);
    assert.equal(sm2(result.card).learningStepIndex, 1);
    assert.equal(Math.round(minutesUntil(result.card)), 10);
  });

  it('learning step 1: again 1m, hard 10m, good graduates to 1d, easy 4d', () => {
    const card = learningCard(1);
    const previews = scheduler.previewIntervals(card, now, config);

    assert.equal(previews.again.label, '1m');
    assert.equal(previews.hard.label, '10m');
    assert.equal(previews.good.label, '1d');
    assert.equal(previews.easy.label, '4d');
  });

  it('easy from learning schedules dueAt 4 calendar days out (regression)', () => {
    const result = scheduler.scheduleCard(learningCard(0), 'easy', now, config);
    assert.equal(result.card.phase, 'review');
    assert.equal(sm2(result.card).intervalDays, 4);
    assert.equal(result.card.reviewCount, 1);
    assert.equal(calendarDaysBetween(now, result.card.dueAt), 4);
  });

  it('good from learning step 1 graduates to 1 day review', () => {
    const result = scheduler.scheduleCard(learningCard(1), 'good', now, config);
    assert.equal(result.card.phase, 'review');
    assert.equal(sm2(result.card).intervalDays, 1);
    assert.equal(result.card.reviewCount, 1);
    assert.equal(calendarDaysBetween(now, result.card.dueAt), 1);
  });

  it('review again lapses to relearning with 10m due and intervalDays 1', () => {
    const card = reviewCard(10);
    const result = scheduler.scheduleCard(card, 'again', now, config);

    assert.equal(result.card.phase, 'relearning');
    assert.equal(result.card.lapseCount, 1);
    assert.equal(sm2(result.card).intervalDays, 1);
    assert.equal(Math.round(minutesUntil(result.card)), 10);
    assert.equal(sm2(result.card).ease, 2.3);
  });

  it('review hard/good/easy interval math on 10-day card', () => {
    const card = reviewCard(10, 2.5);

    const hard = scheduler.scheduleCard(card, 'hard', now, config);
    assert.equal(sm2(hard.card).intervalDays, 12);
    assert.equal(sm2(hard.card).ease, 2.35);

    const good = scheduler.scheduleCard(card, 'good', now, config);
    assert.equal(sm2(good.card).intervalDays, 25);
    assert.equal(sm2(good.card).ease, 2.5);

    const easy = scheduler.scheduleCard(card, 'easy', now, config);
    assert.equal(sm2(easy.card).intervalDays, 34);
    assert.equal(sm2(easy.card).ease, 2.65);
  });

  it('relearning hard repeats current step', () => {
    const card: CardSchedulingState = {
      ...makeNewCard(),
      phase: 'relearning',
      algorithmState: {
        ease: 2.3,
        intervalDays: 1,
        learningStepIndex: 0,
      },
    };

    const result = scheduler.scheduleCard(card, 'hard', now, config);
    assert.equal(result.card.phase, 'relearning');
    assert.equal(Math.round(minutesUntil(result.card)), 10);
  });

  it('relearning good returns to review with lapse interval', () => {
    const card: CardSchedulingState = {
      ...makeNewCard(),
      phase: 'relearning',
      algorithmState: {
        ease: 2.3,
        intervalDays: 1,
        learningStepIndex: 0,
      },
    };

    const result = scheduler.scheduleCard(card, 'good', now, config);
    assert.equal(result.card.phase, 'review');
    assert.equal(sm2(result.card).intervalDays, 1);
    assert.equal(calendarDaysBetween(now, result.card.dueAt), 1);
  });

  it('provides interval previews for all ratings', () => {
    const previews = scheduler.previewIntervals(makeNewCard(), now, config);
    for (const rating of ['again', 'hard', 'good', 'easy'] as Rating[]) {
      assert.ok(previews[rating]);
    }
  });

  it('learning with out-of-range stepIndex: hard preview is not NaNh', () => {
    const card = learningCard(2);
    const previews = scheduler.previewIntervals(card, now, config);

    assert.equal(previews.hard.label, '10m');
    assert.notEqual(previews.hard.label, 'NaNh');
    for (const rating of ['again', 'hard', 'good', 'easy'] as Rating[]) {
      assert.ok(!previews[rating].label.includes('NaN'));
      assert.ok(Number.isFinite(previews[rating].dueAt.getTime()));
    }
  });

  it('relearning with out-of-range stepIndex: hard preview is 10m', () => {
    const card: CardSchedulingState = {
      ...makeNewCard(),
      phase: 'relearning',
      algorithmState: {
        ease: 2.3,
        intervalDays: 1,
        learningStepIndex: 1,
      },
    };

    const previews = scheduler.previewIntervals(card, now, config);
    assert.equal(previews.hard.label, '10m');
    assert.notEqual(previews.hard.label, 'NaNh');
  });

  it('good preview with corrupt learning stepIndex still has valid dueAt', () => {
    const previews = scheduler.previewIntervals(learningCard(2), now, config);
    assert.ok(Number.isFinite(previews.good.dueAt.getTime()));
    assert.equal(previews.good.label, '1d');
  });
});

describe('formatAnkiRatingButtonLabel', () => {
  const base = new Date('2025-06-01T12:00:00');

  it('formats minutes and days from dueAt', () => {
    assert.equal(
      formatAnkiRatingButtonLabel('again', addMinutes(base, 1), base),
      '1m',
    );
    assert.equal(
      formatAnkiRatingButtonLabel('good', addMinutes(base, 10), base),
      '10m',
    );
    assert.equal(
      formatAnkiRatingButtonLabel('easy', scheduleReviewDue(base, 4), base),
      '4d',
    );
  });

  it('returns em dash for invalid dueAt', () => {
    assert.equal(formatAnkiRatingButtonLabel('hard', new Date(NaN), base), '—');
  });
});
