import { eq, and, lte, sql, desc, asc, gte, ne } from 'drizzle-orm';
import { getDb } from '../client';
import {
  decks,
  cards,
  cardScheduling,
  reviewLogs,
  dailyCounters,
  appSettings,
} from '../schema';
import {
  rowToDeck,
  rowToCard,
  rowToScheduling,
  schedulingToRow,
  generateId,
  createDefaultDeckConfig,
  serializeDeckConfig,
  createDefaultSettings,
  localDateString,
} from '../mappers';
import {
  Deck,
  Card,
  CardSchedulingState,
  CardWithScheduling,
  ReviewLog,
  AppSettings,
  Sm2DeckConfig,
} from '@/src/models/types';
import { getScheduler } from '@/src/scheduler/schedulerFactory';

export async function getAllDecks(): Promise<Deck[]> {
  const rows = await getDb().select().from(decks).orderBy(asc(decks.name));
  return rows.map(rowToDeck);
}

export async function getDeckById(id: string): Promise<Deck | null> {
  const rows = await getDb().select().from(decks).where(eq(decks.id, id)).limit(1);
  return rows[0] ? rowToDeck(rows[0]) : null;
}

export async function createDeck(input: {
  name: string;
  frontLocale: string;
  backLocale: string;
}): Promise<Deck> {
  const now = Date.now();
  const id = generateId();
  const config = createDefaultDeckConfig();
  const row = {
    id,
    name: input.name,
    frontLocale: input.frontLocale,
    backLocale: input.backLocale,
    algorithm: 'sm2' as const,
    configJson: serializeDeckConfig(config),
    createdAt: now,
    updatedAt: now,
  };
  await getDb().insert(decks).values(row);
  return rowToDeck(row);
}

export async function updateDeck(
  id: string,
  input: Partial<{ name: string; frontLocale: string; backLocale: string }>,
): Promise<void> {
  await getDb()
    .update(decks)
    .set({ ...input, updatedAt: Date.now() })
    .where(eq(decks.id, id));
}

export async function deleteDeck(id: string): Promise<void> {
  await getDb().delete(decks).where(eq(decks.id, id));
}

export async function getCardsByDeck(deckId: string): Promise<Card[]> {
  const rows = await getDb()
    .select()
    .from(cards)
    .where(eq(cards.deckId, deckId))
    .orderBy(desc(cards.createdAt));
  return rows.map(rowToCard);
}

export async function getCardById(id: string): Promise<Card | null> {
  const rows = await getDb().select().from(cards).where(eq(cards.id, id)).limit(1);
  return rows[0] ? rowToCard(rows[0]) : null;
}

export async function createCard(input: {
  deckId: string;
  frontText: string;
  backText: string;
  frontLocale: string;
  backLocale: string;
  tags?: string;
}): Promise<CardWithScheduling> {
  const now = Date.now();
  const id = generateId();
  const deck = await getDeckById(input.deckId);
  if (!deck) throw new Error('Deck not found');

  const cardRow = {
    id,
    deckId: input.deckId,
    frontText: input.frontText,
    backText: input.backText,
    frontLocale: input.frontLocale,
    backLocale: input.backLocale,
    tags: input.tags ?? null,
    suspended: 0,
    createdAt: now,
    updatedAt: now,
  };

  const scheduler = getScheduler(deck.algorithm);
  const scheduling = scheduler.createInitialState(
    id,
    input.deckId,
    new Date(now),
    deck.config,
  );
  const schedRow = {
    ...schedulingToRow(scheduling, now),
    createdAt: now,
  };

  await getDb().insert(cards).values(cardRow);
  await getDb().insert(cardScheduling).values(schedRow);

  return { ...rowToCard(cardRow), scheduling };
}

export async function updateCard(
  id: string,
  input: Partial<{
    frontText: string;
    backText: string;
    frontLocale: string;
    backLocale: string;
    tags: string;
    suspended: boolean;
  }>,
): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: Date.now() };
  if (input.frontText !== undefined) update.frontText = input.frontText;
  if (input.backText !== undefined) update.backText = input.backText;
  if (input.frontLocale !== undefined) update.frontLocale = input.frontLocale;
  if (input.backLocale !== undefined) update.backLocale = input.backLocale;
  if (input.tags !== undefined) update.tags = input.tags;
  if (input.suspended !== undefined) update.suspended = input.suspended ? 1 : 0;
  await getDb().update(cards).set(update).where(eq(cards.id, id));
}

export async function deleteCard(id: string): Promise<void> {
  await getDb().delete(cards).where(eq(cards.id, id));
}

