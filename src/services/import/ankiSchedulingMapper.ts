import { CardSchedulingState, CardPhase, Rating } from '@/src/models/types';
import { DEFAULT_SM2_CONFIG } from '@/src/constants';

export interface AnkiCardRow {
  id: number;
  nid: number;
  did: number;
  ord: number;
  type: number;
  queue: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
}

export interface AnkiRevlogRow {
  cid: number;
  usn: number;
  ease: number;
  ivl: number;
  lastIvl: number;
  factor: number;
  time: number;
  type: number;
}

export interface MappedScheduling {
  scheduling: Omit<CardSchedulingState, 'cardId' | 'deckId'>;
  suspended: boolean;
}

export interface MappedRevlog {
  reviewedAt: Date;
  rating: Rating;
  intervalDaysBefore: number;
  phaseBefore: CardPhase;
}

function easeFromFactor(factor: number): number {
  return factor > 0 ? factor / 1000 : DEFAULT_SM2_CONFIG.startingEase;
}

/** Anki packs learning progress as stepsRemaining * 1000 + stepIndex. */
function ankiLearningStepIndex(left: number, stepCount: number): number {
  if (left >= 1000) {
    return Math.min(left % 1000, Math.max(0, stepCount - 1));
  }
  return Math.min(Math.max(0, stepCount - left), Math.max(0, stepCount - 1));
}

export function mapAnkiCardScheduling(
  card: AnkiCardRow,
  collectionCrtSeconds: number,
  now: Date,
): MappedScheduling {
  const nowMs = now.getTime();
  const crtMs = collectionCrtSeconds * 1000;
  const suspended = card.queue === -1;

  const base = {
    reviewCount: card.reps,
    lapseCount: card.lapses,
    lastReviewedAt: null as Date | null,
    algorithm: 'sm2' as const,
    createdAt: now,
    updatedAt: now,
  };

  const ease = easeFromFactor(card.factor);
  const learningSteps = DEFAULT_SM2_CONFIG.learningStepsMinutes.length;

  switch (card.type) {
    case 0:
      return {
        suspended,
        scheduling: {
          ...base,
          phase: 'new',
          dueAt: now,
          algorithmState: {
            ease,
            intervalDays: 0,
            learningStepIndex: 0,
          },
        },
      };
    case 1: {
      const dueAt = new Date(card.due * 1000);
      const stepIndex = ankiLearningStepIndex(card.left, learningSteps);
      return {
        suspended,
        scheduling: {
          ...base,
          phase: 'learning',
          dueAt,
          algorithmState: {
            ease,
            intervalDays: 0,
            learningStepIndex: stepIndex,
          },
        },
      };
    }
    case 2: {
      const dueAt = new Date(crtMs + card.due * 86400 * 1000);
      return {
        suspended,
        scheduling: {
          ...base,
          phase: 'review',
          dueAt,
          algorithmState: {
            ease,
            intervalDays: Math.max(0, card.ivl),
            learningStepIndex: 0,
          },
        },
      };
    }
    case 3: {
      const dueAt = new Date(card.due * 1000);
      const relearningSteps = DEFAULT_SM2_CONFIG.relearningStepsMinutes.length;
      const stepIndex = ankiLearningStepIndex(card.left, relearningSteps);
      return {
        suspended,
        scheduling: {
          ...base,
          phase: 'relearning',
          dueAt,
          algorithmState: {
            ease,
            intervalDays: Math.max(0, card.ivl),
            learningStepIndex: stepIndex,
            lapseIntervalDays: card.ivl > 0 ? card.ivl : undefined,
          },
        },
      };
    }
    default:
      return {
        suspended,
        scheduling: {
          ...base,
          phase: 'new',
          dueAt: now,
          algorithmState: {
            ease,
            intervalDays: 0,
            learningStepIndex: 0,
          },
        },
      };
  }
}

export function mapAnkiRevlogRating(ease: number): Rating | null {
  switch (ease) {
    case 1:
      return 'again';
    case 2:
      return 'hard';
    case 3:
      return 'good';
    case 4:
      return 'easy';
    default:
      return null;
  }
}

export function mapAnkiRevlog(
  row: AnkiRevlogRow,
  collectionCrtSeconds: number,
): MappedRevlog | null {
  const rating = mapAnkiRevlogRating(row.ease);
  if (!rating) return null;

  const reviewedAt = new Date(row.time);
  const intervalDaysBefore = row.lastIvl > 0 ? row.lastIvl : 0;

  let phaseBefore: CardPhase = 'review';
  if (row.type === 0) phaseBefore = 'learning';
  if (row.type === 1) phaseBefore = 'review';
  if (row.type === 2) phaseBefore = 'relearning';
  if (row.type === 3) phaseBefore = 'new';

  return {
    reviewedAt,
    rating,
    intervalDaysBefore,
    phaseBefore,
  };
}

export function buildSchedulingState(
  cardId: string,
  deckId: string,
  mapped: MappedScheduling,
): CardSchedulingState {
  return {
    cardId,
    deckId,
    ...mapped.scheduling,
  };
}
