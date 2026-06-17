import {
  CardWithScheduling,
  Rating,
  IntervalPreview,
  Sm2DeckConfig,
} from '@/src/models/types';
import { buildReviewQueue } from '@/src/scheduler/queue';
import { getScheduler } from '@/src/scheduler/schedulerFactory';
import { reviewCard } from '@/src/scheduler/reviewCard';
import {
  getCardsWithScheduling,
  getDeckById,
  getNewCardsIntroducedToday,
  upsertScheduling,
  insertReviewLog,
  incrementDailyCounter,
} from '@/src/db/repositories';
import { generateId } from '@/src/db/mappers';
import { ttsService } from '@/src/services/tts/TtsService';
import { voiceCommandService } from '@/src/services/voice/VoiceCommandService';
import { VoiceCommand } from '@/src/services/voice/commands';
import { ratingFromCommand } from '@/src/services/voice/commandParser';
import { ReviewPhase, VoiceActivity } from './types';

export interface ReviewSessionOptions {
  deckId: string;
  includeNewCards?: boolean;
  speechRate?: number;
  autoPlayFront?: boolean;
  autoPlayBack?: boolean;
  handsFreeMode?: boolean;
}

type StateListener = (state: {
  phase: ReviewPhase;
  voiceActivity: VoiceActivity;
  currentIndex: number;
  totalCards: number;
  cardsReviewed: number;
  isFlipped: boolean;
  currentCard: CardWithScheduling | null;
  previews: Partial<Record<Rating, IntervalPreview>> | null;
}) => void;

export class ReviewSessionController {
  private deckId: string;
  private queue: CardWithScheduling[] = [];
  private currentIndex = 0;
  private cardsReviewed = 0;
  private sessionId: string;
  private phase: ReviewPhase = 'loading';
  private voiceActivity: VoiceActivity = 'idle';
  private isFlipped = false;
  private cardStartTime = 0;
  private config: Sm2DeckConfig | null = null;
  private options: ReviewSessionOptions;
  private listeners: StateListener[] = [];
  private unsubVoice: (() => void) | null = null;
  private destroyed = false;

  constructor(options: ReviewSessionOptions) {
    this.deckId = options.deckId;
    this.options = options;
    this.sessionId = generateId();
  }

