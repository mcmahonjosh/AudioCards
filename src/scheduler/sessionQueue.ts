import { CardSchedulingState, CardPhase } from '@/src/models/types';
import { CardWithScheduling } from '@/src/models/types';
import { endOfToday } from '@/src/db/mappers';

export type SessionQueueKind = 'new' | 'learning' | 'review';

export interface SessionCounts {
  new: number;
  learning: number;
  review: number;
}

export function isLearningPhase(phase: CardPhase): boolean {
  return phase === 'learning' || phase === 'relearning';
}

export function isNewCard(card: CardSchedulingState): boolean {
  return card.phase === 'new' && card.reviewCount === 0;
}

/** Card leaves today's session when next due is after end of local day (tomorrow+). */
export function leavesSessionForToday(dueAt: Date, now: Date = new Date()): boolean {
  return dueAt.getTime() > endOfToday(now).getTime();
}

export function countSessionQueue(
  queue: CardWithScheduling[],
): SessionCounts {
  const counts = { new: 0, learning: 0, review: 0 };
  for (const c of queue) {
    const phase = c.scheduling.phase;
    if (isNewCard(c.scheduling)) counts.new++;
    else if (isLearningPhase(phase)) counts.learning++;
    else if (phase === 'review') counts.review++;
  }
  return counts;
}

export function categorizeForSession(
  card: CardSchedulingState,
  now: Date,
): SessionQueueKind | null {
  if (isNewCard(card)) return 'new';
  if (isLearningPhase(card.phase) && card.dueAt.getTime() <= endOfToday(now).getTime()) {
    return 'learning';
  }
  if (card.phase === 'review' && card.dueAt.getTime() <= now.getTime()) {
    return 'review';
  }
  return null;
}

export function buildInitialSessionQueue(
  cards: CardWithScheduling[],
  now: Date,
  options: {
    includeNewCards: boolean;
    newCardsLimit: number;
    newCardsIntroducedToday: number;
  },
): CardWithScheduling[] {
  const learning: CardWithScheduling[] = [];
  const review: CardWithScheduling[] = [];
  const news: CardWithScheduling[] = [];

  const endToday = endOfToday(now).getTime();
  const nowMs = now.getTime();

  for (const card of cards) {
    const s = card.scheduling;
    if (isNewCard(s)) continue;
    if (isLearningPhase(s.phase) && s.dueAt.getTime() <= endToday) {
      learning.push(card);
    } else if (s.phase === 'review' && s.dueAt.getTime() <= nowMs) {
      review.push(card);
    }
  }

  learning.sort((a, b) => a.scheduling.dueAt.getTime() - b.scheduling.dueAt.getTime());
  review.sort((a, b) => a.scheduling.dueAt.getTime() - b.scheduling.dueAt.getTime());

  if (options.includeNewCards) {
    const remaining = Math.max(0, options.newCardsLimit - options.newCardsIntroducedToday);
    for (const card of cards) {
      if (isNewCard(card.scheduling) && news.length < remaining) {
        news.push(card);
      }
    }
  }

  return [...learning, ...review, ...news];
}

export type PickNextResult =
  | { type: 'card'; index: number }
  | { type: 'done' };

/**
 * Next card: learning (due now) → review → new → soonest intraday learning (< 1 day).
 */
export function pickNextCard(
  queue: CardWithScheduling[],
  now: Date = new Date(),
): PickNextResult {
  const nowMs = now.getTime();
  const endToday = endOfToday(now).getTime();

  let bestLearning = -1;
  let bestLearningDue = Infinity;
  let bestFutureLearning = -1;
  let bestFutureLearningDue = Infinity;
  let bestReview = -1;
  let bestNew = -1;

  for (let i = 0; i < queue.length; i++) {
    const s = queue[i].scheduling;
    const due = s.dueAt.getTime();

    if (isNewCard(s)) {
      if (bestNew === -1) bestNew = i;
      continue;
    }

    if (isLearningPhase(s.phase)) {
      if (due <= nowMs) {
        if (due < bestLearningDue) {
          bestLearningDue = due;
          bestLearning = i;
        }
      } else if (due <= endToday) {
        if (due < bestFutureLearningDue) {
          bestFutureLearningDue = due;
          bestFutureLearning = i;
        }
      }
      continue;
    }

    if (s.phase === 'review' && due <= nowMs) {
      if (bestReview === -1) bestReview = i;
    }
  }

  if (bestLearning !== -1) return { type: 'card', index: bestLearning };
  if (bestReview !== -1) return { type: 'card', index: bestReview };
  if (bestNew !== -1) return { type: 'card', index: bestNew };
  if (bestFutureLearning !== -1) return { type: 'card', index: bestFutureLearning };

  return { type: 'done' };
}

/** Re-insert a card that stays in today's session, sorted by due time. */
export function reinsertCardByDue(
  queue: CardWithScheduling[],
  card: CardWithScheduling,
): CardWithScheduling[] {
  const due = card.scheduling.dueAt.getTime();
  const next = [...queue];
  let insertAt = next.length;
  for (let i = 0; i < next.length; i++) {
    if (next[i].scheduling.dueAt.getTime() > due) {
      insertAt = i;
      break;
    }
  }
  next.splice(insertAt, 0, card);
  return next;
}

export function getDeckSessionCounts(
  cards: CardWithScheduling[],
  now: Date = new Date(),
  options?: {
    newCardsLimit?: number;
    newCardsIntroducedToday?: number;
  },
): SessionCounts {
  const endToday = endOfToday(now).getTime();
  const nowMs = now.getTime();
  const counts = { new: 0, learning: 0, review: 0 };
  let newAvailable = options?.newCardsLimit !== undefined
    ? Math.max(0, options.newCardsLimit - (options.newCardsIntroducedToday ?? 0))
    : Infinity;

  for (const card of cards) {
    const s = card.scheduling;
    if (isNewCard(s)) {
      if (newAvailable > 0) {
        counts.new++;
        newAvailable--;
      }
    } else if (isLearningPhase(s.phase) && s.dueAt.getTime() <= endToday) {
      counts.learning++;
    } else if (s.phase === 'review' && s.dueAt.getTime() <= nowMs) {
      counts.review++;
    }
  }
  return counts;
}
