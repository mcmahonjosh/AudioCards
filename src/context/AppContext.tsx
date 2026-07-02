import React, { createContext, useContext, useEffect, useState } from 'react';
import { SQLiteProvider } from 'expo-sqlite';
import { DATABASE_NAME } from '@/src/db/client';
import { runMigrations } from '@/src/db/nativeClient';
import { getAppSettings, saveAppSettings } from '@/src/db/repositories';
import { AppSettings } from '@/src/models/types';
import { DEFAULT_SETTINGS } from '@/src/constants';
import { setupAudioOnLaunch } from '@/src/services/audio/audioSetup';
import { SafetyNoticeModal } from '@/src/components/SafetyNoticeModal';
import { VoiceIntroModal } from '@/src/components/VoiceIntroModal';

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
    <SQLiteProvider
      databaseName={DATABASE_NAME}
      onInit={async () => {
        runMigrations();
      }}
    >
      <AppContextInner>{children}</AppContextInner>
    </SQLiteProvider>
  );
}

function AppContextInner({ children }: { children: React.ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [dbReady, setDbReady] = useState(false);

  useEffect(() => {
    setupAudioOnLaunch().catch(() => {});

    getAppSettings()
      .then(setSettings)
      .catch(() => {})
      .finally(() => setDbReady(true));
  }, []);

  const updateSettings = async (partial: Partial<AppSettings>) => {
    await saveAppSettings(partial);
    setSettings((prev) => ({ ...prev, ...partial }));
  };

  const acknowledgeSafetyNotice = async () => {
    await updateSettings({ safetyNoticeAcknowledged: true });
  };

  const acknowledgeVoiceIntro = async () => {
    await updateSettings({ voiceIntroAcknowledged: true });
  };

  const showSafetyNotice =
    dbReady && !settings.safetyNoticeAcknowledged;

  const showVoiceIntro =
    dbReady &&
    settings.safetyNoticeAcknowledged &&
    !settings.voiceIntroAcknowledged;

  return (
    <AppContext.Provider value={{ settings, updateSettings, dbReady }}>
      {children}
      <SafetyNoticeModal
        visible={showSafetyNotice}
        onAcknowledge={() => acknowledgeSafetyNotice().catch(() => {})}
      />
      <VoiceIntroModal
        visible={showVoiceIntro}
        onAcknowledge={() => acknowledgeVoiceIntro().catch(() => {})}
      />
    </AppContext.Provider>
  );
}

export function useAppContext() {
  return useContext(AppContext);
}
