import { ImportSummary } from './csvImporter';
import JSZip from 'jszip';
import {
  createCard,
  createDeck,
  findDeckByName,
  getDeckById,
  insertReviewLog,
} from '@/src/db/repositories';
import { generateId } from '@/src/db/mappers';
import {
  extractMediaFilenames,
  inferMediaType,
  rewriteMediaUris,
  stripEmbeddedDataUris,
} from '@/src/services/media/ankiHtmlParser';
import {
  AnkiCardRow as AnkiSchedulingCardRow,
  AnkiRevlogRow,
  buildSchedulingState,
  mapAnkiCardScheduling,
  mapAnkiRevlog,
} from './ankiSchedulingMapper';
import { CardSchedulingState, CardMediaType } from '@/src/models/types';
import {
  ensureDirectory,
  joinPath,
  readUriAsUint8Array,
  safeBasename,
  utf8FromBytes,
  writeBytesToFile,
} from './apkgFileUtils';
import * as FileSystem from 'expo-file-system';
import {
  ApkgCollectionFormat,
  collectionZipName,
  decompressZstd,
  maybeDecompressZstd,
  normalizeMediaName,
  parseMediaEntriesProtobuf,
  selectCollectionFormat,
} from './ankiFormat';
import {
  getNoteModelColumn,
  loadDeckNames,
  loadFieldNamesByNotetype,
  loadTemplatesByNotetype,
} from './ankiSchema';
import { openAnkiCollectionReader } from './ankiCollectionReader';
import { renderCardSides } from './ankiTemplateRenderer';
import { normalizeAllFieldValues } from './ankiFieldLayout';

export interface ApkgDeck {
  id: string;
  name: string;
  noteCount: number;
}

export interface ApkgNoteMedia {
  sourceName: string;
  localUri: string;
  mediaType: CardMediaType;
}

export interface ApkgNote {
  ankiNoteId: string;
  ankiCardId: string;
  front: string;
  back: string;
  tags?: string;
  deckId: string;
  media: ApkgNoteMedia[];
  scheduling?: ReturnType<typeof mapAnkiCardScheduling>;
}

export interface ApkgParseResult {
  decks: ApkgDeck[];
  notes: ApkgNote[];
  media: Record<string, string>;
  collectionCrt: number;
  revlogsByCardId: Record<string, AnkiRevlogRow[]>;
  stats: {
    notesInPackage: number;
    cardsInPackage: number;
    notesParsed: number;
  };
}

export interface ApkgImportOptions {
  selectedDeckIds: string[];
  frontLocale?: string;
  backLocale?: string;
  frontVoiceId?: string | null;
  backVoiceId?: string | null;
  /** When set, append all selected Anki cards into this existing deck. */
  targetDeckId?: string;
  onProgress?: (progress: { current: number; total: number; phase: string }) => void;
}

export interface ApkgImporter {
  canImport(fileUri: string): Promise<boolean>;
  parse(
    fileUri: string,
    onProgress?: (progress: { current: number; total: number; phase: string }) => void,
  ): Promise<ApkgParseResult>;
  importToDb(result: ApkgParseResult, options: ApkgImportOptions): Promise<ImportSummary>;
}

type AnkiColRow = {
  models: string;
  decks: string;
  crt: number;
};

type ApkgSqlCardRow = {
  id: string;
  nid: string;
  did: string;
  ord: number;
  type: number;
  queue: number;
  due: number;
  ivl: number;
  factor: number;
  reps: number;
  lapses: number;
  left: number;
};

type AnkiNoteRow = {
  id: string;
  modelId: string;
  flds: string;
  tags: string;
};

function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function collectMediaNames(...contents: string[]): string[] {
  const names = new Set<string>();
  for (const content of contents) {
    for (const name of extractMediaFilenames(content)) {
      names.add(normalizeMediaName(name));
    }
  }
  return [...names];
}

