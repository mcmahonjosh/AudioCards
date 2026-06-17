import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { createCard, getDeckById } from '@/src/db/repositories';
import { parseCsvContent, ImportSummary } from './csvImporter';
import { apkgImporter, ApkgParseResult } from './apkgImporter';

export async function importCsvToDeck(deckId: string, fileUri: string): Promise<ImportSummary> {
  const deck = await getDeckById(deckId);
  if (!deck) throw new Error('Deck not found');

  const content = await FileSystem.readAsStringAsync(fileUri);
  const { rows, errors } = parseCsvContent(content);

  let created = 0;
  let skipped = 0;

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

  return { created, skipped, errors };
}

export async function pickAndImportCsv(deckId: string): Promise<ImportSummary | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['text/csv', 'text/comma-separated-values', 'text/plain'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  return importCsvToDeck(deckId, result.assets[0].uri);
}

export async function pickApkgFile(): Promise<string | null> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/octet-stream', '*/*'],
    copyToCacheDirectory: true,
  });

  if (result.canceled || !result.assets?.[0]) return null;
  const uri = result.assets[0].uri;
  if (await apkgImporter.canImport(uri)) return uri;
  return null;
}

export async function importApkg(_deckId: string, fileUri: string): Promise<ImportSummary> {
  const result: ApkgParseResult = await apkgImporter.parse(fileUri);
  return apkgImporter.importToDb(result);
}

export { apkgImporter };