export async function getSchedulingByCardId(
  cardId: string,
): Promise<CardSchedulingState | null> {
  const rows = await getDb()
    .select()
    .from(cardScheduling)
    .where(eq(cardScheduling.cardId, cardId))
    .limit(1);
  return rows[0] ? rowToScheduling(rows[0]) : null;
}

export async function getSchedulingByDeck(
  deckId: string,
): Promise<CardSchedulingState[]> {
  const rows = await getDb()
    .select()
    .from(cardScheduling)
    .where(eq(cardScheduling.deckId, deckId));
  return rows.map(rowToScheduling);
}

export async function upsertScheduling(state: CardSchedulingState): Promise<void> {
  const now = Date.now();
  const row = {
    ...schedulingToRow(state, now),
    createdAt: state.createdAt.getTime(),
  };

  const existing = await getDb()
    .select()
    .from(cardScheduling)
    .where(eq(cardScheduling.cardId, state.cardId))
    .limit(1);

  if (existing[0]) {
    await getDb()
      .update(cardScheduling)
      .set(row)
      .where(eq(cardScheduling.cardId, state.cardId));
  } else {
    await getDb().insert(cardScheduling).values(row);
  }
}

export async function getCardsWithScheduling(
  deckId: string,
): Promise<CardWithScheduling[]> {
  const cardRows = await getDb()
    .select()
    .from(cards)
    .where(and(eq(cards.deckId, deckId), eq(cards.suspended, 0)));
  const result: CardWithScheduling[] = [];

  for (const cardRow of cardRows) {
    const sched = await getSchedulingByCardId(cardRow.id);
    if (sched) {
      result.push({ ...rowToCard(cardRow), scheduling: sched });
    }
  }
  return result;
}

export async function countDueCards(
  deckId: string | null,
  now: Date,
): Promise<number> {
  const conditions = [
    lte(cardScheduling.dueAt, now.getTime()),
    ne(cardScheduling.phase, 'new'),
  ];
  if (deckId) conditions.push(eq(cardScheduling.deckId, deckId));

  const rows = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(cardScheduling)
    .where(and(...conditions));
  return rows[0]?.count ?? 0;
}

export async function insertReviewLog(log: ReviewLog): Promise<void> {
  await getDb().insert(reviewLogs).values({
    id: log.id,
    cardId: log.cardId,
    deckId: log.deckId,
    sessionId: log.sessionId ?? null,
    reviewedAt: log.reviewedAt.getTime(),
    rating: log.rating,
    phaseBefore: log.phaseBefore,
    easeBefore: log.easeBefore,
    intervalDaysBefore: log.intervalDaysBefore,
    dueAtBefore: log.dueAtBefore.getTime(),
    reviewCountBefore: log.reviewCountBefore,
    lapseCountBefore: log.lapseCountBefore,
    phaseAfter: log.phaseAfter,
    easeAfter: log.easeAfter,
    intervalDaysAfter: log.intervalDaysAfter,
    dueAtAfter: log.dueAtAfter.getTime(),
    reviewDurationMs: log.reviewDurationMs ?? null,
    scheduledDaysLate: log.scheduledDaysLate,
    stabilityBefore: log.stabilityBefore ?? null,
    stabilityAfter: log.stabilityAfter ?? null,
    difficultyBefore: log.difficultyBefore ?? null,
    difficultyAfter: log.difficultyAfter ?? null,
    algorithm: log.algorithm,
  });
}

export async function incrementDailyCounter(
  deckId: string,
  date: string,
  field: 'newCardsIntroduced' | 'reviewsCompleted',
): Promise<void> {
  const existing = await getDb()
    .select()
    .from(dailyCounters)
    .where(and(eq(dailyCounters.deckId, deckId), eq(dailyCounters.date, date)))
    .limit(1);

  if (existing[0]) {
    const update =
      field === 'newCardsIntroduced'
        ? { newCardsIntroduced: existing[0].newCardsIntroduced + 1 }
        : { reviewsCompleted: existing[0].reviewsCompleted + 1 };
    await getDb()
      .update(dailyCounters)
      .set(update)
      .where(
        and(eq(dailyCounters.deckId, deckId), eq(dailyCounters.date, date)),
      );
  } else {
    await getDb().insert(dailyCounters).values({
      deckId,
      date,
      newCardsIntroduced: field === 'newCardsIntroduced' ? 1 : 0,
      reviewsCompleted: field === 'reviewsCompleted' ? 1 : 0,
    });
  }
}

