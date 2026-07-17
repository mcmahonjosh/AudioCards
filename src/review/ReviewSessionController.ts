import {
  CardWithScheduling,
  Rating,
  IntervalPreview,
  Sm2DeckConfig,
} from '@/src/models/types';
import {
  buildInitialSessionQueue,
  countSessionQueue,
  leavesSessionForToday,
  pickNextCard,
  reinsertCardByDue,
  SessionCounts,
} from '@/src/scheduler/sessionQueue';
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
import { DEFAULT_SETTINGS } from '@/src/constants';
import { getEffectiveNewCardsPerDay } from '@/src/scheduler/newCardLimits';
import { ttsService } from '@/src/services/tts/TtsService';
import { cardMediaService } from '@/src/services/media/CardMediaService';
import { voiceCommandService } from '@/src/services/voice/VoiceCommandService';
import { invalidateStatsData } from '@/src/context/statsInvalidation';
import { invalidateDeck } from '@/src/context/deckInvalidation';
import { ReviewInitialSnapshot } from '@/src/context/deckSnapshot';
import { VoiceCommand } from '@/src/services/voice/commands';
import { ratingFromCommand } from '@/src/services/voice/commandParser';
import { ReviewPhase, VoiceActivity } from './types';

export interface ReviewSessionOptions {
  deckId: string;
  includeNewCards?: boolean;
  defaultNewCardsPerDay?: number;
  speechRate?: number;
  speechVolume?: number;
  autoPlayFront?: boolean;
  autoPlayBack?: boolean;
  handsFreeMode?: boolean;
  initialSnapshot?: ReviewInitialSnapshot;
}

type StateListener = (state: {
  phase: ReviewPhase;
  voiceActivity: VoiceActivity;
  sessionCounts: SessionCounts;
  cardsReviewed: number;
  isFlipped: boolean;
  currentCard: CardWithScheduling | null;
  previews: Partial<Record<Rating, IntervalPreview>> | null;
}) => void;

const CARD_SPEAK_DELAY_MS = 250;
const VOICE_COMMAND_COOLDOWN_MS = 100;

export class ReviewSessionController {
  private deckId: string;
  private queue: CardWithScheduling[] = [];
  private currentCard: CardWithScheduling | null = null;
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
  private cardTransitionTimer: ReturnType<typeof setTimeout> | null = null;
  private destroyed = false;
  private sessionEnded = false;
  private voiceCommandAllowedAfter = 0;

  private openVoiceCommandsAfterTts(): void {
    this.voiceCommandAllowedAfter = Date.now() + VOICE_COMMAND_COOLDOWN_MS;
  }

