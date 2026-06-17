import {
  CardSchedulingState,
  DeckSchedulerConfig,
  IntervalPreview,
  Rating,
  ScheduleResult,
  SchedulerAlgorithm,
} from '@/src/models/types';

export interface SpacedRepetitionScheduler {
  readonly algorithm: SchedulerAlgorithm;

  isNewCard(card: CardSchedulingState): boolean;
  isDue(card: CardSchedulingState, now: Date): boolean;

  scheduleCard(
    card: CardSchedulingState,
    rating: Rating,
    now: Date,
    config: DeckSchedulerConfig,
  ): ScheduleResult;

  previewIntervals(
    card: CardSchedulingState,
    now: Date,
    config: DeckSchedulerConfig,
  ): Record<Rating, IntervalPreview>;

  createInitialState(
    cardId: string,
    deckId: string,
    now: Date,
    config: DeckSchedulerConfig,
  ): CardSchedulingState;
}
