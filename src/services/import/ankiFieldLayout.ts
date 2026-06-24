import {
  extractMediaFilenames,
  extractSoundFilenames,
  inferMediaType,
} from '@/src/services/media/ankiHtmlParser';

export type FieldKind = 'text' | 'audio' | 'image' | 'skip';

const AUDIO_NAME_RE = /sound|audio|pronunciation|tts/i;
const IMAGE_NAME_RE = /^image$|picture|photo|img/i;
const SOUND_TAG_INLINE_RE = /\[sound:[^\]]+\]/i;
const BARE_AUDIO_RE = /^[^\s<>"']+\.(mp3|ogg|wav|m4a|aac|flac)$/i;
const IMG_TAG_RE = /<img\b/i;

function stripForEmptyCheck(value: string): string {
  return value
    .replace(/<[^>]*>/g, '')
    .replace(/\[sound:[^\]]+\]/gi, '')
    .replace(/&nbsp;/gi, ' ')
    .trim();
}

export function normalizeFieldValue(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return trimmed;

  if (SOUND_TAG_INLINE_RE.test(trimmed)) {
    return trimmed;
  }

  if (BARE_AUDIO_RE.test(trimmed)) {
    return `[sound:${trimmed}]`;
  }

  return trimmed;
}

export function classifyField(name: string, value: string): FieldKind {
  const trimmed = value.trim();
  if (!trimmed) return 'skip';

  const normalized = normalizeFieldValue(value);
  if (AUDIO_NAME_RE.test(name) || extractSoundFilenames(normalized).length > 0) {
    return 'audio';
  }
  if (
    IMAGE_NAME_RE.test(name) ||
    IMG_TAG_RE.test(value) ||
    extractMediaFilenames(value).some((f) => inferMediaType(f) === 'image')
  ) {
    return 'image';
  }
  if (!stripForEmptyCheck(value)) return 'skip';
  return 'text';
}

function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const row = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const next = Math.min(row[j] + 1, prev + 1, row[j - 1] + cost);
      row[j - 1] = prev;
      prev = next;
    }
    row[b.length] = prev;
  }
  return row[b.length];
}

function stripSoundSuffix(name: string): string {
  return name
    .replace(/\s*[-–—]\s*sound\s*$/i, '')
    .replace(/\s+sound\s*$/i, '')
    .trim();
}

export function findParentField(
  mediaFieldName: string,
  allFieldNames: string[],
  allValues?: string[],
): string | null {
  const stripped = stripSoundSuffix(mediaFieldName);
  const normalizedTarget = normalizeName(stripped);

  const isTextParent = (name: string, index: number): boolean => {
    if (name === mediaFieldName) return false;
    if (allValues) {
      return classifyField(name, allValues[index] ?? '') === 'text';
    }
    return !AUDIO_NAME_RE.test(name);
  };

  for (let i = 0; i < allFieldNames.length; i++) {
    const candidate = allFieldNames[i];
    if (!isTextParent(candidate, i)) continue;
    if (normalizeName(candidate) === normalizedTarget) return candidate;
  }

  let best: { name: string; distance: number } | null = null;
  for (let i = 0; i < allFieldNames.length; i++) {
    const candidate = allFieldNames[i];
    if (!isTextParent(candidate, i)) continue;
    const dist = levenshtein(normalizeName(candidate), normalizedTarget);
    if (dist <= 2 && (!best || dist < best.distance)) {
      best = { name: candidate, distance: dist };
    }
  }

  return best?.name ?? null;
}