export async function getNewCardsIntroducedToday(deckId: string): Promise<number> {
  const date = localDateString();
  const rows = await getDb()
    .select()
    .from(dailyCounters)
    .where(and(eq(dailyCounters.deckId, deckId), eq(dailyCounters.date, date)))
    .limit(1);
  return rows[0]?.newCardsIntroduced ?? 0;
}

export async function getReviewsToday(deckId?: string): Promise<number> {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const conditions = [gte(reviewLogs.reviewedAt, start.getTime())];
  if (deckId) conditions.push(eq(reviewLogs.deckId, deckId));

  const rows = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(reviewLogs)
    .where(and(...conditions));
  return rows[0]?.count ?? 0;
}

export async function getAppSettings(): Promise<AppSettings> {
  const rows = await getDb().select().from(appSettings);
  const defaults = createDefaultSettings();
  const map = Object.fromEntries(rows.map((r) => [r.key, r.value]));

  return {
    speechRate: map.speechRate ? parseFloat(map.speechRate) : defaults.speechRate,
    autoPlayFront: map.autoPlayFront ? map.autoPlayFront === 'true' : defaults.autoPlayFront,
    autoPlayBack: map.autoPlayBack ? map.autoPlayBack === 'true' : defaults.autoPlayBack,
    handsFreeMode: map.handsFreeMode ? map.handsFreeMode === 'true' : defaults.handsFreeMode,
    defaultFrontLocale: map.defaultFrontLocale ?? defaults.defaultFrontLocale,
    defaultBackLocale: map.defaultBackLocale ?? defaults.defaultBackLocale,
  };
}

export async function saveAppSettings(settings: Partial<AppSettings>): Promise<void> {
  const entries = Object.entries(settings) as [keyof AppSettings, unknown][];
  for (const [key, value] of entries) {
    const existing = await getDb()
      .select()
      .from(appSettings)
      .where(eq(appSettings.key, key))
      .limit(1);

    if (existing[0]) {
      await getDb()
        .update(appSettings)
        .set({ value: String(value) })
        .where(eq(appSettings.key, key));
    } else {
      await getDb().insert(appSettings).values({ key, value: String(value) });
    }
  }
}

export async function getDeckConfig(deckId: string): Promise<Sm2DeckConfig> {
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error('Deck not found');
  return deck.config as Sm2DeckConfig;
}

export async function getReviewLogsSince(
  deckId: string | null,
  since: Date,
): Promise<{ reviewedAt: number; rating: string; deckId: string }[]> {
  const conditions = [gte(reviewLogs.reviewedAt, since.getTime())];
  if (deckId) conditions.push(eq(reviewLogs.deckId, deckId));

  return getDb()
    .select({
      reviewedAt: reviewLogs.reviewedAt,
      rating: reviewLogs.rating,
      deckId: reviewLogs.deckId,
    })
    .from(reviewLogs)
    .where(and(...conditions))
    .orderBy(asc(reviewLogs.reviewedAt));
}

export async function getLearnedCardCount(deckId?: string): Promise<number> {
  const conditions = [eq(cardScheduling.phase, 'review'), gte(cardScheduling.reviewCount, 1)];
  if (deckId) conditions.push(eq(cardScheduling.deckId, deckId));

  const rows = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(cardScheduling)
    .where(and(...conditions));
  return rows[0]?.count ?? 0;
}

export async function getTotalReviews(deckId?: string): Promise<number> {
  const conditions = deckId ? [eq(reviewLogs.deckId, deckId)] : [];
  const rows = await getDb()
    .select({ count: sql<number>`count(*)` })
    .from(reviewLogs)
    .where(conditions.length ? and(...conditions) : undefined);
  return rows[0]?.count ?? 0;
}

export async function getWeakCards(
  deckId: string | null,
  limit = 10,
): Promise<{ cardId: string; frontText: string; failCount: number }[]> {
  const since = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const conditions = [
    gte(reviewLogs.reviewedAt, since),
    sql`${reviewLogs.rating} IN ('again', 'hard')`,
  ];
  if (deckId) conditions.push(eq(reviewLogs.deckId, deckId));

  const failCounts = await getDb()
    .select({
      cardId: reviewLogs.cardId,
      failCount: sql<number>`count(*)`,
    })
    .from(reviewLogs)
    .where(and(...conditions))
    .groupBy(reviewLogs.cardId)
    .orderBy(desc(sql`count(*)`))
    .limit(limit);

  const result = [];
  for (const row of failCounts) {
    const card = await getCardById(row.cardId);
    if (card) {
      result.push({
        cardId: row.cardId,
        frontText: card.frontText,
        failCount: row.failCount,
      });
    }
  }
  return result;
}
