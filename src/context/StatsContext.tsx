import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { fetchStatsRawData, type StatsRawData } from '@/src/stats/StatsAggregator';
import { useAppContext } from '@/src/context/AppContext';
import {
  invalidateStatsData,
  registerStatsInvalidationHandler,
  unregisterStatsInvalidationHandler,
} from '@/src/context/statsInvalidation';

export type StatsLoadStatus = 'idle' | 'loading' | 'ready' | 'error';

interface StatsContextValue {
  rawData: StatsRawData | null;
  status: StatsLoadStatus;
  isRefreshing: boolean;
  isStale: boolean;
  refreshStatsData: () => Promise<void>;
  preloadStats: () => void;
  invalidateStats: () => void;
}

const StatsContext = createContext<StatsContextValue>({
  rawData: null,
  status: 'idle',
  isRefreshing: false,
  isStale: false,
  refreshStatsData: async () => {},
  preloadStats: () => {},
  invalidateStats: () => {},
});

export function StatsProvider({ children }: { children: React.ReactNode }) {
  const { dbReady } = useAppContext();
  const [rawData, setRawData] = useState<StatsRawData | null>(null);
  const [status, setStatus] = useState<StatsLoadStatus>('idle');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const refreshInFlight = useRef<Promise<void> | null>(null);
  const rawDataRef = useRef<StatsRawData | null>(null);
  rawDataRef.current = rawData;

  const refreshStatsData = useCallback(async () => {
    if (!dbReady) return;
    if (refreshInFlight.current) return refreshInFlight.current;

    const promise = (async () => {
      setIsRefreshing(true);
      if (!rawDataRef.current) setStatus('loading');

      try {
        const data = await fetchStatsRawData();
        setRawData(data);
        setIsStale(false);
        setStatus('ready');
      } catch {
        setStatus(rawDataRef.current ? 'ready' : 'error');
      } finally {
        setIsRefreshing(false);
        refreshInFlight.current = null;
      }
    })();

    refreshInFlight.current = promise;
    return promise;
  }, [dbReady]);

  const preloadStats = useCallback(() => {
    if (!dbReady || refreshInFlight.current) return;
    if (rawData && !isStale) return;
    void refreshStatsData();
  }, [dbReady, rawData, isStale, refreshStatsData]);

  const invalidateStats = useCallback(() => {
    setIsStale(true);
    invalidateStatsData();
  }, []);

  useEffect(() => {
    registerStatsInvalidationHandler(() => {
      setIsStale(true);
      void refreshStatsData();
    });
    return unregisterStatsInvalidationHandler;
  }, [refreshStatsData]);

  useEffect(() => {
    if (dbReady) preloadStats();
  }, [dbReady, preloadStats]);

  return (
    <StatsContext.Provider
      value={{
        rawData,
        status,
        isRefreshing,
        isStale,
        refreshStatsData,
        preloadStats,
        invalidateStats,
      }}
    >
      {children}
    </StatsContext.Provider>
  );
}

export function useStatsContext() {
  return useContext(StatsContext);
}

export { invalidateStatsData } from '@/src/context/statsInvalidation';
