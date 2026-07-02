import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
  Linking,
  TouchableOpacity,
} from 'react-native';
import Constants from 'expo-constants';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { useAppContext } from '@/src/context/AppContext';
import { LocaleButton } from '@/src/components/LocalePicker';
import { VoicePicker } from '@/src/components/VoicePicker';
import { Button } from '@/src/components/Button';
import { NumberStepper } from '@/src/components/NumberStepper';
import { clampNewCardsPerDay } from '@/src/scheduler/newCardLimits';
import { VolumeSlider } from '@/src/components/VolumeSlider';
import { ttsService } from '@/src/services/tts/TtsService';
import { describeVoice } from '@/src/services/tts/voiceMatcher';
import { voiceCommandService } from '@/src/services/voice/VoiceCommandService';
import { getAppUrls } from '@/src/constants/urls';
import { SafetyNoticeModal } from '@/src/components/SafetyNoticeModal';
import { VoiceIntroModal } from '@/src/components/VoiceIntroModal';
import { HowToUseModal } from '@/src/components/HowToUseModal';

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppContext();
  const [voicePicker, setVoicePicker] = useState<'front' | 'back' | null>(null);
  const [permissions, setPermissions] = useState({ microphone: false, speechRecognition: false });
  const [voiceCount, setVoiceCount] = useState(0);
  const [frontVoiceLabel, setFrontVoiceLabel] = useState('');
  const [backVoiceLabel, setBackVoiceLabel] = useState('');
  const [localVolume, setLocalVolume] = useState(settings.speechVolume);
  const [safetyModal, setSafetyModal] = useState(false);
  const [voiceIntroModal, setVoiceIntroModal] = useState(false);
  const [howToUseModal, setHowToUseModal] = useState(false);

  useEffect(() => {
    setLocalVolume(settings.speechVolume);
  }, [settings.speechVolume]);

  useEffect(() => {
    ttsService.initialize().then(() => {
      setVoiceCount(ttsService.getVoices().length);
      setFrontVoiceLabel(describeVoice(ttsService.resolveVoice(settings.defaultFrontLocale)));
      setBackVoiceLabel(describeVoice(ttsService.resolveVoice(settings.defaultBackLocale)));
    });
    voiceCommandService.getPermissionStatus().then(setPermissions);
  }, [settings.defaultFrontLocale, settings.defaultBackLocale]);

  const requestPermissions = async () => {
    const granted = await voiceCommandService.requestPermissions();
    const status = await voiceCommandService.getPermissionStatus();
    setPermissions(status);
    if (!granted) {
      Alert.alert('Permissions Required', 'Microphone and speech recognition are needed for hands-free mode.');
    }
    return granted;
  };

  const handleHandsFreeToggle = async (enabled: boolean) => {
    if (enabled) {
      const granted = await requestPermissions();
      if (!granted) return;
    }
    await updateSettings({ handsFreeMode: enabled });
  };

  const previewVoice = async () => {
    await ttsService.speak(
      'Hello! This is a preview of the text to speech voice.',
      settings.defaultFrontLocale,
      { rate: settings.speechRate, volume: localVolume },
    );
  };

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.section}>Study Limits</Text>
      <Text style={styles.label}>Default new cards per day</Text>
      <Text style={styles.hint}>
        Applies to all decks unless a deck uses its own limit in Scheduler settings.
      </Text>
      <NumberStepper
        value={settings.defaultNewCardsPerDay}
        onChange={(v) => updateSettings({ defaultNewCardsPerDay: clampNewCardsPerDay(v) })}
      />

      <Text style={styles.section}>Voice & Audio</Text>

      <View style={styles.row}>
        <Text style={styles.label}>Speech Rate: {settings.speechRate.toFixed(1)}x</Text>
        <View style={styles.rateRow}>
          {[0.5, 0.75, 1.0, 1.25, 1.5].map((rate) => (
            <Button
              key={rate}
              title={`${rate}x`}
              variant={settings.speechRate === rate ? 'primary' : 'secondary'}
              onPress={() => updateSettings({ speechRate: rate })}
              style={styles.rateBtn}
            />
          ))}
        </View>
      </View>

      <VolumeSlider
        value={localVolume}
        onChange={setLocalVolume}
        onChangeComplete={(v) => updateSettings({ speechVolume: v })}
      />
      <Text style={styles.hint}>
        Max volume uses the main speaker and a louder voice profile. Also turn up your iPhone volume.
      </Text>

      <SettingToggle
        label="Auto-play front audio"
        value={settings.autoPlayFront}
        onChange={(v) => updateSettings({ autoPlayFront: v })}
      />
      <SettingToggle
        label="Auto-play back audio after flip"
        value={settings.autoPlayBack}
        onChange={(v) => updateSettings({ autoPlayBack: v })}
      />
      <SettingToggle
        label="Hands-free mode"
        subtitle="On by default — listen for voice commands during review"
        testID="settings-hands-free-toggle"
        value={settings.handsFreeMode}
        onChange={handleHandsFreeToggle}
      />

      <Button title="Preview Voice" onPress={previewVoice} variant="secondary" style={styles.previewBtn} />
      <Text style={styles.hint}>{voiceCount} TTS voices available on device</Text>
      <Text style={styles.hint}>
        Front voice: {frontVoiceLabel || 'Loading…'}
      </Text>
      <Text style={styles.hint}>
        Back voice: {backVoiceLabel || 'Loading…'}
      </Text>
      <Text style={styles.hint}>
        For better quality on iPhone: Settings → Accessibility → Spoken Content → Voices → download Enhanced voices for your languages.
      </Text>

      <Text style={styles.section}>Default Languages</Text>
      <LocaleButton
        locale={settings.defaultFrontLocale}
        label="Front Language"
        onPress={() => setVoicePicker('front')}
      />
      <LocaleButton
        locale={settings.defaultBackLocale}
        label="Back Language"
        onPress={() => setVoicePicker('back')}
      />

      <Text style={styles.section}>Permissions</Text>
      <View style={styles.permRow}>
        <Text style={styles.label}>Microphone</Text>
        <Text style={[styles.permStatus, { color: permissions.microphone ? Colors.success : Colors.error }]}>
          {permissions.microphone ? 'Granted' : 'Not granted'}
        </Text>
      </View>
      <View style={styles.permRow}>
        <Text style={styles.label}>Speech Recognition</Text>
        <Text style={[styles.permStatus, { color: permissions.speechRecognition ? Colors.success : Colors.error }]}>
          {permissions.speechRecognition ? 'Granted' : 'Not granted'}
        </Text>
      </View>
      <Button title="Request Permissions" onPress={requestPermissions} variant="secondary" />

      <Text style={styles.section}>About</Text>
      <Text style={styles.hint}>Version {Constants.expoConfig?.version ?? '1.0.0'}</Text>
      <Text style={styles.hint}>
        Your flashcards and review history are stored only on this device.
      </Text>
      <AboutLink label="How to use" onPress={() => setHowToUseModal(true)} />
      <AboutLink label="Voice commands" onPress={() => setVoiceIntroModal(true)} />
      <AboutLink label="Study safely" onPress={() => setSafetyModal(true)} />
      <AboutLink label="Privacy Policy" url={getAppUrls().privacyPolicyUrl} />
      <AboutLink label="Support" url={getAppUrls().supportUrl} />

      <SafetyNoticeModal
        visible={safetyModal}
        dismissOnly
        onAcknowledge={() => setSafetyModal(false)}
        onDismiss={() => setSafetyModal(false)}
      />

      <VoiceIntroModal
        visible={voiceIntroModal}
        dismissOnly
        onAcknowledge={() => setVoiceIntroModal(false)}
        onDismiss={() => setVoiceIntroModal(false)}
      />

      <HowToUseModal visible={howToUseModal} onClose={() => setHowToUseModal(false)} />

      <VoicePicker
        visible={voicePicker === 'front'}
        selectedLocale={settings.defaultFrontLocale}
        onSelect={(locale) => updateSettings({ defaultFrontLocale: locale })}
        onClose={() => setVoicePicker(null)}
        title="Front Language"
      />
      <VoicePicker
        visible={voicePicker === 'back'}
        selectedLocale={settings.defaultBackLocale}
        onSelect={(locale) => updateSettings({ defaultBackLocale: locale })}
        onClose={() => setVoicePicker(null)}
        title="Back Language"
      />
    </ScrollView>
  );
}

