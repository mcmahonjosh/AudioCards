import type { ApkgSqliteReader } from './ankiCollectionReader';

export async function tableExists(db: ApkgSqliteReader, name: string): Promise<boolean> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sqlite_master WHERE type='table' AND name = ?",
    [name],
  );
  return (row?.count ?? 0) > 0;
}

export async function loadDeckNames(db: ApkgSqliteReader): Promise<Map<string, string>> {
  const names = new Map<string, string>();

  if (await tableExists(db, 'decks')) {
    const rows = await db.getAllAsync<{ id: string; name: string }>(
      'SELECT CAST(id AS TEXT) AS id, name FROM decks',
    );
    for (const row of rows) {
      names.set(row.id, row.name || `Deck ${row.id}`);
    }
    if (names.size > 0) return names;
  }

  const col = await db.getFirstAsync<{ decks: string }>('SELECT decks FROM col LIMIT 1');
  const decks = safeJsonParse<Record<string, { name?: string }>>(col?.decks ?? '{}', {});
  for (const [id, deck] of Object.entries(decks)) {
    names.set(id, String(deck?.name ?? id));
  }
  return names;
}

export async function loadFieldNamesByNotetype(
  db: ApkgSqliteReader,
): Promise<Map<string, string[]>> {
  const fieldNames = new Map<string, string[]>();

  if (await tableExists(db, 'fields')) {
    const rows = await db.getAllAsync<{ ntid: string; ord: number; name: string }>(
      'SELECT CAST(ntid AS TEXT) AS ntid, ord, name FROM fields ORDER BY ntid, ord',
    );
    for (const row of rows) {
      const list = fieldNames.get(row.ntid) ?? [];
      list.push(row.name);
      fieldNames.set(row.ntid, list);
    }
    if (fieldNames.size > 0) return fieldNames;
  }

  const col = await db.getFirstAsync<{ models: string }>('SELECT models FROM col LIMIT 1');
  const models = safeJsonParse<Record<string, { flds?: { name: string }[] }>>(
    col?.models ?? '{}',
    {},
  );
  for (const [id, model] of Object.entries(models)) {
    fieldNames.set(id, (model?.flds ?? []).map((f) => f.name));
  }
  return fieldNames;
}

export interface AnkiCardTemplate {
  qfmt: string;
  afmt: string;
}

export async function loadTemplatesByNotetype(
  db: ApkgSqliteReader,
): Promise<Map<string, AnkiCardTemplate[]>> {
  const templates = new Map<string, AnkiCardTemplate[]>();

  if (await tableExists(db, 'templates')) {
    const rows = await db.getAllAsync<{ ntid: string; ord: number; qfmt: string; afmt: string }>(
      'SELECT CAST(ntid AS TEXT) AS ntid, ord, qfmt, afmt FROM templates ORDER BY ntid, ord',
    );
    for (const row of rows) {
      const list = templates.get(row.ntid) ?? [];
      list[row.ord] = { qfmt: row.qfmt, afmt: row.afmt };
      templates.set(row.ntid, list);
    }
    if (templates.size > 0) return templates;
  }

  const col = await db.getFirstAsync<{ models: string }>('SELECT models FROM col LIMIT 1');
  const models = safeJsonParse<Record<string, { tmpls?: { qfmt: string; afmt: string }[] }>>(
    col?.models ?? '{}',
    {},
  );
  for (const [id, model] of Object.entries(models)) {
    templates.set(
      id,
      (model?.tmpls ?? []).map((t) => ({ qfmt: t.qfmt, afmt: t.afmt })),
    );
  }
  return templates;
}

export async function getNoteModelColumn(db: ApkgSqliteReader): Promise<'mid' | 'ntid'> {
  const cols = await db.getAllAsync<{ name: string }>('PRAGMA table_info(notes)');
  if (cols.some((c) => c.name === 'ntid')) return 'ntid';
  return 'mid';
}

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}
