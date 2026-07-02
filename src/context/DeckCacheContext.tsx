import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useAppContext } from '@/src/context/AppContext';
import {
  invalidateAllDecks,
  invalidateDeck,
  registerDeckInvalidationHandler,
  unregisterDeckInvalidationHandler,
} from '@/src/context/deckInvalidation';
import {
  DeckSnapshot,
  fetchDeckSnapshot,
  ReviewInitialSnapshot,
} from '@/src/context/deckSnapshot';

export type DeckLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface DeckCacheContextValue {
  getDeckSnapshot: (deckId: string) => DeckSnapshot | null;
  getDeckStatus: (deckId: string) => DeckLoadStatus;
  isDeckRefreshing: (deckId: string) => boolean;
  isDeckStale: (deckId: string) => boolean;
  refreshDeckData: (deckId: string) => Promise<DeckSnapshot | null>;
  preloadDeck: (deckId: string) => void;
  getReviewInitialSnapshot: (deckId: string) => ReviewInitialSnapshot | null;
}

const DeckCacheContext = createContext<DeckCacheContextValue>({
  getDeckSnapshot: () => null,
  getDeckStatus: () => 'idle',
  isDeckRefreshing: () => false,
  isDeckStale: () => false,
  refreshDeckData: async () => null,
  preloadDeck: () => {},
  getReviewInitialSnapshot: () => null,
});

export function DeckCacheProvider({ children }: { children: React.ReactNode }) {
  const { dbReady, settings } = useAppContext();
  const [snapshots, setSnapshots] = useState<Record<string, DeckSnapshot>>({});
  const [statusByDeck, setStatusByDeck] = useState<Record<string, DeckLoadStatus>>({});
  const [refreshingByDeck, setRefreshingByDeck] = useState<Record<string, boolean>>({});
  const [staleByDeck, setStaleByDeck] = useState<Record<string, boolean>>({});
  const refreshInFlight = useRef<Partial<Record<string, Promise<DeckSnapshot | null>>>>({});
  const snapshotsRef = useRef(snapshots);
  snapshotsRef.current = snapshots;

  const refreshDeckData = useCallback(
    async (deckId: string): Promise<DeckSnapshot | null> => {
      if (!dbReady) return null;
      const inFlight = refreshInFlight.current[deckId];
      if (inFlight) return inFlight;

      const promise = (async () => {
        setRefreshingByDeck((prev) => ({ ...prev, [deckId]: true }));
        if (!snapshotsRef.current[deckId]) {
          setStatusByDeck((prev) => ({ ...prev, [deckId]: 'loading' }));
        }

        try {
          const snapshot = await fetchDeckSnapshot(deckId, settings.defaultNewCardsPerDay);
          if (snapshot) {
            setSnapshots((prev) => ({ ...prev, [deckId]: snapshot }));
            setStaleByDeck((prev) => ({ ...prev, [deckId]: false }));
            setStatusByDeck((prev) => ({ ...prev, [deckId]: 'ready' }));
          } else {
            setStatusByDeck((prev) => ({
              ...prev,
              [deckId]: snapshotsRef.current[deckId] ? 'ready' : 'error',
            }));
          }
          return snapshot;
        } catch {
          setStatusByDeck((prev) => ({
            ...prev,
            [deckId]: snapshotsRef.current[deckId] ? 'ready' : 'error',
          }));
          return snapshotsRef.current[deckId] ?? null;
        } finally {
          setRefreshingByDeck((prev) => ({ ...prev, [deckId]: false }));
          delete refreshInFlight.current[deckId];
        }
      })();

      refreshInFlight.current[deckId] = promise;
      return promise;
    },
    [dbReady, settings.defaultNewCardsPerDay],
  );

  const preloadDeck = useCallback(
    (deckId: string) => {
      if (!dbReady || refreshInFlight.current[deckId] !== undefined) return;
      const snapshot = snapshotsRef.current[deckId];
      if (snapshot && !staleByDeck[deckId]) return;
      void refreshDeckData(deckId);
    },
    [dbReady, staleByDeck, refreshDeckData],
  );

  const getDeckSnapshot = useCallback(
    (deckId: string) => snapshots[deckId] ?? null,
    [snapshots],
  );

  const getDeckStatus = useCallback(
    (deckId: string) => statusByDeck[deckId] ?? 'idle',
    [statusByDeck],
  );

  const isDeckRefreshing = useCallback(
    (deckId: string) => refreshingByDeck[deckId] ?? false,
    [refreshingByDeck],
  );

  const isDeckStale = useCallback(
    (deckId: string) => staleByDeck[deckId] ?? false,
    [staleByDeck],
  );

  const getReviewInitialSnapshot = useCallback(
    (deckId: string): ReviewInitialSnapshot | null => {
      const snapshot = snapshotsRef.current[deckId];
      if (!snapshot || staleByDeck[deckId]) return null;
      return {
        deck: snapshot.deck,
        cards: snapshot.cards,
        newCardsIntroducedToday: snapshot.newCardsIntroducedToday,
      };
    },
    [staleByDeck],
  );

  useEffect(() => {
    registerDeckInvalidationHandler((target) => {
      if (target === 'all') {
        setStaleByDeck((prev) => {
          const next = { ...prev };
          for (const deckId of Object.keys(snapshotsRef.current)) {
            next[deckId] = true;
          }
          return next;
        });
        for (const deckId of Object.keys(snapshotsRef.current)) {
          void refreshDeckData(deckId);
        }
        return;
      }

      setStaleByDeck((prev) => ({ ...prev, [target]: true }));
      void refreshDeckData(target);
    });
    return unregisterDeckInvalidationHandler;
  }, [refreshDeckData]);

  return (
    <DeckCacheContext.Provider
      value={{
        getDeckSnapshot,
        getDeckStatus,
        isDeckRefreshing,
        isDeckStale,
        refreshDeckData,
        preloadDeck,
        getReviewInitialSnapshot,
      }}
    >
      {children}
    </DeckCacheContext.Provider>
  );
}

export function useDeckCache() {
  return useContext(DeckCacheContext);
}

export { invalidateDeck, invalidateAllDecks } from '@/src/context/deckInvalidation';
