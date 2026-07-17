import initSqlJs, { type Database } from 'sql.js/dist/sql-asm.js';
import { drizzle } from 'drizzle-orm/sql-js';
import * as schema from './schema';
import { MIGRATION_SQL } from './migrations/0000_initial';
import { MIGRATION_0001_SQL } from './migrations/0001_rich_content';
import { MIGRATION_0002_SQL } from './migrations/0002_voice_ids';
import { setDbForTests, type AppDatabase } from './client';

export interface TestDbHandle {
  db: AppDatabase;
  sqlite: Database;
}

export async function createTestDb(): Promise<TestDbHandle> {
  const SQL = await initSqlJs();
  const sqlite = new SQL.Database();

  sqlite.run(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);
  sqlite.run(MIGRATION_SQL);
  sqlite.run(MIGRATION_0001_SQL);
  sqlite.run("ALTER TABLE cards ADD COLUMN content_format TEXT NOT NULL DEFAULT 'plain'");
  sqlite.run(MIGRATION_0002_SQL);
  sqlite.run('ALTER TABLE decks ADD COLUMN front_voice_id TEXT');
  sqlite.run('ALTER TABLE decks ADD COLUMN back_voice_id TEXT');
  sqlite.run('ALTER TABLE cards ADD COLUMN front_voice_id TEXT');
  sqlite.run('ALTER TABLE cards ADD COLUMN back_voice_id TEXT');
  sqlite.run(
    "INSERT INTO schema_migrations (id, applied_at) VALUES ('0000_initial', ?), ('0001_rich_content', ?), ('0002_voice_ids', ?)",
    [Date.now(), Date.now(), Date.now()],
  );

  const db = drizzle(sqlite, { schema }) as AppDatabase;
  setDbForTests(db);
  return { db, sqlite };
}

export function closeTestDb(): void {
  setDbForTests(null);
}
