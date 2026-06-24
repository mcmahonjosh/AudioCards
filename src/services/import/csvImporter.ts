export interface ImportSummary {
  created: number;
  skipped: number;
  errors: string[];
  decksCreated?: number;
  mediaFiles?: number;
  schedulingMapped?: number;
  revlogImported?: number;
  reversedSkipped?: number;
}

export interface CsvRow {
  front: string;
  back: string;
  tags?: string;
  frontLocale?: string;
  backLocale?: string;
}

export function parseCsvContent(content: string): { rows: CsvRow[]; errors: string[] } {
  const lines = content.split(/\r?\n/).filter((l) => l.trim());
  const errors: string[] = [];
  const rows: CsvRow[] = [];

  if (lines.length === 0) {
    return { rows, errors: ['File is empty'] };
  }

  const header = splitRowColumns(lines[0], ',', true).map((h) =>
    unquoteCsvField(h).toLowerCase(),
  );
  const frontIdx = header.indexOf('front');
  const backIdx = header.indexOf('back');

  if (frontIdx >= 0 && backIdx >= 0) {
    const tagsIdx = header.indexOf('tags');
    const frontLocaleIdx = header.indexOf('front_locale');
    const backLocaleIdx = header.indexOf('back_locale');

    for (let i = 1; i < lines.length; i++) {
      const cols = parseCsvLine(lines[i]);
      const front = unquoteCsvField(cols[frontIdx] ?? '');
      const back = unquoteCsvField(cols[backIdx] ?? '');

      if (!front || !back) {
        errors.push(`Row ${i + 1}: missing front or back text`);
        continue;
      }

      rows.push({
        front,
        back,
        tags: tagsIdx >= 0 ? unquoteCsvField(cols[tagsIdx] ?? '') : undefined,
        frontLocale:
          frontLocaleIdx >= 0 ? unquoteCsvField(cols[frontLocaleIdx] ?? '') : undefined,
        backLocale:
          backLocaleIdx >= 0 ? unquoteCsvField(cols[backLocaleIdx] ?? '') : undefined,
      });
    }

    return { rows, errors };
  }

  const useTab = lines.every((line) => !line.includes(',') && line.includes('\t'));

  for (let i = 0; i < lines.length; i++) {
    const cols = useTab ? lines[i].split('\t') : parseCsvLine(lines[i]);

    if (cols.length < 2) {
      errors.push(`Row ${i + 1}: expected at least 2 columns`);
      continue;
    }

    const front = unquoteCsvField(cols[0] ?? '');
    const back = unquoteCsvField(cols[1] ?? '');

    if (!front || !back) {
      errors.push(`Row ${i + 1}: missing front or back text`);
      continue;
    }

    rows.push({ front, back });
  }

  return { rows, errors };
}

function unquoteCsvField(value: string): string {
  const trimmed = value.trim();
  if (trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/""/g, '"').trim();
  }
  return trimmed;
}

function parseCsvLine(line: string): string[] {
  return splitRowColumns(line, ',', true);
}

/** Split a row by delimiter; quote-aware when delimiter is comma. */
export function splitRowColumns(
  line: string,
  delimiter: string,
  quoteAware: boolean,
): string[] {
  if (!quoteAware || delimiter !== ',') {
    return line.split(delimiter);
  }

  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === delimiter && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
