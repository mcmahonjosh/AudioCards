export interface ImportSummary {
  created: number;
  skipped: number;
  errors: string[];
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

  const header = lines[0].split(',').map((h) => h.trim().toLowerCase().replace(/"/g, ''));
  const frontIdx = header.indexOf('front');
  const backIdx = header.indexOf('back');

  if (frontIdx === -1 || backIdx === -1) {
    // Try tab-separated or simple two-column without header
    if (lines.length >= 1 && !lines[0].includes(',')) {
      for (let i = 0; i < lines.length; i++) {
        const parts = lines[i].split('\t');
        if (parts.length >= 2) {
          rows.push({ front: parts[0].trim(), back: parts[1].trim() });
        }
      }
      return { rows, errors };
    }
    errors.push('CSV must have "front" and "back" columns');
    return { rows, errors };
  }

  const tagsIdx = header.indexOf('tags');
  const frontLocaleIdx = header.indexOf('front_locale');
  const backLocaleIdx = header.indexOf('back_locale');

  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    const front = cols[frontIdx]?.replace(/^"|"$/g, '').trim();
    const back = cols[backIdx]?.replace(/^"|"$/g, '').trim();

    if (!front || !back) {
      errors.push(`Row ${i + 1}: missing front or back text`);
      continue;
    }

    rows.push({
      front,
      back,
      tags: tagsIdx >= 0 ? cols[tagsIdx]?.replace(/^"|"$/g, '').trim() : undefined,
      frontLocale:
        frontLocaleIdx >= 0 ? cols[frontLocaleIdx]?.replace(/^"|"$/g, '').trim() : undefined,
      backLocale:
        backLocaleIdx >= 0 ? cols[backLocaleIdx]?.replace(/^"|"$/g, '').trim() : undefined,
    });
  }

  return { rows, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