function hasDisplayableContent(front: string, back: string, mediaNames: string[]): boolean {
  const text = `${front} ${back}`.replace(/<[^>]*>/g, '').replace(/\[sound:[^\]]+\]/gi, '').trim();
  return text.length > 0 || mediaNames.length > 0;
}

class ApkgImporterImpl implements ApkgImporter {
  async canImport(fileUri: string): Promise<boolean> {
    return fileUri.toLowerCase().endsWith('.apkg');
  }

  async parse(
    fileUri: string,
    onProgress?: (progress: { current: number; total: number; phase: string }) => void,
  ): Promise<ApkgParseResult> {
    const cacheDir = FileSystem.cacheDirectory;
    const docDir = FileSystem.documentDirectory;
    if (!cacheDir || !docDir) throw new Error('File system not available');

    const workDir = joinPath(cacheDir, `apkg-${Date.now()}`);
    const mediaDir = joinPath(docDir, `media/import-${Date.now()}`);
    const localApkg = joinPath(workDir, 'package.apkg');
    await ensureDirectory(workDir);
    await ensureDirectory(mediaDir);

    onProgress?.({ current: 0, total: 100, phase: 'Copying package…' });
    await FileSystem.copyAsync({ from: fileUri, to: localApkg });

    onProgress?.({ current: 5, total: 100, phase: 'Reading package…' });
    const zipBytes = await readUriAsUint8Array(localApkg);
    onProgress?.({ current: 8, total: 100, phase: 'Unpacking…' });
    const zip = await JSZip.loadAsync(zipBytes, { checkCRC32: false });

    const collectionFormat = selectCollectionFormat(Object.keys(zip.files));
    if (!collectionFormat) {
      throw new Error('Invalid .apkg: missing collection database');
    }

    const zipCollectionName = collectionZipName(collectionFormat);
    const collectionEntry = zip.file(zipCollectionName);
    if (!collectionEntry) {
      throw new Error(`Invalid .apkg: missing ${zipCollectionName}`);
    }

    let collectionBytes = await collectionEntry.async('uint8array');
    if (collectionFormat === 'anki21b') {
      onProgress?.({ current: 12, total: 100, phase: 'Decompressing collection…' });
      collectionBytes = decompressZstd(collectionBytes);
    }

    onProgress?.({ current: 20, total: 100, phase: 'Reading notes…' });
    const db = await openAnkiCollectionReader(collectionBytes);

    const col = await db.getFirstAsync<AnkiColRow>(
      'SELECT models, decks, crt FROM col LIMIT 1',
    );
    const collectionCrt = col?.crt ?? Math.floor(Date.now() / 1000);
    const deckNames = await loadDeckNames(db);
    const fieldNamesByNotetype = await loadFieldNamesByNotetype(db);
    const templatesByNotetype = await loadTemplatesByNotetype(db);
    const noteModelColumn = await getNoteModelColumn(db);

    const deckNoteCounts = new Map<string, number>();
    const ankiCards = await db.getAllAsync<ApkgSqlCardRow>(
      `SELECT
        CAST(id AS TEXT) AS id,
        CAST(nid AS TEXT) AS nid,
        CAST(did AS TEXT) AS did,
        ord, type, queue, due, ivl, factor, reps, lapses, left
      FROM cards`,
    );
    const cardByNote = new Map<string, ApkgSqlCardRow>();
    let reversedSkipped = 0;

    for (const c of ankiCards) {
      const existing = cardByNote.get(c.nid);
      if (!existing) {
        cardByNote.set(c.nid, c);
      } else if (c.ord === 0 && existing.ord !== 0) {
        cardByNote.set(c.nid, c);
      } else if (c.ord !== 0 && existing.ord === 0) {
        reversedSkipped++;
      }
    }

    const revlogs = await db.getAllAsync<AnkiRevlogRow & { cid: string }>(
      'SELECT CAST(cid AS TEXT) AS cid, usn, ease, ivl, lastIvl, factor, time, type FROM revlog',
    );
    const revlogByCard = new Map<string, AnkiRevlogRow[]>();
    for (const row of revlogs) {
      const list = revlogByCard.get(row.cid) ?? [];
      list.push(row);
      revlogByCard.set(row.cid, list);
    }

    const notes = await db.getAllAsync<AnkiNoteRow>(
      `SELECT CAST(id AS TEXT) AS id, CAST(${noteModelColumn} AS TEXT) AS modelId, flds, tags FROM notes`,
    );
    const parsedNotes: ApkgNote[] = [];
    const neededMedia = new Set<string>();
    const totalNotes = notes.length;

    for (let noteIndex = 0; noteIndex < notes.length; noteIndex++) {
      const n = notes[noteIndex];
      if (noteIndex % 250 === 0) {
        onProgress?.({
          current: 20 + Math.round((noteIndex / Math.max(totalNotes, 1)) * 40),
          total: 100,
          phase: `Parsing notes (${noteIndex}/${totalNotes})`,
        });
      }
      const ankiCard = cardByNote.get(n.id);
      if (!ankiCard) continue;

      const deckId = ankiCard.did;
      const fieldNames = fieldNamesByNotetype.get(n.modelId) ?? [];
      const fields = String(n.flds ?? '').split('\u001f');
      const normalizedFields = normalizeAllFieldValues(fieldNames, fields);
      const templates = templatesByNotetype.get(n.modelId);
      const { front, back } = renderCardSides(templates, ankiCard.ord, fieldNames, fields);
      const mediaNames = collectMediaNames(front, back, ...normalizedFields);

      if (!hasDisplayableContent(front, back, mediaNames)) continue;

      deckNoteCounts.set(deckId, (deckNoteCounts.get(deckId) ?? 0) + 1);
      for (const name of mediaNames) neededMedia.add(name);

      parsedNotes.push({
        ankiNoteId: n.id,
        ankiCardId: ankiCard.id,
        front,
        back,
        tags: String(n.tags ?? '').trim() || undefined,
        deckId,
        media: [],
        scheduling: mapAnkiCardScheduling(
          {
            ...ankiCard,
            id: Number(ankiCard.id),
            nid: Number(ankiCard.nid),
            did: Number(ankiCard.did),
          } as AnkiSchedulingCardRow,
          collectionCrt,
          new Date(),
        ),
      });
    }

    const mediaMap = await this.extractMediaFiles(
      zip,
      neededMedia,
      mediaDir,
      collectionFormat,
      onProgress,
    );

    for (const note of parsedNotes) {
      const mediaNames = collectMediaNames(note.front, note.back);
      for (const name of mediaNames) {
        const localUri = mediaMap[name];
        const mediaType = inferMediaType(name);
        if (localUri && mediaType) {
          note.media.push({ sourceName: name, localUri, mediaType });
        }
      }
    }

    const revlogsByCardId: Record<string, AnkiRevlogRow[]> = {};
    for (const [cid, rows] of revlogByCard.entries()) {
      revlogsByCardId[cid] = rows;
    }

    const deckList: ApkgDeck[] = [...deckNoteCounts.entries()]
      .filter(([, count]) => count > 0)
      .map(([id, noteCount]) => ({
        id,
        name: deckNames.get(id) ?? `Deck ${id}`,
        noteCount,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    if (notes.length > 0 && parsedNotes.length === 0) {
      throw new Error(
        'Found notes in the package but none could be imported. The deck may use an unsupported note type (e.g. cloze).',
      );
    }

    if (notes.length === 0 && ankiCards.length === 0) {
      throw new Error(
        'Could not read cards from the package. The collection database may be corrupted.',
      );
    }

    await db.closeAsync().catch(() => {});
    onProgress?.({ current: 100, total: 100, phase: 'Parse complete' });

    return {
      decks: deckList,
      notes: parsedNotes,
      media: mediaMap,
      collectionCrt,
      revlogsByCardId,
      stats: {
        notesInPackage: notes.length,
        cardsInPackage: ankiCards.length,
        notesParsed: parsedNotes.length,
      },
    };
  }

  private async extractMediaFiles(
    zip: JSZip,
    neededMedia: Set<string>,
    mediaDir: string,
    collectionFormat: ApkgCollectionFormat,
    onProgress?: (progress: { current: number; total: number; phase: string }) => void,
  ): Promise<Record<string, string>> {
    const mediaMap: Record<string, string> = {};
    const mediaIndexEntry = zip.file('media');
    if (!mediaIndexEntry || neededMedia.size === 0) return mediaMap;

    const mediaIndexBytes = await mediaIndexEntry.async('uint8array');
    const filenameToIndex = new Map<string, string>();

    if (collectionFormat === 'anki21b') {
      let entryIndex = 0;
      for (const entry of parseMediaEntriesProtobuf(mediaIndexBytes)) {
        const zipIndex = String(entry.zipIndex ?? entryIndex);
        filenameToIndex.set(normalizeMediaName(entry.name), zipIndex);
        entryIndex++;
      }
    } else {
      const mediaIndexRaw = utf8FromBytes(mediaIndexBytes);
      const mediaIndex = safeJsonParse<Record<string, string>>(mediaIndexRaw, {});
      for (const [index, filename] of Object.entries(mediaIndex)) {
        if (filename) filenameToIndex.set(normalizeMediaName(filename), index);
      }
    }

    const neededList = [...neededMedia].map(normalizeMediaName);
    for (let i = 0; i < neededList.length; i++) {
      const filename = neededList[i];
      const index = filenameToIndex.get(filename);
      if (!index) continue;

      onProgress?.({
        current: 60 + Math.round((i / Math.max(neededList.length, 1)) * 35),
        total: 100,
        phase: `Extracting media (${i + 1}/${neededList.length})`,
      });

      const blob = zip.file(index);
      if (!blob) continue;
      let mediaBytes = await blob.async('uint8array');
      if (collectionFormat === 'anki21b') {
        mediaBytes = maybeDecompressZstd(mediaBytes);
      }
      const localName = safeBasename(filename);
      const dest = joinPath(mediaDir, localName);
      try {
        await writeBytesToFile(dest, mediaBytes);
        mediaMap[filename] = dest;
      } catch {
        // Skip media that cannot be written; card text still imports.
      }
    }

    return mediaMap;
  }

  async importToDb(result: ApkgParseResult, options: ApkgImportOptions): Promise<ImportSummary> {
    const selected = new Set(options.selectedDeckIds);
    if (selected.size === 0) throw new Error('Select at least one deck to import');

    const notesToImport = result.notes.filter((n) => selected.has(n.deckId));
    const total = notesToImport.length;
    let created = 0;
    let skipped = 0;
    let mediaFiles = 0;
    let schedulingMapped = 0;
    let revlogImported = 0;
    let decksCreated = 0;
    let reversedSkipped = 0;
    const errors: string[] = [];

    const deckIdMap = new Map<string, string>();
    const ankiDeckNames = new Map(result.decks.map((d) => [d.id, d.name]));

    if (options.targetDeckId) {
      const target = await getDeckById(options.targetDeckId);
      if (!target) {
        throw new Error('Target deck not found');
      }
      for (const ankiDeckId of selected) {
        deckIdMap.set(ankiDeckId, target.id);
      }
    } else {
      for (const ankiDeckId of selected) {
        const name = ankiDeckNames.get(ankiDeckId) ?? `Anki Deck ${ankiDeckId}`;
        let deck = await findDeckByName(name);
        if (!deck) {
          deck = await createDeck({
            name,
            frontLocale: options.frontLocale ?? 'en-US',
            backLocale: options.backLocale ?? 'es-MX',
            frontVoiceId: options.frontVoiceId ?? null,
            backVoiceId: options.backVoiceId ?? null,
          });
          decksCreated++;
        }
        deckIdMap.set(ankiDeckId, deck.id);
      }
    }

    const cardIdByAnkiCard = new Map<string, string>();
    const BATCH = 50;

    for (let i = 0; i < notesToImport.length; i++) {
      const note = notesToImport[i];
      if (i % BATCH === 0) {
        options.onProgress?.({
          current: i,
          total,
          phase: `Importing cards (${i}/${total})`,
        });
      }

      const targetDeckId = deckIdMap.get(note.deckId);
      if (!targetDeckId) {
        skipped++;
        continue;
      }

      const deck = await getDeckById(targetDeckId);
      if (!deck) {
        skipped++;
        continue;
      }

      try {
        const uriBySource: Record<string, string> = {};
        for (const m of note.media) {
          uriBySource[m.sourceName] = m.localUri;
        }
        const front = stripEmbeddedDataUris(rewriteMediaUris(note.front, uriBySource));
        const back = stripEmbeddedDataUris(rewriteMediaUris(note.back, uriBySource));

        let schedulingOverride: CardSchedulingState | undefined;
        if (note.scheduling) {
          schedulingOverride = buildSchedulingState('', targetDeckId, note.scheduling);
          schedulingMapped++;
        }

        const card = await createCard({
          deckId: targetDeckId,
          frontText: front,
          backText: back,
          frontLocale: deck.frontLocale,
          backLocale: deck.backLocale,
          frontVoiceId: deck.frontVoiceId,
          backVoiceId: deck.backVoiceId,
          tags: note.tags,
          contentFormat: 'html',
          suspended: note.scheduling?.suspended,
          scheduling: schedulingOverride,
          media: note.media,
        });

        cardIdByAnkiCard.set(note.ankiCardId, card.id);
        mediaFiles += note.media.length;
        created++;
      } catch (e) {
        skipped++;
        if (errors.length < 5) {
          const msg = e instanceof Error ? e.message : String(e);
          errors.push(`Card ${note.ankiCardId}: ${msg}`);
        }
      }
    }

    for (const note of notesToImport) {
      const cardId = cardIdByAnkiCard.get(note.ankiCardId);
      const targetDeckId = deckIdMap.get(note.deckId);
      const revlogs = result.revlogsByCardId[note.ankiCardId];
      if (!cardId || !targetDeckId || !revlogs?.length) continue;

      for (const row of revlogs) {
        const mapped = mapAnkiRevlog(row, result.collectionCrt);
        if (!mapped) continue;
        try {
          await insertReviewLog({
            id: generateId(),
            cardId,
            deckId: targetDeckId,
            reviewedAt: mapped.reviewedAt,
            rating: mapped.rating,
            phaseBefore: mapped.phaseBefore,
            easeBefore: null,
            intervalDaysBefore: mapped.intervalDaysBefore,
            dueAtBefore: mapped.reviewedAt,
            reviewCountBefore: 0,
            lapseCountBefore: 0,
            phaseAfter: mapped.phaseBefore,
            easeAfter: null,
            intervalDaysAfter: row.ivl > 0 ? row.ivl : mapped.intervalDaysBefore,
            dueAtAfter: mapped.reviewedAt,
            scheduledDaysLate: 0,
            algorithm: 'sm2',
          });
          revlogImported++;
        } catch {
          // skip unmappable revlog rows
        }
      }
    }

    options.onProgress?.({ current: total, total, phase: 'Done' });

    if (created === 0 && skipped === 0) {
      errors.push('No notes found to import (deck may be empty or unsupported note type).');
    }

    return {
      created,
      skipped,
      errors,
      decksCreated,
      mediaFiles,
      schedulingMapped,
      revlogImported,
      reversedSkipped,
    };
  }
}

export const apkgImporter: ApkgImporter = new ApkgImporterImpl();
