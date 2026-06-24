export const MIGRATION_0001_SQL = `
CREATE TABLE IF NOT EXISTS card_media (
  id TEXT PRIMARY KEY NOT NULL,
  card_id TEXT NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  local_uri TEXT NOT NULL,
  media_type TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_card_media_card ON card_media(card_id);
CREATE INDEX IF NOT EXISTS idx_card_media_source ON card_media(card_id, source_name);
`;
