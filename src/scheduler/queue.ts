import { CardSchedulingState, ReviewQueueItem } from '@/src/models/types';

export function isNewCard(card: CardSchedulingState): boolean {
  return card.phase === 'new' && card.reviewCount === 0;
}

export function isDueCard(card: CardSchedulingState, now: Date): boolean {
  return card.dueAt.getTime() <= now.getTime();
}

export function getDueCards(
  cards: CardSchedulingState[],
  now: Date,
): CardSchedulingState[] {
  return cards
    .filter((c) => c.phase !== 'new' && isDueCard(c, now))
    .sort((a, b) => a.dueAt.getTime() - b.dueAt.getTime());
}

export function getNewCardsForSession(
  cards: CardSchedulingState[],
  introducedToday: number,
  limit: number,
): CardSchedulingState[] {
  const remaining = Math.max(0, limit - introducedToday);
  return cards.filter(isNewCard).slice(0, remaining);
}

export function buildReviewQueue(
  allCards: CardSchedulingState[],
  now: Date,
  options: {
    includeNewCards: boolean;
    newCardsLimit: number;
    newCardsIntroducedToday: number;
    maxReviews?: number;
  },
): ReviewQueueItem[] {
  const due = getDueCards(allCards, now);
  const cappedDue = options.maxReviews ? due.slice(0, options.maxReviews) : due;

  const queue: ReviewQueueItem[] = cappedDue.map((card) => ({
    card,
    queueKind: 'due' as const,
  }));

  if (options.includeNewCards) {
    const news = getNewCardsForSession(
      allCards,
      options.newCardsIntroducedToday,
      options.newCardsLimit,
    );
    queue.push(
      ...news.map((card) => ({ card, queueKind: 'new' as const })),
    );
  }

  return queue;
}
