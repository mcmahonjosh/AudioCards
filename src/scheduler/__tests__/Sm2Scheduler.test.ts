import { describe, it, expect } from 'node:test';
import { Sm2Scheduler } from '../Sm2Scheduler';
import { Sm2DeckConfig, CardSchedulingState } from '@/src/models/types';
import { DEFAULT_SM2_CONFIG } from '@/src/constants';

const config: Sm2DeckConfig = { ...DEFAULT_SM2_CONFIG };
const scheduler = new Sm2Scheduler();

function makeNewCard(): CardSchedulingState {
  return scheduler.createInitialState('card-1', 'deck-1', new Date('2025-01-01T10:00:00'), config);
}

describe('Sm2Scheduler', () => {
  it('creates new card in new phase', () => {
    const card = makeNewCard();
    expect(card.phase).toBe('new');
    expect(scheduler.isNewCard(card)).toBe(true);
  });

  it('transitions new card to learning on good', () => {
    const card = makeNewCard();
    const now = new Date('2025-01-01T10:00:00');
    const result = scheduler.scheduleCard(card, 'good', now, config);
    expect(result.card.phase).toBe('learning');
    expect(result.card.reviewCount).toBe(1);
  });

  it('graduates on easy from new', () => {
    const card = makeNewCard();
    const now = new Date('2025-01-01T10:00:00');
    const result = scheduler.scheduleCard(card, 'easy', now, config);
    expect(result.card.phase).toBe('review');
    expect(result.nextIntervalDays).toBe(config.easyIntervalDays);
  });

  it('lapses review card on again', () => {
    let card = makeNewCard();
    const now = new Date('2025-01-01T10:00:00');
    card = scheduler.scheduleCard(card, 'easy', now, config).card;
    const result = scheduler.scheduleCard(card, 'again', now, config);
    expect(result.card.phase).toBe('relearning');
    expect(result.card.lapseCount).toBe(1);
  });

  it('provides interval previews for all ratings', () => {
    const card = makeNewCard();
    const previews = scheduler.previewIntervals(card, new Date(), config);
    expect(previews.again).toBeDefined();
    expect(previews.hard).toBeDefined();
    expect(previews.good).toBeDefined();
    expect(previews.easy).toBeDefined();
  });
});
