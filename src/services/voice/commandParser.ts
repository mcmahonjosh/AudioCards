import { VoiceCommand, VOICE_COMMANDS } from './commands';

function normalize(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      matrix[i][j] =
        b[i - 1] === a[j - 1]
          ? matrix[i - 1][j - 1]
          : Math.min(
              matrix[i - 1][j - 1] + 1,
              matrix[i][j - 1] + 1,
              matrix[i - 1][j] + 1,
            );
    }
  }
  return matrix[b.length][a.length];
}

export function parseVoiceCommand(transcript: string): VoiceCommand | null {
  const normalized = normalize(transcript);
  if (!normalized) return null;

  // Exact match on full transcript or any word
  for (const def of VOICE_COMMANDS) {
    for (const alias of def.aliases) {
      const normAlias = normalize(alias);
      if (normalized === normAlias) return def.command;
      if (normalized.includes(normAlias)) return def.command;
    }
  }

  // Fuzzy match for single-word commands
  const words = normalized.split(/\s+/);
  for (const word of words) {
    for (const def of VOICE_COMMANDS) {
      for (const alias of def.aliases) {
        const normAlias = normalize(alias);
        if (normAlias.includes(' ')) continue;
        const dist = levenshtein(word, normAlias);
        if (dist <= 1 && word.length >= 3) return def.command;
      }
    }
  }

  return null;
}

export function ratingFromCommand(command: VoiceCommand): 'again' | 'hard' | 'good' | 'easy' | null {
  if (['again', 'hard', 'good', 'easy'].includes(command)) {
    return command as 'again' | 'hard' | 'good' | 'easy';
  }
  return null;
}
