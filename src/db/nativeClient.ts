import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import * as schema from './schema';
import { MIGRATION_SQL } from './migrations/0000_initial';
import { MIGRATION_0001_SQL } from './migrations/0001_rich_content';
import { DATABASE_NAME, setNativeDb, type AppDatabase } from './client';

const MIGRATIONS: { id: string; sql: string; alter?: { table: string; column: string; def: string }[] }[] = [
  { id: '0000_initial', sql: MIGRATION_SQL },
  {
    id: '0001_rich_content',
    sql: MIGRATION_0001_SQL,
    alter: [{ table: 'cards', column: 'content_format', def: "TEXT NOT NULL DEFAULT 'plain'" }],
  },
];

let sqliteInstance: SQLiteDatabase | null = null;

export function getSQLite(): SQLiteDatabase {
  if (!sqliteInstance) {
    sqliteInstance = openDatabaseSync(DATABASE_NAME);
  }
  return sqliteInstance;
}

function columnExists(sqlite: SQLiteDatabase, table: string, column: string): boolean {
  const cols = sqlite.getAllSync<{ name: string }>(`PRAGMA table_info(${table})`);
  return cols.some((c) => c.name === column);
}

export function runMigrations(): void {
  const sqlite = getSQLite();
  setNativeDb(drizzle(sqlite, { schema }) as AppDatabase);

  sqlite.execSync(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY NOT NULL,
      applied_at INTEGER NOT NULL
    );
  `);

  for (const migration of MIGRATIONS) {
    const applied = sqlite.getFirstSync<{ id: string }>(
      'SELECT id FROM schema_migrations WHERE id = ?',
      [migration.id],
    );
    if (applied) continue;

    if (migration.alter) {
      for (const { table, column, def } of migration.alter) {
        if (!columnExists(sqlite, table, column)) {
          sqlite.execSync(`ALTER TABLE ${table} ADD COLUMN ${column} ${def}`);
        }
      }
    }

    sqlite.execSync(migration.sql);
    sqlite.runSync('INSERT INTO schema_migrations (id, applied_at) VALUES (?, ?)', [
      migration.id,
      Date.now(),
    ]);
  }
}
