import { classifyField, enrichWithPairedMedia } from './ankiFieldLayout';

export interface AnkiCardTemplate {
  qfmt: string;
  afmt: string;
}

function fieldKeyFromTag(tag: string): string {
  const trimmed = tag.trim();
  if (trimmed === 'FrontSide') return '__FrontSide__';
  const colon = trimmed.lastIndexOf(':');
  return colon >= 0 ? trimmed.slice(colon + 1).trim() : trimmed;
}

function isFieldEmpty(value: string | undefined): boolean {
  if (!value) return true;
  const stripped = value
    .replace(/<[^>]*>/g, '')
    .replace(/\[sound:[^\]]+\]/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
  return stripped.length === 0;
}

function replaceFieldTags(template: string, fieldsByName: Record<string, string>): string {
  return template.replace(/\{\{([^#/}^][^}]*)\}\}/g, (_, rawTag: string) => {
    const key = fieldKeyFromTag(rawTag);
    if (key === '__FrontSide__') return '';
    return fieldsByName[key] ?? '';
  });
}

function applyConditionals(template: string, fieldsByName: Record<string, string>): string {
  let result = template;
  let prev = '';

  while (result !== prev) {
    prev = result;
    result = result.replace(
      /\{\{#\s*([^}]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
      (_, rawTag: string, inner: string) => {
        const key = fieldKeyFromTag(rawTag);
        return isFieldEmpty(fieldsByName[key]) ? '' : inner;
      },
    );
    result = result.replace(
      /\{\{\^\s*([^}]+)\s*\}\}([\s\S]*?)\{\{\/\s*\1\s*\}\}/g,
      (_, rawTag: string, inner: string) => {
        const key = fieldKeyFromTag(rawTag);
        return isFieldEmpty(fieldsByName[key]) ? inner : '';
      },
    );
  }

  return result;
}

export function renderAnkiTemplate(
  template: string,
  fieldsByName: Record<string, string>,
  frontSide = '',
): string {
  let result = applyConditionals(template, fieldsByName);
  result = result.replace(/\{\{FrontSide\}\}/g, frontSide);
  result = replaceFieldTags(result, fieldsByName);
  return result;
}

export function buildFieldsByName(fieldNames: string[], values: string[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (let i = 0; i < fieldNames.length; i++) {
    map[fieldNames[i]] = values[i] ?? '';
  }
  return map;
}

const FRONT_FIELD_NAMES = [
  'front',
  'question',
  'word',
  'expression',
  'term',
  'prompt',
  'phrasal verb',
  'phrase',
  'verb',
];
const BACK_FIELD_NAMES = [
  'back',
  'answer',
  'definition',
  'meaning',
  'translation',
  'reading',
  'examples',
  'example',
  'definición',
  'definicion',
];

function findFieldIndex(fieldNames: string[], candidates: string[]): number {
  const lower = fieldNames.map((n) => n.toLowerCase());
  for (const candidate of candidates) {
    const idx = lower.indexOf(candidate);
    if (idx >= 0) return idx;
  }
  return -1;
}

function isMediaField(name: string, value: string): boolean {
  const kind = classifyField(name, value);
  return kind === 'audio' || kind === 'image';
}

export function fallbackFrontBack(
  fieldNames: string[],
  values: string[],
): { front: string; back: string } {
  const frontIdx = findFieldIndex(fieldNames, FRONT_FIELD_NAMES);
  const backIdx = findFieldIndex(fieldNames, BACK_FIELD_NAMES);

  if (frontIdx >= 0 && backIdx >= 0) {
    return {
      front: values[frontIdx] ?? '',
      back: values[backIdx] ?? '',
    };
  }

  if (frontIdx >= 0) {
    const backParts: string[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i === frontIdx) continue;
      const value = values[i]?.trim();
      if (!value || isMediaField(fieldNames[i], value)) continue;
      backParts.push(`<hr/><b>${fieldNames[i]}</b><br/>${value}`);
    }
    return { front: values[frontIdx] ?? '', back: backParts.join('') };
  }

  const firstTextIdx = fieldNames.findIndex(
    (name, i) => values[i]?.trim() && !isMediaField(name, values[i] ?? ''),
  );
  if (firstTextIdx >= 0) {
    const backParts: string[] = [];
    for (let i = 0; i < values.length; i++) {
      if (i === firstTextIdx) continue;
      const value = values[i]?.trim();
      if (!value || isMediaField(fieldNames[i], value)) continue;
      backParts.push(`<hr/><b>${fieldNames[i]}</b><br/>${value}`);
    }
    return {
      front: values[firstTextIdx] ?? '',
      back: backParts.join(''),
    };
  }

  return {
    front: values[0] ?? '',
    back: values.slice(1).filter(Boolean).join('<hr/>'),
  };
}

export function renderCardSides(
  templates: AnkiCardTemplate[] | undefined,
  templateOrd: number,
  fieldNames: string[],
  values: string[],
): { front: string; back: string } {
  const fieldsByName = buildFieldsByName(fieldNames, values);
  const template = templates?.[templateOrd];

  let front: string;
  let back: string;

  if (template?.qfmt) {
    front = renderAnkiTemplate(template.qfmt, fieldsByName);
    back = renderAnkiTemplate(template.afmt, fieldsByName, front);
  } else {
    const fallback = fallbackFrontBack(fieldNames, values);
    front = fallback.front;
    back = fallback.back;
  }

  return enrichWithPairedMedia(front, back, fieldNames, values);
}
