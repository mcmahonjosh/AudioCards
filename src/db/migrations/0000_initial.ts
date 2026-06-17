export const MIGRATION_SQL = `
CREATE TABLE IF NOT EXISTS decks (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  front_locale TEXT NOT NULL DEFAULT 'en-US',
  back_locale TEXT NOT NULL DEFAULT 'es-MX',
  algorithm TEXT NOT NULL DEFAULT 'sm2',
  config_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY NOT NULL,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  front_text TEXT NOT NULL,
  back_text TEXT NOT NULL,
  front_locale TEXT NOT NULL,
  back_locale TEXT NOT NULL,
  tags TEXT,
  suspended INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS card_scheduling (
  card_id TEXT PRIMARY KEY NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  phase TEXT NOT NULL DEFAULT 'new',
  due_at INTEGER NOT NULL,
  review_count INTEGER NOT NULL DEFAULT 0,
  lapse_count INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at INTEGER,
  algorithm TEXT NOT NULL DEFAULT 'sm2',
  ease REAL,
  interval_days REAL NOT NULL DEFAULT 0,
  learning_step_index INTEGER NOT NULL DEFAULT 0,
  lapse_interval_days REAL,
  stability REAL,
  difficulty REAL,
  scheduled_days REAL,
  algorithm_state_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_scheduling_deck_due ON card_scheduling(deck_id, due_at);
CREATE INDEX IF NOT EXISTS idx_scheduling_deck_phase ON card_scheduling(deck_id, phase);

CREATE TABLE IF NOT EXISTS review_logs (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  session_id TEXT,
  reviewed_at INTEGER NOT NULL,
  rating TEXT NOT NULL,
  phase_before TEXT NOT NULL,
  ease_before REAL,
  interval_before REAL NOT NULL,
  due_at_before INTEGER NOT NULL,
  review_count_before INTEGER NOT NULL,
  lapse_count_before INTEGER NOT NULL,
  phase_after TEXT NOT NULL,
  ease_after REAL,
  interval_after REAL NOT NULL,
  due_at_after INTEGER NOT NULL,
  review_duration_ms INTEGER,
  scheduled_days_late REAL NOT NULL DEFAULT 0,
  stability_before REAL,
  stability_after REAL,
  difficulty_before REAL,
  difficulty_after REAL,
  algorithm TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_review_logs_card ON review_logs(card_id, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_review_logs_deck ON review_logs(deck_id, reviewed_at);

CREATE TABLE IF NOT EXISTS daily_counters (
  deck_id TEXT NOT NULL REFERENCES decks(id) ON DELETE CASCADE,
  date TEXT NOT NULL,
  new_cards_introduced INTEGER NOT NULL DEFAULT 0,
  reviews_completed INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (deck_id, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_counters_deck_date ON daily_counters(deck_id, date);

CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);
`;
