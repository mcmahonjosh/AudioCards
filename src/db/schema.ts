import { sqliteTable, text, integer, real, index, primaryKey } from 'drizzle-orm/sqlite-core';

export const decks = sqliteTable('decks', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  frontLocale: text('front_locale').notNull().default('en-US'),
  backLocale: text('back_locale').notNull().default('es-MX'),
  algorithm: text('algorithm').notNull().default('sm2'),
  configJson: text('config_json').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const cards = sqliteTable('cards', {
  id: text('id').primaryKey(),
  deckId: text('deck_id')
    .notNull()
    .references(() => decks.id, { onDelete: 'cascade' }),
  frontText: text('front_text').notNull(),
  backText: text('back_text').notNull(),
  frontLocale: text('front_locale').notNull(),
  backLocale: text('back_locale').notNull(),
  tags: text('tags'),
  contentFormat: text('content_format').notNull().default('plain'),
  suspended: integer('suspended').notNull().default(0),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const cardMedia = sqliteTable(
  'card_media',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    sourceName: text('source_name').notNull(),
    localUri: text('local_uri').notNull(),
    mediaType: text('media_type').notNull(),
    createdAt: integer('created_at').notNull(),
  },
  (table) => [
    index('idx_card_media_card').on(table.cardId),
    index('idx_card_media_source').on(table.cardId, table.sourceName),
  ],
);

export const cardScheduling = sqliteTable(
  'card_scheduling',
  {
    cardId: text('card_id')
      .primaryKey()
      .references(() => cards.id, { onDelete: 'cascade' }),
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    phase: text('phase').notNull().default('new'),
    dueAt: integer('due_at').notNull(),
    reviewCount: integer('review_count').notNull().default(0),
    lapseCount: integer('lapse_count').notNull().default(0),
    lastReviewedAt: integer('last_reviewed_at'),
    algorithm: text('algorithm').notNull().default('sm2'),
    ease: real('ease'),
    intervalDays: real('interval_days').notNull().default(0),
    learningStepIndex: integer('learning_step_index').notNull().default(0),
    lapseIntervalDays: real('lapse_interval_days'),
    stability: real('stability'),
    difficulty: real('difficulty'),
    scheduledDays: real('scheduled_days'),
    algorithmStateJson: text('algorithm_state_json'),
    createdAt: integer('created_at').notNull(),
    updatedAt: integer('updated_at').notNull(),
  },
  (table) => [
    index('idx_scheduling_deck_due').on(table.deckId, table.dueAt),
    index('idx_scheduling_deck_phase').on(table.deckId, table.phase),
  ],
);

export const reviewLogs = sqliteTable(
  'review_logs',
  {
    id: text('id').primaryKey(),
    cardId: text('card_id')
      .notNull()
      .references(() => cards.id, { onDelete: 'cascade' }),
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    sessionId: text('session_id'),
    reviewedAt: integer('reviewed_at').notNull(),
    rating: text('rating').notNull(),
    phaseBefore: text('phase_before').notNull(),
    easeBefore: real('ease_before'),
    intervalDaysBefore: real('interval_before').notNull(),
    dueAtBefore: integer('due_at_before').notNull(),
    reviewCountBefore: integer('review_count_before').notNull(),
    lapseCountBefore: integer('lapse_count_before').notNull(),
    phaseAfter: text('phase_after').notNull(),
    easeAfter: real('ease_after'),
    intervalDaysAfter: real('interval_after').notNull(),
    dueAtAfter: integer('due_at_after').notNull(),
    reviewDurationMs: integer('review_duration_ms'),
    scheduledDaysLate: real('scheduled_days_late').notNull().default(0),
    stabilityBefore: real('stability_before'),
    stabilityAfter: real('stability_after'),
    difficultyBefore: real('difficulty_before'),
    difficultyAfter: real('difficulty_after'),
    algorithm: text('algorithm').notNull(),
  },
  (table) => [
    index('idx_review_logs_card').on(table.cardId, table.reviewedAt),
    index('idx_review_logs_deck').on(table.deckId, table.reviewedAt),
  ],
);

export const dailyCounters = sqliteTable(
  'daily_counters',
  {
    deckId: text('deck_id')
      .notNull()
      .references(() => decks.id, { onDelete: 'cascade' }),
    date: text('date').notNull(),
    newCardsIntroduced: integer('new_cards_introduced').notNull().default(0),
    reviewsCompleted: integer('reviews_completed').notNull().default(0),
  },
  (table) => [
    primaryKey({ columns: [table.deckId, table.date] }),
    index('idx_daily_counters_deck_date').on(table.deckId, table.date),
  ],
);

export const appSettings = sqliteTable('app_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
});

export type DeckRow = typeof decks.$inferSelect;
export type CardRow = typeof cards.$inferSelect;
export type CardMediaRow = typeof cardMedia.$inferSelect;
export type CardSchedulingRow = typeof cardScheduling.$inferSelect;
export type ReviewLogRow = typeof reviewLogs.$inferSelect;
