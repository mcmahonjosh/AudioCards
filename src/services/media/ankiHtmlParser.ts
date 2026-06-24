const SOUND_TAG_RE = /\[sound:([^\]]+)\]/gi;
const IMG_SRC_RE = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;

const AUDIO_EXT = /\.(mp3|ogg|wav|m4a|aac|flac)$/i;
const IMAGE_EXT = /\.(jpg|jpeg|png|gif|webp|svg|bmp)$/i;

export function inferMediaType(filename: string): 'image' | 'audio' | null {
  if (AUDIO_EXT.test(filename)) return 'audio';
  if (IMAGE_EXT.test(filename)) return 'image';
  return null;
}

export function normalizeMediaName(name: string): string {
  return name.normalize('NFC');
}

export function extractSoundFilenames(content: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(SOUND_TAG_RE.source, 'gi');
  while ((match = re.exec(content)) !== null) {
    names.push(normalizeMediaName(match[1]));
  }
  return names;
}

export function extractImageFilenames(content: string): string[] {
  const names: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(IMG_SRC_RE.source, 'gi');
  while ((match = re.exec(content)) !== null) {
    const src = match[1];
    if (!src.startsWith('http://') && !src.startsWith('https://') && !src.startsWith('data:')) {
      names.push(normalizeMediaName(src));
    }
  }
  return names;
}

export function extractMediaFilenames(content: string): string[] {
  return [...new Set([...extractSoundFilenames(content), ...extractImageFilenames(content)])];
}

export function stripHtmlForTts(html: string): string {
  return html
    .replace(SOUND_TAG_RE, ' ')
    .replace(/<hr\b[^>]*>/gi, '\n')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/?div>/gi, '\n')
    .replace(/<\/?p>/gi, '\n')
    .replace(/<li[^>]*>/gi, '\n• ')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function normalizeTextForCompare(text: string): string {
  return stripHtmlForTts(text).replace(/\s+/g, ' ').trim().toLowerCase();
}

function sectionDuplicatesFront(section: string, frontNorm: string): boolean {
  if (!frontNorm) return false;

  const sectionNorm = normalizeTextForCompare(section);
  if (!sectionNorm) return false;
  if (sectionNorm === frontNorm) return true;

  if (sectionNorm.startsWith(frontNorm)) {
    const rest = sectionNorm.slice(frontNorm.length).trim();
    if (!rest || /^[^\p{L}\p{N}]+$/u.test(rest)) return true;
  }

  return false;
}

export function splitBackSections(
  backText: string,
  contentFormat: 'plain' | 'html' = 'plain',
): string[] {
  if (contentFormat === 'html') {
    const parts = backText.split(/<hr\b[^>]*>/i).map((s) => s.trim()).filter(Boolean);
    if (parts.length > 1) return parts;
    return [backText];
  }

  const ruleParts = backText.split(/\n\s*-{3,}\s*\n/);
  if (ruleParts.length > 1) {
    return ruleParts.map((s) => s.trim()).filter(Boolean);
  }

  return [backText];
}

/** Back HTML often repeats the front (e.g. Spanish word, hr, English). Speak only the back-specific part. */
export function textForSideTts(
  side: 'front' | 'back',
  frontText: string,
  backText: string,
  contentFormat: 'plain' | 'html' = 'plain',
): string {
  if (side === 'front') return frontText;

  const frontNorm = normalizeTextForCompare(frontText);
  if (!frontNorm) return backText;

  const sections = splitBackSections(backText, contentFormat);
  const kept = sections.filter((section) => !sectionDuplicatesFront(section, frontNorm));

  if (kept.length > 0 && kept.length < sections.length) {
    return kept.join(contentFormat === 'html' ? '<br/>' : '\n');
  }

  const backNorm = normalizeTextForCompare(backText);
  if (backNorm.startsWith(frontNorm)) {
    const plainBack = stripHtmlForTts(backText);
    const plainFront = stripHtmlForTts(frontText).replace(/\s+/g, ' ').trim();
    if (plainBack.toLowerCase().startsWith(plainFront.toLowerCase())) {
      const remainder = plainBack.slice(plainFront.length).replace(/^[\s\-–—|:]+/, '').trim();
      if (remainder) return remainder;
    }
  }

  return backText;
}

export function plainTextPreview(text: string, contentFormat: 'plain' | 'html' = 'plain'): string {
  const plain = contentFormat === 'html' ? stripHtmlForTts(text) : text;
  const oneLine = plain.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 77)}…` : oneLine;
}

export function preprocessAnkiHtml(html: string): string {
  return html.replace(SOUND_TAG_RE, (_, filename: string) => {
    const safe = filename.replace(/"/g, '&quot;');
    return `<anki-sound data-filename="${safe}"></anki-sound>`;
  });
}

/** Drop Anki/CSS chrome that react-native-render-html cannot render safely. */
export function sanitizeAnkiHtmlForRender(html: string): string {
  return html
    .replace(/<link\b[^>]*\/?>/gi, '')
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<button\b[^>]*>([\s\S]*?)<\/button>/gi, '$1')
    .replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
}

export function stripEmbeddedDataUris(html: string): string {
  return html
    .replace(/<img[^>]+src=["']data:[^"']+["'][^>]*>/gi, '')
    .replace(/src=["']data:[^"']+["']/gi, 'src=""');
}

export function rewriteMediaUris(
  html: string,
  uriBySource: Record<string, string>,
): string {
  let result = html;
  for (const [source, uri] of Object.entries(uriBySource)) {
    const normalized = normalizeMediaName(source);
    const escaped = normalized.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(
      new RegExp(`(<img[^>]+src=["'])${escaped}(["'])`, 'gi'),
      `$1${uri}$2`,
    );
  }
  return result;
}
