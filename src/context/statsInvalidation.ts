const DEBOUNCE_MS = 400;

let invalidationHandler: (() => void) | null = null;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;

export function registerStatsInvalidationHandler(handler: () => void): void {
  invalidationHandler = handler;
}

export function unregisterStatsInvalidationHandler(): void {
  invalidationHandler = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

export function invalidateStatsData(): void {
  if (!invalidationHandler) return;
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    invalidationHandler?.();
  }, DEBOUNCE_MS);
}