  private isVoiceCommandAllowed(cmd: VoiceCommand): boolean {
    if (this.phase === 'speaking_front' || this.phase === 'speaking_back') {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] command blocked: card still speaking', {
          command: cmd,
          phase: this.phase,
        });
      }
      return false;
    }
    if (Date.now() >= this.voiceCommandAllowedAfter) return true;
    const rating = ratingFromCommand(cmd);
    // Block rating/end briefly against TTS echo; allow flip/repeat immediately.
    if (rating || cmd === 'end') {
      if (typeof __DEV__ !== 'undefined' && __DEV__) {
        console.log('[VOICE] command blocked: post-TTS cooldown', {
          command: cmd,
          remainingMs: this.voiceCommandAllowedAfter - Date.now(),
        });
      }
      return false;
    }
    return true;
  }

  private handsFreeEnabled(): boolean {
    return !!this.options.handsFreeMode;
  }

  private async beginListeningAfterSpeech(): Promise<void> {
    if (!this.handsFreeEnabled() || !this.isSessionActive() || this.phase === 'paused') return;
    // Fresh recognizer after TTS — avoids card-audio echo poisoning the first listen turn.
    voiceCommandService.stop();
    voiceCommandService.flushEcho();
    this.voiceActivity = 'listening';
    this.notify();
    await voiceCommandService.start();
  }

  private isSessionActive(): boolean {
    return !this.destroyed && !this.sessionEnded && this.phase !== 'complete';
  }

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
    let previews: Partial<Record<Rating, IntervalPreview>> | null = null;

    if (this.currentCard && this.config && this.isFlipped) {
      const scheduler = getScheduler(this.currentCard.scheduling.algorithm);
      previews = scheduler.previewIntervals(
        this.currentCard.scheduling,
        new Date(),
        this.config,
      );
    }

    for (const l of this.listeners) {
      l({
        phase: this.phase,
        voiceActivity: this.voiceActivity,
        sessionCounts: countSessionQueue(this.queue),
        cardsReviewed: this.cardsReviewed,
        isFlipped: this.isFlipped,
        currentCard: this.currentCard,
        previews,
      });
    }
  }

  async initialize(): Promise<void> {
    const snapshot = this.options.initialSnapshot;

    if (snapshot) {
      this.config = snapshot.deck.config as Sm2DeckConfig;
      const newCardsLimit = getEffectiveNewCardsPerDay(snapshot.deck, {
        defaultNewCardsPerDay:
          this.options.defaultNewCardsPerDay ?? DEFAULT_SETTINGS.defaultNewCardsPerDay,
      });

      this.queue = buildInitialSessionQueue(snapshot.cards, new Date(), {
        includeNewCards: this.options.includeNewCards ?? true,
        newCardsLimit,
        newCardsIntroducedToday: snapshot.newCardsIntroducedToday,
      });
    } else {
      const deck = await getDeckById(this.deckId);
      if (!deck) throw new Error('Deck not found');
      this.config = deck.config as Sm2DeckConfig;

      const cards = await getCardsWithScheduling(this.deckId);
      const introducedToday = await getNewCardsIntroducedToday(this.deckId);
      const newCardsLimit = getEffectiveNewCardsPerDay(deck, {
        defaultNewCardsPerDay:
          this.options.defaultNewCardsPerDay ?? DEFAULT_SETTINGS.defaultNewCardsPerDay,
      });

      this.queue = buildInitialSessionQueue(cards, new Date(), {
        includeNewCards: this.options.includeNewCards ?? true,
        newCardsLimit,
        newCardsIntroducedToday: introducedToday,
      });
    }

    if (this.queue.length === 0) {
      this.phase = 'complete';
      this.notify();
      return;
    }

    this.setupVoiceListener();
    await this.advanceToNext();
  }

  private cancelCardTransition(): void {
    if (this.cardTransitionTimer) {
      clearTimeout(this.cardTransitionTimer);
      this.cardTransitionTimer = null;
    }
  }

  private delayBeforeCardSpeak(): Promise<void> {
    this.cancelCardTransition();
    return new Promise((resolve) => {
      this.cardTransitionTimer = setTimeout(() => {
        this.cardTransitionTimer = null;
        resolve();
      }, CARD_SPEAK_DELAY_MS);
    });
  }

  private async advanceToNext(): Promise<void> {
    if (!this.isSessionActive()) return;

    const pick = pickNextCard(this.queue, new Date());

    if (pick.type === 'done') {
      this.sessionEnded = true;
      this.currentCard = null;
      this.phase = 'complete';
      this.voiceActivity = 'idle';
      this.notify();
      return;
    }

    this.currentCard = this.queue[pick.index];
    this.isFlipped = false;
    this.phase = 'front';
    this.cardStartTime = Date.now();
    this.notify();

    await this.delayBeforeCardSpeak();
    if (!this.isSessionActive() || !this.currentCard) return;

    await this.playFrontIfEnabled();
  }

  private setupVoiceListener(): void {
    this.unsubVoice = voiceCommandService.onCommand((cmd) => {
      this.handleCommand(cmd);
    });
  }

  private async handleCommand(cmd: VoiceCommand): Promise<void> {
    if (!this.isVoiceCommandAllowed(cmd)) return;

    if (this.phase === 'complete' || this.phase === 'paused') {
      if (cmd === 'resume' && this.phase === 'paused') await this.resume();
      if (cmd === 'end') await this.endSession();
      return;
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
    if (!this.options.handsFreeMode || !this.isSessionActive() || this.phase === 'paused') return;
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
    if (!this.currentCard) return;

    if (this.options.autoPlayFront !== false) {
      await this.speakFront();
    } else {
      await this.startListening();
    }
  }

  async speakFront(): Promise<void> {
    const card = this.currentCard;
    if (!card || !this.isSessionActive()) return;

    // Stop mic during TTS so speaker output is not transcribed as commands/noise.
    await this.stopListening();
    this.phase = 'speaking_front';
    this.voiceActivity = 'speaking';
    this.notify();

    try {
      await cardMediaService.playSide(
        card.id,
        card.frontText,
        card.frontLocale,
        card.contentFormat,
        {
          rate: this.options.speechRate,
          volume: this.options.speechVolume ?? 60,
          voiceOverride: card.frontVoiceId ?? undefined,
        },
      );
    } catch {
      // playback failure — continue to listening
    }

    if (!this.isSessionActive()) return;

    this.phase = 'front';
    this.openVoiceCommandsAfterTts();
    await this.beginListeningAfterSpeech();
  }

  async flip(): Promise<void> {
    if (this.isFlipped) return;
    // Flip the UI first so voice "flip" feels instant; then stop mic / play back.
    this.isFlipped = true;
    this.phase = 'back';
    this.notify();

    if (this.options.autoPlayBack !== false) {
      await this.speakBack();
    } else {
      await this.stopListening();
      this.phase = 'rating';
      this.notify();
      await this.startListening();
    }
  }

  async speakBack(): Promise<void> {
    const card = this.currentCard;
    if (!card || !this.isSessionActive()) return;

    await this.stopListening();
    this.phase = 'speaking_back';
    this.voiceActivity = 'speaking';
    this.notify();

    try {
      await cardMediaService.playSide(
        card.id,
        card.backText,
        card.backLocale,
        card.contentFormat,
        {
          rate: this.options.speechRate,
          volume: this.options.speechVolume ?? 60,
          voiceOverride: card.backVoiceId ?? undefined,
          side: 'back',
          frontText: card.frontText,
        },
      );
    } catch {
      // continue
    }

    if (!this.isSessionActive()) return;

    this.phase = 'rating';
    this.openVoiceCommandsAfterTts();
    await this.beginListeningAfterSpeech();
  }

  async repeat(): Promise<void> {
    if (this.isFlipped) {
      await this.speakBack();
    } else {
      await this.speakFront();
    }
  }

  async rate(rating: Rating): Promise<void> {
    const card = this.currentCard;
    if (!card || !this.config) return;

    await this.stopListening();
    await cardMediaService.stop();

    const isNewIntro =
      card.scheduling.phase === 'new' && card.scheduling.reviewCount === 0;
    const phaseBefore = card.scheduling.phase;
    const scheduler = getScheduler(card.scheduling.algorithm);

    try {
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

      const finishedForToday = leavesSessionForToday(result.nextDueAt);
      // "Reviewed" = an old card finished for the day (scheduled 1+ days out).
      // Learning steps and new-card introductions don't count.
      const wasOldCard = phaseBefore === 'review' || phaseBefore === 'relearning';
      if (wasOldCard && finishedForToday) {
        this.cardsReviewed++;
      }

      this.queue = this.queue.filter((c) => c.id !== card.id);
      if (!finishedForToday) {
        this.queue = reinsertCardByDue(this.queue, card);
      }

      if (!this.isSessionActive()) return;

      await this.advanceToNext();
    } catch (error) {
      await this.startListening();
      throw error;
    }
  }

  async pause(): Promise<void> {
    this.cancelCardTransition();
    this.phase = 'paused';
    await ttsService.pause();
    voiceCommandService.pause();
    this.voiceActivity = 'idle';
    this.notify();
  }

  async resume(): Promise<void> {
    if (this.phase !== 'paused') return;
    if (this.currentCard) {
      this.phase = this.isFlipped ? 'rating' : 'front';
      ttsService.resume();
      await this.startListening();
    } else {
      await this.advanceToNext();
    }
  }

  async endSession(): Promise<void> {
    this.sessionEnded = true;
    this.cancelCardTransition();
    this.currentCard = null;
    this.phase = 'complete';
    this.voiceActivity = 'idle';
    voiceCommandService.stop();
    await cardMediaService.stop();
    invalidateStatsData();
    invalidateDeck(this.deckId);
    this.notify();
  }

  destroy(): void {
    this.destroyed = true;
    this.cancelCardTransition();
    this.unsubVoice?.();
    voiceCommandService.stop();
    cardMediaService.stop();
  }

  getSessionId(): string {
    return this.sessionId;
  }
}
