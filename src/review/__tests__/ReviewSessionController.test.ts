import { describe, it, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { ReviewSessionController } from '../ReviewSessionController';
import { cardMediaService } from '@/src/services/media/CardMediaService';
import { voiceCommandService, type VoiceCommandListener } from '@/src/services/voice/VoiceCommandService';
import { VoiceCommand } from '@/src/services/voice/commands';
import { createTestDb, closeTestDb } from '@/src/db/testDb';
import { createDeck, createCard } from '@/src/db/repositories';
import { DEFAULT_SM2_CONFIG } from '@/src/constants';
import { Sm2Scheduler } from '@/src/scheduler/Sm2Scheduler';

const now = new Date('2025-06-01T12:00:00');
const scheduler = new Sm2Scheduler();
const CARD_DELAY_MS = 1100;

let playSideImpl: typeof cardMediaService.playSide;
let stopMediaImpl: typeof cardMediaService.stop;
let voiceStartImpl: typeof voiceCommandService.start;
let voiceStopImpl: typeof voiceCommandService.stop;
let onCommandImpl: typeof voiceCommandService.onCommand;
let commandListeners: VoiceCommandListener[] = [];
let activeController: ReviewSessionController | null = null;

function emitVoiceCommand(cmd: VoiceCommand): void {
  for (const listener of commandListeners) {
    listener(cmd);
  }
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function trackController(controller: ReviewSessionController): ReviewSessionController {
  activeController = controller;
  return controller;
}

describe('ReviewSessionController', () => {
  beforeEach(async () => {
    await createTestDb();

    commandListeners = [];
    playSideImpl = cardMediaService.playSide.bind(cardMediaService);
    stopMediaImpl = cardMediaService.stop.bind(cardMediaService);
    voiceStartImpl = voiceCommandService.start.bind(voiceCommandService);
    voiceStopImpl = voiceCommandService.stop.bind(voiceCommandService);
    onCommandImpl = voiceCommandService.onCommand.bind(voiceCommandService);

    cardMediaService.playSide = async () => {};
    cardMediaService.stop = async () => {};
    voiceCommandService.start = async () => {};
    voiceCommandService.stop = () => {};
    voiceCommandService.onCommand = (listener) => {
      commandListeners.push(listener);
      return () => {
        commandListeners = commandListeners.filter((l) => l !== listener);
      };
    };
    voiceCommandService.pause = () => {};
  });

  afterEach(() => {
    activeController?.destroy();
    activeController = null;
    cardMediaService.playSide = playSideImpl;
    cardMediaService.stop = stopMediaImpl;
    voiceCommandService.start = voiceStartImpl;
    voiceCommandService.stop = voiceStopImpl;
    voiceCommandService.onCommand = onCommandImpl;
    closeTestDb();
  });

  it('initialize with empty queue completes immediately', async () => {
    const deck = await createDeck({
      name: 'Empty',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });

    const controller = trackController(
      new ReviewSessionController({
        deckId: deck.id,
        autoPlayFront: false,
        handsFreeMode: false,
        initialSnapshot: {
          deck,
          cards: [],
          newCardsIntroducedToday: 0,
        },
      }),
    );

    let phase = 'loading';
    let currentCard: unknown = 'pending';
    controller.onStateChange((state) => {
      phase = state.phase;
      currentCard = state.currentCard;
    });

    await controller.initialize();
    assert.equal(phase, 'complete');
    assert.equal(currentCard, null);
  });

  it('flip then speakBack reaches rating phase', async () => {
    const deck = await createDeck({
      name: 'Study',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      scheduling: scheduler.createInitialState('temp', deck.id, now, DEFAULT_SM2_CONFIG),
    });

    const controller = trackController(
      new ReviewSessionController({
        deckId: deck.id,
        autoPlayFront: false,
        autoPlayBack: false,
        handsFreeMode: false,
        initialSnapshot: {
          deck,
          cards: [card],
          newCardsIntroducedToday: 0,
        },
      }),
    );

    let lastPhase = 'loading';
    let flipped = false;
    controller.onStateChange((state) => {
      lastPhase = state.phase;
      flipped = state.isFlipped;
    });

    await controller.initialize();
    await wait(CARD_DELAY_MS);
    await controller.flip();
    assert.equal(lastPhase, 'rating');
    assert.equal(flipped, true);
  });

  it('rate advances to the next card', async () => {
    const deck = await createDeck({
      name: 'Study',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card1 = await createCard({
      deckId: deck.id,
      frontText: 'one',
      backText: 'uno',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      scheduling: scheduler.createInitialState('c1', deck.id, now, DEFAULT_SM2_CONFIG),
    });
    const card2 = await createCard({
      deckId: deck.id,
      frontText: 'two',
      backText: 'dos',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      scheduling: scheduler.createInitialState('c2', deck.id, now, DEFAULT_SM2_CONFIG),
    });

    const controller = trackController(
      new ReviewSessionController({
        deckId: deck.id,
        autoPlayFront: false,
        autoPlayBack: false,
        handsFreeMode: false,
        initialSnapshot: {
          deck,
          cards: [card1, card2],
          newCardsIntroducedToday: 0,
        },
      }),
    );

    const seenCards: string[] = [];
    let reviewed = 0;
    controller.onStateChange((state) => {
      if (state.currentCard) seenCards.push(state.currentCard.id);
      reviewed = state.cardsReviewed;
    });

    await controller.initialize();
    await wait(CARD_DELAY_MS);
    const firstId = seenCards.at(-1);
    assert.ok(firstId);

    await controller.flip();
    await controller.rate('good');
    await wait(CARD_DELAY_MS);

    assert.equal(reviewed, 1);
    assert.notEqual(seenCards.at(-1), firstId);
  });

  it('endSession during in-flight TTS stays complete', async () => {
    let resolvePlay: (() => void) | undefined;
    cardMediaService.playSide = () =>
      new Promise<void>((resolve) => {
        resolvePlay = resolve;
      });

    const deck = await createDeck({
      name: 'Study',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      scheduling: scheduler.createInitialState('c1', deck.id, now, DEFAULT_SM2_CONFIG),
    });

    const controller = trackController(
      new ReviewSessionController({
        deckId: deck.id,
        autoPlayFront: false,
        handsFreeMode: false,
        initialSnapshot: {
          deck,
          cards: [card],
          newCardsIntroducedToday: 0,
        },
      }),
    );

    let phase = 'loading';
    controller.onStateChange((state) => {
      phase = state.phase;
    });

    await controller.initialize();
    await wait(CARD_DELAY_MS);

    const speakPromise = controller.speakFront();
    await wait(50);
    assert.equal(phase, 'speaking_front');

    await controller.endSession();
    assert.equal(phase, 'complete');

    resolvePlay?.();
    await speakPromise.catch(() => {});
    assert.equal(phase, 'complete');
  });

  it('voice cooldown blocks rating right after TTS', async () => {
    const deck = await createDeck({
      name: 'Study',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'hello',
      backText: 'hola',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      scheduling: scheduler.createInitialState('c1', deck.id, now, DEFAULT_SM2_CONFIG),
    });

    const controller = trackController(
      new ReviewSessionController({
        deckId: deck.id,
        autoPlayFront: false,
        autoPlayBack: true,
        handsFreeMode: true,
        initialSnapshot: {
          deck,
          cards: [card],
          newCardsIntroducedToday: 0,
        },
      }),
    );

    let reviewed = 0;
    controller.onStateChange((state) => {
      reviewed = state.cardsReviewed;
    });

    await controller.initialize();
    await wait(CARD_DELAY_MS);
    await controller.flip();

    emitVoiceCommand('good');
    assert.equal(reviewed, 0);

    await wait(1000);
    emitVoiceCommand('good');
    await wait(50);
    assert.equal(reviewed, 1);
  });

  it('natural queue exhaustion completes session', async () => {
    const deck = await createDeck({
      name: 'Study',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
    });
    const card = await createCard({
      deckId: deck.id,
      frontText: 'only',
      backText: 'solo',
      frontLocale: 'en-US',
      backLocale: 'es-MX',
      scheduling: {
        ...scheduler.createInitialState('c1', deck.id, now, DEFAULT_SM2_CONFIG),
        phase: 'learning',
        reviewCount: 1,
        dueAt: now,
        algorithmState: { ease: 2.5, intervalDays: 0, learningStepIndex: 1 },
      },
    });

    const controller = trackController(
      new ReviewSessionController({
        deckId: deck.id,
        autoPlayFront: false,
        autoPlayBack: false,
        handsFreeMode: false,
        initialSnapshot: {
          deck,
          cards: [card],
          newCardsIntroducedToday: 0,
        },
      }),
    );

    let phase = 'loading';
    controller.onStateChange((state) => {
      phase = state.phase;
    });

    await controller.initialize();
    await wait(CARD_DELAY_MS);
    await controller.flip();
    await controller.rate('good');
    await wait(CARD_DELAY_MS);

    assert.equal(phase, 'complete');
  });
});
