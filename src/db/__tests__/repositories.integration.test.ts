import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, closeTestDb } from '../testDb';
import {
  createDeck,
  createCard,
  upsertScheduling,
  insertReviewLog,
  incrementDailyCounter,
  countDueCards,
  getReviewLogsSince,
  getReviewsToday,
  saveAppSettings,
  getAppSettings,
  getSchedulingStatsRows,
  getReviewLogsDetailedSince,
} from '../repositories';
import { reviewCard } from '@/src/scheduler/reviewCard';
import { getScheduler } from '@/src/scheduler/schedulerFactory';
import { DEFAULT_SM2_CONFIG } from '@/src/constants';

describe('repositories integration', () => {
  beforeEach(async () => {
    await createTestDb();
  });

  afterEach(() => {
    closeTestDb();
  });

  it('creates decks and cards with scheduling', async () => {
    const deck = await createDeck({
      name: 'Spanish',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });

    assert.equal(card.scheduling.phase, 'new');
    assert.equal(card.deckId, deck.id);
  });

  it('logs reviews and reports today counts', async () => {
    const deck = await createDeck({
      name: 'Spanish',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const reviewedAt = new Date();
    const scheduler = getScheduler('sm2');

    await reviewCard(
      {
        scheduler,
        upsertScheduling,
        insertReviewLog,
        incrementDailyCounter,
        config: DEFAULT_SM2_CONFIG,
      },
      card.scheduling,
      'good',
      reviewedAt,
      { sessionId: 'session-1', isNewIntroduction: true },
    );

    const logs = await getReviewLogsSince(deck.id, new Date(reviewedAt.getFullYear(), reviewedAt.getMonth(), reviewedAt.getDate()));
    assert.equal(logs.length, 1);
    assert.equal(await getReviewsToday(deck.id), 1);
  });

  it('counts due cards after scheduling updates', async () => {
    const deck = await createDeck({
      name: 'Spanish',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });

    await upsertScheduling({
      ...card.scheduling,
      phase: 'review',
      dueAt: new Date(Date.now() - 86_400_000),
      reviewCount: 2,
      algorithmState: { ease: 2.5, intervalDays: 3, learningStepIndex: 0 },
    });

    const due = await countDueCards(deck.id, new Date());
    assert.equal(due, 1);
  });

  it('persists app settings', async () => {
    await saveAppSettings({ speechRate: 1.25, handsFreeMode: false });
    const settings = await getAppSettings();
    assert.equal(settings.speechRate, 1.25);
    assert.equal(settings.handsFreeMode, false);
  });

  it('returns scheduling and detailed review stats rows', async () => {
    const deck = await createDeck({
      name: 'Spanish',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const reviewedAt = new Date();
    const scheduler = getScheduler('sm2');
    await reviewCard(
      {
        scheduler,
        upsertScheduling,
        insertReviewLog,
        incrementDailyCounter,
        config: DEFAULT_SM2_CONFIG,
      },
      card.scheduling,
      'good',
      reviewedAt,
    );

    const schedulingRows = await getSchedulingStatsRows();
    const detailed = await getReviewLogsDetailedSince(
      deck.id,
      new Date(reviewedAt.getFullYear(), reviewedAt.getMonth(), reviewedAt.getDate()),
    );
    assert.ok(schedulingRows.some((row) => row.cardId === card.id));
    assert.ok(detailed.some((row) => row.cardId === card.id));
  });
});
