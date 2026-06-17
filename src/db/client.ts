import { drizzle, ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync, SQLiteDatabase } from 'expo-sqlite';
import * as schema from './schema';
import { MIGRATION_SQL } from './migrations/0000_initial';

export const DATABASE_NAME = 'audio_cards';

export type AppDatabase = ExpoSQLiteDatabase<typeof schema>;

let dbInstance: AppDatabase | null = null;
let sqliteInstance: SQLiteDatabase | null = null;

export function getSQLite(): SQLiteDatabase {
  if (!sqliteInstance) {
    sqliteInstance = openDatabaseSync(DATABASE_NAME);
  }
  return sqliteInstance;
}

export function getDb(): AppDatabase {
  if (!dbInstance) {
    dbInstance = drizzle(getSQLite(), { schema });
  }
  return dbInstance;
}

export function runMigrations(): void {
  const sqlite = getSQLite();
  sqlite.execSync(MIGRATION_SQL);
}

export function resetDb(): void {
  dbInstance = null;
  sqliteInstance = null;
}
