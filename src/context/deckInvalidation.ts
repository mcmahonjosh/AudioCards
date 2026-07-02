const DEBOUNCE_MS = 400;

type DeckInvalidationTarget = string | 'all';

let invalidationHandler: ((target: DeckInvalidationTarget) => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let pendingTarget: DeckInvalidationTarget | null = null;

export function registerDeckInvalidationHandler(
  handler: (target: DeckInvalidationTarget) => void,
): void {
  invalidationHandler = handler;
}

export function unregisterDeckInvalidationHandler(): void {
  invalidationHandler = null;
  pendingTarget = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function scheduleInvalidation(target: DeckInvalidationTarget): void {
  if (!invalidationHandler) return;

  if (pendingTarget === 'all' || target === 'all') {
    pendingTarget = 'all';
  } else if (pendingTarget === null) {
    pendingTarget = target;
  } else if (pendingTarget !== target) {
    pendingTarget = 'all';
  }

  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    const next = pendingTarget ?? target;
    pendingTarget = null;
    invalidationHandler?.(next);
  }, DEBOUNCE_MS);
}

export function invalidateDeck(deckId: string): void {
  scheduleInvalidation(deckId);
}

export function invalidateAllDecks(): void {
  scheduleInvalidation('all');
}
