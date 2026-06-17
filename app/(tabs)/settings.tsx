import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { useAppContext } from '@/src/context/AppContext';
import { LocaleButton, LocalePicker } from '@/src/components/LocalePicker';
import { Button } from '@/src/components/Button';
import { ttsService } from '@/src/services/tts/TtsService';
import { voiceCommandService } from '@/src/services/voice/VoiceCommandService';

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppContext();
  const [localePicker, setLocalePicker] = useState<'front' | 'back' | null>(null);
  const [permissions, setPermissions] = useState({ microphone: false, speechRecognition: false });
  const [voiceCount, setVoiceCount] = useState(0);

  useEffect(() => {
    ttsService.initialize().then(() => {
      setVoiceCount(ttsService.getVoices().length);
    });
    voiceCommandService.getPermissionStatus().then(setPermissions);
  }, []);

  const requestPermissions = async () => {
    const granted = await voiceCommandService.requestPermissions();
    const status = await voiceCommandService.getPermissionStatus();
    setPermissions(status);
    if (!granted) {
      Alert.alert('Permissions Required', 'Microphone and speech recognition are needed for hands-free mode.');
    }
  };

  const previewVoice = async () => {
    await ttsService.speak(
      'Hello! This is a preview of the text to speech voice.',
      settings.defaultFrontLocale,
      { rate: settings.speechRate },
    );
  };

  return (
    <ScrollView style={styles.container}>
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
        subtitle="Listen for voice commands during review"
        value={settings.handsFreeMode}
        onChange={(v) => updateSettings({ handsFreeMode: v })}
      />

      <Button title="Preview Voice" onPress={previewVoice} variant="secondary" style={styles.previewBtn} />
      <Text style={styles.hint}>{voiceCount} TTS voices available on device</Text>

      <Text style={styles.section}>Default Languages</Text>
      <LocaleButton
        locale={settings.defaultFrontLocale}
        label="Default Front Language"
        onPress={() => setLocalePicker('front')}
      />
      <LocaleButton
        locale={settings.defaultBackLocale}
        label="Default Back Language"
        onPress={() => setLocalePicker('back')}
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

      <LocalePicker
        visible={localePicker === 'front'}
        selected={settings.defaultFrontLocale}
        onSelect={(locale) => updateSettings({ defaultFrontLocale: locale })}
        onClose={() => setLocalePicker(null)}
        title="Default Front Language"
      />
      <LocalePicker
        visible={localePicker === 'back'}
        selected={settings.defaultBackLocale}
        onSelect={(locale) => updateSettings({ defaultBackLocale: locale })}
        onClose={() => setLocalePicker(null)}
        title="Default Back Language"
      />
    </ScrollView>
  );
}

function SettingToggle({
  label,
  subtitle,
  value,
  onChange,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1 }}>
        <Text style={styles.label}>{label}</Text>
        {subtitle ? <Text style={styles.hint}>{subtitle}</Text> : null}
      </View>
      <Switch
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
});
