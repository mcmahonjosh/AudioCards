import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createTestDb, closeTestDb } from '../testDb';
import {
  createDeck,
  createCard,
  getCardById,
  getDeckById,
  getCardsByDeck,
  updateDeckLocalesAndVoices,
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
    // New-card introduction is not a "review" — only old cards finished for the day count.
    assert.equal(await getReviewsToday(deck.id), 0);

    const oldCardState = {
      ...card.scheduling,
      phase: 'review' as const,
      reviewCount: 3,
      algorithmState: { ease: 2.5, intervalDays: 1, learningStepIndex: 0 },
    };
    await reviewCard(
      {
        scheduler,
        upsertScheduling,
        insertReviewLog,
        incrementDailyCounter,
        config: DEFAULT_SM2_CONFIG,
      },
      oldCardState,
      'good',
      reviewedAt,
      { sessionId: 'session-1' },
    );
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

  it('updates deck and all cards when changing locales and voices', async () => {
    const deck = await createDeck({
      name: 'Edit Voices',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      frontVoiceId: 'voice.en.old',
      backVoiceId: 'voice.es.old',
    });
    await createCard({
      deckId: deck.id,
      frontText: 'one',
      backText: 'uno',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      frontVoiceId: 'voice.en.old',
      backVoiceId: 'voice.es.old',
    });
    await createCard({
      deckId: deck.id,
      frontText: 'two',
      backText: 'dos',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      frontVoiceId: 'voice.en.old',
      backVoiceId: 'voice.es.old',
    });

    await updateDeckLocalesAndVoices(deck.id, {
      frontLocale: 'en-GB',
      backLocale: 'es-ES',
      frontVoiceId: 'voice.en.new',
      backVoiceId: 'voice.es.new',
    });

    const updatedDeck = await getDeckById(deck.id);
    assert.equal(updatedDeck?.frontLocale, 'en-GB');
    assert.equal(updatedDeck?.backLocale, 'es-ES');
    assert.equal(updatedDeck?.frontVoiceId, 'voice.en.new');
    assert.equal(updatedDeck?.backVoiceId, 'voice.es.new');

    const deckCards = await getCardsByDeck(deck.id);
    assert.equal(deckCards.length, 2);
    for (const card of deckCards) {
      assert.equal(card.frontLocale, 'en-GB');
      assert.equal(card.backLocale, 'es-ES');
      assert.equal(card.frontVoiceId, 'voice.en.new');
      assert.equal(card.backVoiceId, 'voice.es.new');
    }
  });

  it('round-trips voice IDs on settings, decks, and cards', async () => {
    await saveAppSettings({
      defaultFrontVoiceId: 'com.apple.voice.enhanced.en-US.Samantha',
      defaultBackVoiceId: 'com.apple.voice.enhanced.es-MX.Paulina',
    });
    const settings = await getAppSettings();
    assert.equal(settings.defaultFrontVoiceId, 'com.apple.voice.enhanced.en-US.Samantha');
    assert.equal(settings.defaultBackVoiceId, 'com.apple.voice.enhanced.es-MX.Paulina');

    const deck = await createDeck({
      name: 'Voices',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      frontVoiceId: 'com.apple.voice.enhanced.en-US.Samantha',
      backVoiceId: 'com.apple.voice.enhanced.es-MX.Paulina',
    });
    assert.equal(deck.frontVoiceId, 'com.apple.voice.enhanced.en-US.Samantha');
    assert.equal(deck.backVoiceId, 'com.apple.voice.enhanced.es-MX.Paulina');

    const card = await createCard({
      deckId: deck.id,
      frontText: 'hi',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      frontVoiceId: 'com.apple.voice.compact.en-US.Samantha',
      backVoiceId: 'com.apple.voice.compact.es-MX.Paulina',
    });
    assert.equal(card.frontVoiceId, 'com.apple.voice.compact.en-US.Samantha');
    assert.equal(card.backVoiceId, 'com.apple.voice.compact.es-MX.Paulina');

    const reloaded = await getCardById(card.id);
    assert.equal(reloaded?.frontVoiceId, 'com.apple.voice.compact.en-US.Samantha');
    assert.equal(reloaded?.backVoiceId, 'com.apple.voice.compact.es-MX.Paulina');
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
