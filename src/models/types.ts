export type Rating = 'again' | 'hard' | 'good' | 'easy';

export type CardPhase = 'new' | 'learning' | 'review' | 'relearning';

export type SchedulerAlgorithm = 'sm2' | 'fsrs';

export interface Sm2DeckConfig {
  algorithm: 'sm2';
  learningStepsMinutes: number[];
  relearningStepsMinutes: number[];
  graduatingIntervalDays: number;
  easyIntervalDays: number;
  startingEase: number;
  minimumEase: number;
  maximumIntervalDays: number;
  hardMultiplier: number;
  easyBonus: number;
  againEasePenalty: number;
  hardEasePenalty: number;
  easyEaseBonus: number;
  newIntervalAfterLapse: number;
  minimumIntervalAfterLapseDays: number;
  newCardsPerDay: number;
  newCardsPerDayMode?: 'global' | 'custom';
  reviewsPerDay?: number;
}

export interface FsrsDeckConfig {
  algorithm: 'fsrs';
  desiredRetention: number;
  maximumIntervalDays: number;
  newCardsPerDay: number;
  weights: number[];
}

export type DeckSchedulerConfig = Sm2DeckConfig | FsrsDeckConfig;

export interface Sm2AlgorithmState {
  ease: number;
  intervalDays: number;
  learningStepIndex: number;
  lapseIntervalDays?: number;
}

export interface FsrsAlgorithmState {
  stability: number;
  difficulty: number;
  elapsedDays: number;
  scheduledDays: number;
  lastRating?: Rating;
}

export type AlgorithmState = Sm2AlgorithmState | FsrsAlgorithmState;

export interface CardSchedulingState {
  cardId: string;
  deckId: string;
  phase: CardPhase;
  dueAt: Date;
  reviewCount: number;
  lapseCount: number;
  lastReviewedAt: Date | null;
  algorithm: SchedulerAlgorithm;
  algorithmState: AlgorithmState;
  createdAt: Date;
  updatedAt: Date;
}

export interface ScheduleResult {
  card: CardSchedulingState;
  previousPhase: CardPhase;
  previousDueAt: Date;
  nextIntervalDays: number;
  nextDueAt: Date;
  easeOrDifficultyDelta?: number;
}

export interface IntervalPreview {
  rating: Rating;
  label: string;
  dueAt: Date;
  intervalDays: number;
}

export interface ReviewQueueItem {
  card: CardSchedulingState;
  queueKind: 'new' | 'learning' | 'review';
  previews?: Partial<Record<Rating, IntervalPreview>>;
}

export interface ReviewLog {
  id: string;
  cardId: string;
  deckId: string;
  sessionId?: string;
  reviewedAt: Date;
  rating: Rating;
  phaseBefore: CardPhase;
  easeBefore: number | null;
  intervalDaysBefore: number;
  dueAtBefore: Date;
  reviewCountBefore: number;
  lapseCountBefore: number;
  phaseAfter: CardPhase;
  easeAfter: number | null;
  intervalDaysAfter: number;
  dueAtAfter: Date;
  reviewDurationMs?: number;
  scheduledDaysLate: number;
  stabilityBefore?: number;
  stabilityAfter?: number;
  difficultyBefore?: number;
  difficultyAfter?: number;
  algorithm: SchedulerAlgorithm;
}

export interface Deck {
  id: string;
  name: string;
  frontLocale: string;
  backLocale: string;
  algorithm: SchedulerAlgorithm;
  config: DeckSchedulerConfig;
  createdAt: Date;
  updatedAt: Date;
}

export type ContentFormat = 'plain' | 'html';
export type CardMediaType = 'image' | 'audio';

export interface CardMedia {
  id: string;
  cardId: string;
  sourceName: string;
  localUri: string;
  mediaType: CardMediaType;
  createdAt: Date;
}

export interface Card {
  id: string;
  deckId: string;
  frontText: string;
  backText: string;
  frontLocale: string;
  backLocale: string;
  contentFormat: ContentFormat;
  suspended: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface CardWithScheduling extends Card {
  scheduling: CardSchedulingState;
}

export interface AppSettings {
  speechRate: number;
  speechVolume: number;
  autoPlayFront: boolean;
  autoPlayBack: boolean;
  handsFreeMode: boolean;
  defaultFrontLocale: string;
  defaultBackLocale: string;
  defaultNewCardsPerDay: number;
  safetyNoticeAcknowledged: boolean;
}
