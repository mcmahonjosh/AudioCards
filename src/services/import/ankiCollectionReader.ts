import initSqlJs, { type Database, type SqlJsStatic } from 'sql.js/dist/sql-asm.js';

export interface ApkgSqliteReader {
  getFirstAsync<T>(sql: string, params?: unknown[]): Promise<T | null>;
  getAllAsync<T>(sql: string, params?: unknown[]): Promise<T[]>;
  closeAsync(): Promise<void>;
}

let sqlJsPromise: Promise<SqlJsStatic> | null = null;

async function getSqlJs(): Promise<SqlJsStatic> {
  if (!sqlJsPromise) {
    sqlJsPromise = initSqlJs();
  }
  return sqlJsPromise;
}

class SqlJsReader implements ApkgSqliteReader {
  constructor(private readonly db: Database) {}

  getFirstAsync<T>(sql: string, params: unknown[] = []): Promise<T | null> {
    const stmt = this.db.prepare(sql);
    try {
      if (params.length > 0) stmt.bind(params);
      if (stmt.step()) {
        return Promise.resolve(stmt.getAsObject() as T);
      }
      return Promise.resolve(null);
    } finally {
      stmt.free();
    }
  }

  getAllAsync<T>(sql: string, params: unknown[] = []): Promise<T[]> {
    const stmt = this.db.prepare(sql);
    const rows: T[] = [];
    try {
      if (params.length > 0) stmt.bind(params);
      while (stmt.step()) {
        rows.push(stmt.getAsObject() as T);
      }
    } finally {
      stmt.free();
    }
    return Promise.resolve(rows);
  }

  closeAsync(): Promise<void> {
    this.db.close();
    return Promise.resolve();
  }
}

export async function openAnkiCollectionReader(bytes: Uint8Array): Promise<ApkgSqliteReader> {
  const SQL = await getSqlJs();
  const db = new SQL.Database(bytes);
  return new SqlJsReader(db);
}
