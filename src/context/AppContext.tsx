import React, { createContext, useContext, useEffect, useState } from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import { runMigrations, DATABASE_NAME } from '@/src/db/client';
import { getAppSettings, saveAppSettings } from '@/src/db/repositories';
import { AppSettings } from '@/src/models/types';
import { DEFAULT_SETTINGS } from '@/src/constants';

interface AppContextValue {
  settings: AppSettings;
  updateSettings: (partial: Partial<AppSettings>) => Promise<void>;
  dbReady: boolean;
}

const AppContext = createContext<AppContextValue>({
  settings: DEFAULT_SETTINGS,
  updateSettings: async () => {},
  dbReady: false,
});

export function AppProvider({ children }: { children: React.ReactNode }) {
  return (
    <SQLiteProvider databaseName={DATABASE_NAME} onInit={() => runMigrations()}>
      <AppContextInner>{children}</AppContextInner>
    </SQLiteProvider>
  );
}

function AppContextInner({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    getAppSettings()
      .then(setSettings)
      .finally(() => setDbReady(true));
  }, []);

  const updateSettings = async (partial: Partial<AppSettings>) => {
    await saveAppSettings(partial);
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  return (
    <AppContext.Provider value={{ settings, updateSettings, dbReady }}>
      {children}
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