  onStateChange(listener: StateListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  private notify(): void {
    const card = this.queue[this.currentIndex] ?? null;
    let previews: Partial<Record<Rating, IntervalPreview>> | null = null;

    if (card && this.config && this.isFlipped) {
      const scheduler = getScheduler(card.scheduling.algorithm);
      previews = scheduler.previewIntervals(
        card.scheduling,
        new Date(),
        this.config,
      );
    }

    for (const l of this.listeners) {
      l({
        phase: this.phase,
        voiceActivity: this.voiceActivity,
        currentIndex: this.currentIndex,
        totalCards: this.queue.length,
        cardsReviewed: this.cardsReviewed,
        isFlipped: this.isFlipped,
        currentCard: card,
        previews,
      });
    }
  }

  async initialize(): Promise<void> {
    const deck = await getDeckById(this.deckId);
    if (!deck) throw new Error('Deck not found');
    this.config = deck.config as Sm2DeckConfig;

    const cards = await getCardsWithScheduling(this.deckId);
    const schedulingStates = cards.map((c) => c.scheduling);
    const introducedToday = await getNewCardsIntroducedToday(this.deckId);

    const queueItems = buildReviewQueue(schedulingStates, new Date(), {
      includeNewCards: this.options.includeNewCards ?? true,
      newCardsLimit: this.config.newCardsPerDay,
      newCardsIntroducedToday: introducedToday,
    });

    const cardMap = new Map(cards.map((c) => [c.scheduling.cardId, c]));
    this.queue = queueItems
      .map((item) => cardMap.get(item.card.cardId))
      .filter((c): c is CardWithScheduling => c !== undefined);

    if (this.queue.length === 0) {
      this.phase = 'complete';
      this.notify();
      return;
    }

    this.currentIndex = 0;
    this.phase = 'front';
    this.isFlipped = false;
    this.cardStartTime = Date.now();
    this.setupVoiceListener();
    this.notify();
    await this.playFrontIfEnabled();
  }

  private setupVoiceListener(): void {
    this.unsubVoice = voiceCommandService.onCommand((cmd) => {
      this.handleCommand(cmd);
    });

  private async handleCommand(cmd: VoiceCommand): Promise<void> {
    if (this.phase === 'complete' || this.phase === 'paused') {
      if (cmd === 'resume') await this.resume();
      if (cmd === 'end') return;
    }

    switch (cmd) {
      case 'flip':
        if (!this.isFlipped) await this.flip();
        break;
      case 'repeat':
        await this.repeat();
        break;
      case 'pause':
        await this.pause();
        break;
      case 'resume':
        await this.resume();
        break;
      case 'end':
        await this.endSession();
        break;
      default: {
        const rating = ratingFromCommand(cmd);
        if (rating && this.isFlipped) await this.rate(rating);
      }
    }
  }

  private async startListening(): Promise<void> {
    if (!this.options.handsFreeMode || this.phase === 'paused') return;
    this.voiceActivity = 'listening';
    this.notify();
    await voiceCommandService.start();
  }

  private async stopListening(): Promise<void> {
    voiceCommandService.stop();
    this.voiceActivity = 'idle';
    this.notify();
  }

  private async playFrontIfEnabled(): Promise<void> {
    const card = this.queue[this.currentIndex];
    if (!card) return;

    if (this.options.autoPlayFront !== false) {
      await this.speakFront();
    } else {
      await this.startListening();
    }
  }

  async speakFront(): Promise<void> {
    const card = this.queue[this.currentIndex];
    if (!card) return;

    await this.stopListening();
    this.phase = 'speaking_front';
    this.voiceActivity = 'speaking';
    this.notify();

    try {
      await ttsService.speak(card.frontText, card.frontLocale, {
        rate: this.options.speechRate,
      });
    } catch {
      // TTS failure — continue to listening
    }

    this.phase = 'front';
    await this.startListening();
  }

  async flip(): Promise<void> {
    if (this.isFlipped) return;
    await this.stopListening();
    this.isFlipped = true;
    this.phase = 'back';
    this.notify();

    if (this.options.autoPlayBack !== false) {
      await this.speakBack();
    } else {
      this.phase = 'rating';
      await this.startListening();
    }
  }

  async speakBack(): Promise<void> {
    const card = this.queue[this.currentIndex];
    if (!card) return;

    this.phase = 'speaking_back';
    this.voiceActivity = 'speaking';
    this.notify();

    try {
      await ttsService.speak(card.backText, card.backLocale, {
        rate: this.options.speechRate,
      });
    } catch {
      // continue
    }

    this.phase = 'rating';
    await this.startListening();
  }

  async repeat(): Promise<void> {
    if (this.isFlipped) {
      await this.speakBack();
    } else {
      await this.speakFront();
    }
  }

  async rate(rating: Rating): Promise<void> {
    const card = this.queue[this.currentIndex];
    if (!card || !this.config) return;

    await this.stopListening();
    await ttsService.stop();

    const isNewIntro =
      card.scheduling.phase === 'new' && card.scheduling.reviewCount === 0;
    const scheduler = getScheduler(card.scheduling.algorithm);

    const result = await reviewCard(
      {
        scheduler,
        upsertScheduling,
        insertReviewLog,
        incrementDailyCounter,
        config: this.config,
      },
      card.scheduling,
      rating,
      new Date(),
      {
        sessionId: this.sessionId,
        reviewDurationMs: Date.now() - this.cardStartTime,
        isNewIntroduction: isNewIntro,
      },
    );

    card.scheduling = result.card;
    this.cardsReviewed++;
    this.currentIndex++;
    this.isFlipped = false;
    this.cardStartTime = Date.now();

    if (this.currentIndex >= this.queue.length) {
      this.phase = 'complete';
      this.voiceActivity = 'idle';
      this.notify();
      return;
    }

    this.phase = 'front';
    this.notify();
    await this.playFrontIfEnabled();
  }

  async pause(): Promise<void> {
    this.phase = 'paused';
    await ttsService.pause();
    voiceCommandService.pause();
    this.voiceActivity = 'idle';
    this.notify();
  }

  async resume(): Promise<void> {
    if (this.phase !== 'paused') return;
    this.phase = this.isFlipped ? 'rating' : 'front';
    ttsService.resume();
    await this.startListening();
  }

  async endSession(): Promise<void> {
    await this.stopListening();
    await ttsService.stop();
    this.phase = 'complete';
    this.voiceActivity = 'idle';
    this.notify();
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubVoice?.();
    voiceCommandService.stop();
    ttsService.stop();
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
