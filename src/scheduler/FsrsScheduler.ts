import {
  CardSchedulingState,
  DeckSchedulerConfig,
  IntervalPreview,
  Rating,
  ScheduleResult,
} from '@/src/models/types';
import { SpacedRepetitionScheduler } from './SpacedRepetitionScheduler';

export class FsrsScheduler implements SpacedRepetitionScheduler {
  readonly algorithm = 'fsrs' as const;

  isNewCard(card: CardSchedulingState): boolean {
    return card.phase === 'new' && card.reviewCount === 0;
  }

  isDue(card: CardSchedulingState, now: Date): boolean {
    return card.dueAt.getTime() <= now.getTime();
  }

  createInitialState(
    cardId: string,
    deckId: string,
    now: Date,
    _config: DeckSchedulerConfig,
  ): CardSchedulingState {
    return {
      cardId,
      deckId,
      phase: 'new',
      dueAt: now,
      reviewCount: 0,
      lapseCount: 0,
      lastReviewedAt: null,
      algorithm: 'fsrs',
      algorithmState: {
        stability: 0,
        difficulty: 5,
        elapsedDays: 0,
        scheduledDays: 0,
      },
      createdAt: now,
      updatedAt: now,
    };
  }

  scheduleCard(
    _card: CardSchedulingState,
    _rating: Rating,
    _now: Date,
    _config: DeckSchedulerConfig,
  ): ScheduleResult {
    throw new Error('FSRS scheduler is not yet implemented. Use SM-2 for now.');
  }

  previewIntervals(
    _card: CardSchedulingState,
    now: Date,
    _config: DeckSchedulerConfig,
  ): Record<Rating, IntervalPreview> {
    const stub = (rating: Rating): IntervalPreview => ({
      rating,
      label: '—',
      dueAt: now,
      intervalDays: 0,
    });
    return {
      again: stub('again'),
      hard: stub('hard'),
      good: stub('good'),
      easy: stub('easy'),
    };
  }
}

export const fsrsScheduler = new FsrsScheduler();
