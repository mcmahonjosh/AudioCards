import { splitRowColumns } from './csvImporter';

export type ColSeparatorKind = 'comma' | 'custom';
export type RowSeparatorKind = 'newline' | 'semicolon' | 'custom';

export interface PastedTextParseOptions {
  colSeparator: ColSeparatorKind;
  customColSeparator?: string;
  rowSeparator: RowSeparatorKind;
  customRowSeparator?: string;
  skipFirstRow?: boolean;
}

export interface PastedCardRow {
  front: string;
  back: string;
  lineNumber: number;
}

export interface PastedTextParseResult {
  rows: PastedCardRow[];
  errors: string[];
  skippedEmpty: number;
  configError?: string;
}

function unquoteField(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim();
  }
  return trimmed;
}

function isMissingCustomSeparator(value?: string): boolean {
  return value === undefined || value === null || value === '';
}

function splitIntoRows(content: string, options: PastedTextParseOptions): string[] | null {
  const trimmed = content.trim();
  if (!trimmed) return [];

  switch (options.rowSeparator) {
    case 'newline':
      return trimmed.split(/\r?\n/).filter((line) => line.trim());
    case 'semicolon':
      return trimmed.split(';').filter((line) => line.trim());
    case 'custom': {
      const sep = options.customRowSeparator ?? '';
      if (isMissingCustomSeparator(options.customRowSeparator)) return null;
      return trimmed.split(sep).filter((line) => line.trim());
    }
    default:
      return trimmed.split(/\r?\n/).filter((line) => line.trim());
  }
}

function splitIntoColumns(line: string, options: PastedTextParseOptions): string[] | null {
  switch (options.colSeparator) {
    case 'comma':
      return splitRowColumns(line, ',', true).map(unquoteField);
    case 'custom': {
      if (isMissingCustomSeparator(options.customColSeparator)) return null;
      const sep = options.customColSeparator ?? '';
      return line.split(sep).map((col) => col.trim());
    }
    default:
      return splitRowColumns(line, ',', true).map(unquoteField);
  }
}

export function parsePastedText(
  content: string,
  options: PastedTextParseOptions,
): PastedTextParseResult {
  const errors: string[] = [];
  let skippedEmpty = 0;

  if (options.colSeparator === 'custom' && isMissingCustomSeparator(options.customColSeparator)) {
    return { rows: [], errors, skippedEmpty: 0, configError: 'Enter a column separator' };
  }
  if (options.rowSeparator === 'custom' && isMissingCustomSeparator(options.customRowSeparator)) {
    return { rows: [], errors, skippedEmpty: 0, configError: 'Enter a row separator' };
  }

  const rawRows = splitIntoRows(content, options);
  if (rawRows === null) {
    return { rows: [], errors, skippedEmpty: 0, configError: 'Enter a row separator' };
  }

  if (rawRows.length === 0) {
    return { rows: [], errors, skippedEmpty: 0 };
  }

  const startIndex = options.skipFirstRow ? 1 : 0;
  const rows: PastedCardRow[] = [];

  for (let i = startIndex; i < rawRows.length; i++) {
    const line = rawRows[i];
    const lineNumber = i + 1;
    const cols = splitIntoColumns(line, options);

    if (cols === null) {
      return { rows, errors, skippedEmpty, configError: 'Enter a column separator' };
    }

    if (cols.length < 2) {
      errors.push(`Row ${lineNumber}: expected at least 2 columns`);
      skippedEmpty++;
      continue;
    }

    const front = cols[0]?.trim() ?? '';
    const back = cols[1]?.trim() ?? '';

    if (!front || !back) {
      errors.push(`Row ${lineNumber}: missing front or back text`);
      skippedEmpty++;
      continue;
    }

    rows.push({ front, back, lineNumber });
  }

  return { rows, errors, skippedEmpty };
}