function AboutLink({
  label,
  url,
  onPress,
}: {
  label: string;
  url?: string;
  onPress?: () => void;
}) {
  const handlePress = () => {
    if (onPress) {
      onPress();
      return;
    }
    if (url) {
      Linking.openURL(url).catch(() => {
        Alert.alert('Could not open link', url);
      });
    }
  };

  return (
    <TouchableOpacity style={styles.aboutLink} onPress={handlePress}>
      <Text style={styles.aboutLinkText}>{label}</Text>
    </TouchableOpacity>
  );
}

function SettingToggle({
  label,
  subtitle,
  value,
  onChange,
  testID,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  testID?: string;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: Colors.border, true: Colors.primary }}
        thumbColor={Colors.text}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background, padding: Spacing.md },
  section: {
    color: Colors.text,
    fontSize: FontSize.lg,
    fontWeight: '700',
    marginTop: Spacing.lg,
    marginBottom: Spacing.md,
  },
  row: { marginBottom: Spacing.md },
  label: { color: Colors.text, fontSize: FontSize.md },
  hint: { color: Colors.textMuted, fontSize: FontSize.sm, marginTop: 4 },
  rateRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm, marginTop: Spacing.sm },
  rateBtn: { paddingVertical: Spacing.sm, paddingHorizontal: Spacing.md, minHeight: 36 },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  previewBtn: { marginTop: Spacing.md },
  permRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  permStatus: { fontSize: FontSize.sm, fontWeight: '600' },
  aboutLink: {
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  aboutLinkText: { color: Colors.primary, fontSize: FontSize.md },
});