function escapeRegex(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function plainSnippet(value: string, maxLen = 40): string {
  const plain = stripForEmptyCheck(value);
  if (plain.length <= maxLen) return plain;
  return plain.slice(0, maxLen);
}

function sideContainsValue(side: string, value: string): boolean {
  if (!value.trim()) return false;
  const plain = stripForEmptyCheck(value);
  if (plain && side.includes(plain)) return true;
  const snippet = plainSnippet(value);
  return snippet.length >= 4 && side.includes(snippet);
}

function pickSide(front: string, back: string, parentValue: string): 'front' | 'back' {
  const onFront = sideContainsValue(front, parentValue);
  const onBack = sideContainsValue(back, parentValue);
  if (onFront && !onBack) return 'front';
  if (onBack && !onFront) return 'back';
  if (onFront && onBack) return 'back';
  return 'back';
}

function soundsAlreadyPresent(side: string, sounds: string[]): boolean {
  const existing = new Set(extractSoundFilenames(side).map((s) => s.normalize('NFC')));
  return sounds.every((s) => existing.has(s.normalize('NFC')));
}

function injectAfterParent(
  side: string,
  parentValue: string,
  injection: string,
): string {
  const plain = stripForEmptyCheck(parentValue);
  if (!plain) return `${side}${injection}`;

  const idx = side.indexOf(plain);
  if (idx >= 0) {
    const end = idx + plain.length;
    return `${side.slice(0, end)}${injection}${side.slice(end)}`;
  }

  const snippet = plainSnippet(parentValue);
  if (snippet.length >= 4) {
    const sidx = side.indexOf(snippet);
    if (sidx >= 0) {
      const end = sidx + snippet.length;
      return `${side.slice(0, end)}${injection}${side.slice(end)}`;
    }
  }

  return `${side}${injection}`;
}

function imageSrcFromValue(value: string): string | null {
  const trimmed = value.trim();
  const imgMatch = trimmed.match(/<img[^>]+src=["']([^"']+)["']/i);
  if (imgMatch) return imgMatch[1];
  if (inferMediaType(trimmed) === 'image') return trimmed;
  return null;
}

function imageAlreadyPresent(side: string, src: string): boolean {
  const escaped = escapeRegex(src);
  return new RegExp(`src=["']${escaped}["']`, 'i').test(side);
}

export function enrichWithPairedMedia(
  front: string,
  back: string,
  fieldNames: string[],
  values: string[],
): { front: string; back: string } {
  let enrichedFront = front;
  let enrichedBack = back;

  for (let i = 0; i < fieldNames.length; i++) {
    const name = fieldNames[i];
    const rawValue = values[i] ?? '';
    const kind = classifyField(name, rawValue);
    if (kind === 'skip' || kind === 'text') continue;

    const normalized = normalizeFieldValue(rawValue);
    const parentName = findParentField(name, fieldNames, values);
    const parentValue = parentName
      ? normalizeFieldValue(values[fieldNames.indexOf(parentName)] ?? '')
      : '';

    if (kind === 'audio') {
      const sounds = extractSoundFilenames(normalized);
      if (sounds.length === 0) continue;

      const soundTags = sounds.map((s) => `[sound:${s}]`).join('');
      const side = parentValue
        ? pickSide(enrichedFront, enrichedBack, parentValue)
        : 'back';
      const target = side === 'front' ? enrichedFront : enrichedBack;

      if (soundsAlreadyPresent(target, sounds)) continue;

      const injection = `<br/>${soundTags}`;
      if (parentValue && sideContainsValue(target, parentValue)) {
        const updated = injectAfterParent(target, parentValue, injection);
        if (side === 'front') enrichedFront = updated;
        else enrichedBack = updated;
      } else if (parentName) {
        const block = `<hr/><b>${parentName}</b><br/>${soundTags}`;
        enrichedBack = `${enrichedBack}${block}`;
      } else {
        const block = `<hr/><b>${name}</b><br/>${soundTags}`;
        enrichedBack = `${enrichedBack}${block}`;
      }
      continue;
    }

    if (kind === 'image') {
      const src = imageSrcFromValue(rawValue);
      if (!src) continue;

      const imgTag = rawValue.includes('<img')
        ? rawValue
        : `<img src="${src}">`;
      const side = parentValue
        ? pickSide(enrichedFront, enrichedBack, parentValue)
        : 'back';
      const target = side === 'front' ? enrichedFront : enrichedBack;

      if (imageAlreadyPresent(target, src)) continue;

      const injection = `<br/>${imgTag}`;
      if (parentValue && sideContainsValue(target, parentValue)) {
        const updated = injectAfterParent(target, parentValue, injection);
        if (side === 'front') enrichedFront = updated;
        else enrichedBack = updated;
      } else {
        enrichedBack = `${enrichedBack}${injection}`;
      }
    }
  }

  return { front: enrichedFront, back: enrichedBack };
}

export function normalizeAllFieldValues(
  fieldNames: string[],
  values: string[],
): string[] {
  return values.map((v, i) => {
    const kind = classifyField(fieldNames[i] ?? '', v ?? '');
    if (kind === 'audio') return normalizeFieldValue(v ?? '');
    return v ?? '';
  });
}
