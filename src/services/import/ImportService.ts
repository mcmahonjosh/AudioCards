import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { Alert } from 'react-native';
import { createCard, getDeckById } from '@/src/db/repositories';
import { invalidateStatsData } from '@/src/context/statsInvalidation';
import { invalidateDeck, invalidateAllDecks } from '@/src/context/deckInvalidation';
import { parseCsvContent, ImportSummary, CsvRow } from './csvImporter';
import { PastedCardRow } from './pastedTextImporter';
import {
  apkgImporter,
  ApkgImportOptions,
  ApkgParseResult,
} from './apkgImporter';

/** Serialize native document picker sessions — concurrent getDocumentAsync throws on iOS. */
let documentPickChain: Promise<unknown> = Promise.resolve();

async function withDocumentPicker<T>(fn: () => Promise<T>): Promise<T> {
  const run = documentPickChain.then(fn, fn);
  documentPickChain = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

function isPickerInProgressError(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String(e);
  return /document picking in progress|await other document picking/i.test(msg);
}
export async function importCsvToDeck(deckId: string, fileUri: string): Promise<ImportSummary> {
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error('Deck not found');

  const content = await FileSystem.readAsStringAsync(fileUri);
  const { rows, errors } = parseCsvContent(content);

  return importCsvRowsToDeck(deckId, rows, errors);
}

export async function importCsvRowsToDeck(
  deckId: string,
  rows: CsvRow[],
  initialErrors: string[] = [],
): Promise<ImportSummary> {
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error('Deck not found');

  let created = 0;
  let skipped = 0;
  const errors = [...initialErrors];

  for (const row of rows) {
    try {
      await createCard({
        deckId,
        frontText: row.front,
        backText: row.back,
        frontLocale: row.frontLocale ?? deck.frontLocale,
        backLocale: row.backLocale ?? deck.backLocale,
        tags: row.tags,
      });
      created++;
    } catch {
      skipped++;
      errors.push(`Failed to import: ${row.front.slice(0, 30)}`);
    }
  }

  invalidateStatsData();
  invalidateDeck(deckId);
  return { created, skipped, errors };
}

export async function previewCsvFile(
  fileUri: string,
): Promise<{ rows: CsvRow[]; errors: string[] }> {
  const content = await FileSystem.readAsStringAsync(fileUri);
  return parseCsvContent(content);
}

export async function pickCsvFile(): Promise<string | null> {
  try {
    const result = await withDocumentPicker(() =>
      DocumentPicker.getDocumentAsync({
        type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
        copyToCacheDirectory: true,
      }),
    );

    if (result.canceled || !result.assets?.[0]) return null;
    return result.assets[0].uri;
  } catch (e) {
    if (isPickerInProgressError(e)) {
      Alert.alert(
        'File picker busy',
        'Another file picker is still open. Close it, then try again.',
      );
      return null;
    }
    throw e;
  }
}

export async function importPastedRowsToDeck(
  deckId: string,
  rows: PastedCardRow[],
): Promise<ImportSummary> {
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error('Deck not found');

  let created = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    try {
      await createCard({
        deckId,
        frontText: row.front,
        backText: row.back,
        frontLocale: deck.frontLocale,
        backLocale: deck.backLocale,
        contentFormat: 'plain',
      });
      created++;
    } catch {
      skipped++;
      errors.push(`Failed to import row ${row.lineNumber}: ${row.front.slice(0, 30)}`);
    }
  }

  invalidateStatsData();
  invalidateDeck(deckId);
  return { created, skipped, errors };
}

export async function pickAndImportCsv(deckId: string): Promise<ImportSummary | null> {
  const uri = await pickCsvFile();
  if (!uri) return null;
  return importCsvToDeck(deckId, uri);
}

export async function pickApkgFile(): Promise<string | null> {
  try {
    const result = await withDocumentPicker(() =>
      DocumentPicker.getDocumentAsync({
        type: ['application/octet-stream', '*/*'],
        copyToCacheDirectory: true,
      }),
    );

    if (result.canceled || !result.assets?.[0]) return null;
    const asset = result.assets[0];
    const uri = asset.uri;
    const name = asset.name ?? '';
    const looksLikeApkg =
      uri.toLowerCase().endsWith('.apkg') || name.toLowerCase().endsWith('.apkg');
    if (looksLikeApkg) return uri;

    Alert.alert(
      'Invalid file',
      'Please choose an Anki package file (.apkg).',
    );
    return null;
  } catch (e) {
    if (isPickerInProgressError(e)) {
      Alert.alert(
        'File picker busy',
        'Another file picker is still open. Close it, then try again.',
      );
      return null;
    }
    throw e;
  }
}

export async function parseApkgFile(
  fileUri: string,
  onProgress?: (progress: { current: number; total: number; phase: string }) => void,
): Promise<ApkgParseResult> {
  return apkgImporter.parse(fileUri, onProgress);
}

export async function importApkg(
  parseResult: ApkgParseResult,
  options: ApkgImportOptions,
): Promise<ImportSummary> {
  const result = await apkgImporter.importToDb(parseResult, options);
  invalidateStatsData();
  invalidateAllDecks();
  return result;
}

export function formatImportSummary(result: ImportSummary): string {
  const lines = [
    `Created ${result.created} cards`,
    `Skipped ${result.skipped}`,
  ];
  if (result.decksCreated) lines.push(`Decks created: ${result.decksCreated}`);
  if (result.mediaFiles) lines.push(`Media files: ${result.mediaFiles}`);
  if (result.schedulingMapped) lines.push(`Scheduling preserved: ${result.schedulingMapped}`);
  if (result.revlogImported) lines.push(`Review history: ${result.revlogImported}`);
  if (result.reversedSkipped) lines.push(`Reversed cards skipped: ${result.reversedSkipped}`);
  if (result.errors.length) {
    lines.push('', 'Notes:', ...result.errors.slice(0, 3));
  }
  return lines.join('\n');
}

export { apkgImporter };
