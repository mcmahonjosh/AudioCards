import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  getEffectiveNewCardsPerDay,
  getDeckNewCardsPerDayMode,
  clampNewCardsPerDay,
} from '../newCardLimits';
import { DEFAULT_SETTINGS } from '@/src/constants';
import { Deck, Sm2DeckConfig } from '@/src/models/types';

function makeDeck(config: Partial<Sm2DeckConfig>): Deck {
  return {
    id: 'd1',
    name: 'Test',
    frontLocale: 'en-US',
    backLocale: 'es-MX',
    frontVoiceId: null,
    backVoiceId: null,
    algorithm: 'sm2',
    config: {
      algorithm: 'sm2',
      learningStepsMinutes: [1, 10],
      relearningStepsMinutes: [10],
      graduatingIntervalDays: 1,
      easyIntervalDays: 4,
      startingEase: 2.5,
      hardMultiplier: 1.2,
      newIntervalAfterLapse: 0,
      againEasePenalty: 0.2,
      hardEasePenalty: 0.15,
      easyEaseBonus: 0.15,
      minimumIntervalAfterLapseDays: 1,
      newCardsPerDay: 20,
      ...config,
    } as Sm2DeckConfig,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe('newCardLimits', () => {
  describe('clampNewCardsPerDay', () => {
    it('clamps to 0-9999', () => {
      assert.equal(clampNewCardsPerDay(-5), 0);
      assert.equal(clampNewCardsPerDay(30.7), 31);
      assert.equal(clampNewCardsPerDay(10000), 9999);
    });
  });

  describe('getDeckNewCardsPerDayMode', () => {
    it('defaults missing mode to global', () => {
      const deck = makeDeck({});
      assert.equal(getDeckNewCardsPerDayMode(deck.config as Sm2DeckConfig), 'global');
    });
  });

  describe('getEffectiveNewCardsPerDay', () => {
    it('uses global limit when mode is global', () => {
      const deck = makeDeck({ newCardsPerDayMode: 'global', newCardsPerDay: 5 });
      assert.equal(
        getEffectiveNewCardsPerDay(deck, { defaultNewCardsPerDay: 30 }),
        30,
      );
    });

    it('uses deck custom limit when mode is custom', () => {
      const deck = makeDeck({ newCardsPerDayMode: 'custom', newCardsPerDay: 15 });
      assert.equal(
        getEffectiveNewCardsPerDay(deck, { defaultNewCardsPerDay: 30 }),
        15,
      );
    });

    it('falls back to DEFAULT_SETTINGS when global setting missing', () => {
      const deck = makeDeck({ newCardsPerDayMode: 'global' });
      assert.equal(
        getEffectiveNewCardsPerDay(deck, {} as { defaultNewCardsPerDay: number }),
        DEFAULT_SETTINGS.defaultNewCardsPerDay,
      );
    });
  });
});
