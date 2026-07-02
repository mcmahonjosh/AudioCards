import {
  getDeckById,
  getCardsWithScheduling,
  getNewCardsIntroducedToday,
  getReviewsToday,
} from '@/src/db/repositories';
import { Deck, CardWithScheduling } from '@/src/models/types';
import { getDeckSessionCounts, SessionCounts } from '@/src/scheduler/sessionQueue';
import { getEffectiveNewCardsPerDay } from '@/src/scheduler/newCardLimits';
import { DEFAULT_SETTINGS } from '@/src/constants';

export interface DeckSnapshot {
  deck: Deck;
  cards: CardWithScheduling[];
  sessionCounts: SessionCounts;
  reviewsToday: number;
  newCardsIntroducedToday: number;
  fetchedAt: number;
}

export async function fetchDeckSnapshot(
  deckId: string,
  defaultNewCardsPerDay = DEFAULT_SETTINGS.defaultNewCardsPerDay,
): Promise<DeckSnapshot | null> {
  const [deck, cards, introducedToday, reviewsToday] = await Promise.all([
    getDeckById(deckId),
    getCardsWithScheduling(deckId),
    getNewCardsIntroducedToday(deckId),
    getReviewsToday(deckId),
  ]);

  if (!deck) return null;

  const effectiveLimit = getEffectiveNewCardsPerDay(deck, { defaultNewCardsPerDay });
  const sessionCounts = getDeckSessionCounts(cards, new Date(), {
    newCardsLimit: effectiveLimit,
    newCardsIntroducedToday: introducedToday,
  });

  return {
    deck,
    cards,
    sessionCounts,
    reviewsToday,
    newCardsIntroducedToday: introducedToday,
    fetchedAt: Date.now(),
  };
}

export type ReviewInitialSnapshot = Pick<
  DeckSnapshot,
  'deck' | 'cards' | 'newCardsIntroducedToday'
>;
