import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { VoiceActivity } from '@/src/review/types';

interface Props {
  activity: VoiceActivity;
  handsFreeMode: boolean;
}

export function VoiceStatusBar({ activity, handsFreeMode }: Props) {
  if (!handsFreeMode) return null;

  const labels: Record<VoiceActivity, { text: string; color: string }> = {
    idle: { text: 'Voice idle', color: Colors.textMuted },
    speaking: { text: 'Speaking...', color: Colors.accent },
    listening: { text: 'Listening for commands...', color: Colors.primary },
  };

  const { text, color } = labels[activity];

  return (
    <View style={styles.container}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.text, { color }]}>{text}</Text>
      <Text style={styles.hint}>
        Say: flip, repeat, again, hard, good, easy, pause, end session
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    gap: 4,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  text: {
    fontSize: FontSize.sm,
    fontWeight: '600',
  },
  hint: {
    fontSize: 11,
    color: Colors.textMuted,
    textAlign: 'center',
  },
});
