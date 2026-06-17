import {
  CardSchedulingState,
  DeckSchedulerConfig,
  Rating,
  ReviewLog,
  ScheduleResult,
  Sm2AlgorithmState,
} from '@/src/models/types';
import { SpacedRepetitionScheduler } from './SpacedRepetitionScheduler';
import { daysBetween } from './time';
import { generateId } from '@/src/db/mappers';

export function buildReviewLog(
  before: CardSchedulingState,
  result: ScheduleResult,
  rating: Rating,
  now: Date,
  sessionMeta?: { sessionId?: string; reviewDurationMs?: number },
): ReviewLog {
  const sm2Before = before.algorithmState as Sm2AlgorithmState;
  const sm2After = result.card.algorithmState as Sm2AlgorithmState;

  return {
    id: generateId(),
    cardId: before.cardId,
    deckId: before.deckId,
    sessionId: sessionMeta?.sessionId,
    reviewedAt: now,
    rating,
    phaseBefore: before.phase,
    easeBefore: sm2Before.ease ?? null,
    intervalDaysBefore: sm2Before.intervalDays,
    dueAtBefore: before.dueAt,
    reviewCountBefore: before.reviewCount,
    lapseCountBefore: before.lapseCount,
    phaseAfter: result.card.phase,
    easeAfter: sm2After.ease ?? null,
    intervalDaysAfter: sm2After.intervalDays,
    dueAtAfter: result.card.dueAt,
    reviewDurationMs: sessionMeta?.reviewDurationMs,
    scheduledDaysLate: Math.max(0, daysBetween(before.dueAt, now)),
    algorithm: before.algorithm,
  };
}

export interface ReviewCardDeps {
  scheduler: SpacedRepetitionScheduler;
  upsertScheduling: (card: CardSchedulingState) => Promise<void>;
  insertReviewLog: (log: ReviewLog) => Promise<void>;
  incrementDailyCounter: (
    deckId: string,
    date: string,
    field: 'newCardsIntroduced' | 'reviewsCompleted',
  ) => Promise<void>;
  config: DeckSchedulerConfig;
}

export async function reviewCard(
  deps: ReviewCardDeps,
  card: CardSchedulingState,
  rating: Rating,
  now: Date,
  sessionMeta?: {
    sessionId?: string;
    reviewDurationMs?: number;
    isNewIntroduction?: boolean;
  },
): Promise<ScheduleResult> {
  const result = deps.scheduler.scheduleCard(card, rating, now, deps.config);

  await deps.upsertScheduling(result.card);
  await deps.insertReviewLog(
    buildReviewLog(card, result, rating, now, sessionMeta),
  );

  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  await deps.incrementDailyCounter(card.deckId, dateStr, 'reviewsCompleted');

  if (sessionMeta?.isNewIntroduction) {
    await deps.incrementDailyCounter(card.deckId, dateStr, 'newCardsIntroduced');
  }

  return result;
}
