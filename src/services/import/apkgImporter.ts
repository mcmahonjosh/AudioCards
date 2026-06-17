import { ImportSummary } from './csvImporter';

export interface ApkgDeck {
  id: string;
  name: string;
}

export interface ApkgNote {
  front: string;
  back: string;
  tags?: string;
  deckId?: string;
}

export interface ApkgParseResult {
  decks: ApkgDeck[];
  notes: ApkgNote[];
  media: Record<string, string>;
}

export interface ApkgImporter {
  canImport(fileUri: string): Promise<boolean>;
  parse(fileUri: string): Promise<ApkgParseResult>;
  importToDb(result: ApkgParseResult, targetDeckId?: string): Promise<ImportSummary>;
}

class ApkgImporterStub implements ApkgImporter {
  async canImport(fileUri: string): Promise<boolean> {
    return fileUri.toLowerCase().endsWith('.apkg');
  }

  async parse(_fileUri: string): Promise<ApkgParseResult> {
    throw new Error(
      'Anki .apkg import is coming soon. Please use CSV import for now.',
    );
  }

  async importToDb(_result: ApkgParseResult, _targetDeckId?: string): Promise<ImportSummary> {
    throw new Error('Anki .apkg import is not yet available.');
  }
}

export const apkgImporter: ApkgImporter = new ApkgImporterStub();
