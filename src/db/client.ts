import type { BaseSQLiteDatabase } from 'drizzle-orm/sqlite-core';
import * as schema from './schema';

export const DATABASE_NAME = 'audio_cards';

export type AppDatabase = BaseSQLiteDatabase<'async' | 'sync', unknown, typeof schema>;

let nativeDb: AppDatabase | null = null;
let testDbOverride: AppDatabase | null = null;

export function setNativeDb(db: AppDatabase | null): void {
  nativeDb = db;
}

export function setDbForTests(db: AppDatabase | null): void {
  testDbOverride = db;
}

export function getDb(): AppDatabase {
  if (testDbOverride) return testDbOverride;
  if (!nativeDb) {
    throw new Error('Database not initialized');
  }
  return nativeDb;
}

export function resetDb(): void {
  nativeDb = null;
  testDbOverride = null;
}
