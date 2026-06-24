import React, { useRef } from 'react';
import { View, Text, StyleSheet, PanResponder, LayoutChangeEvent } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import {
  SPEECH_VOLUME_SLIDER_MIN,
  SPEECH_VOLUME_SLIDER_MAX,
  SPEECH_VOLUME_SLIDER_DEFAULT,
} from '@/src/services/tts/volumeUtils';
import { clamp } from '@/src/scheduler/time';

interface Props {
  value: number;
  onChange: (value: number) => void;
  onChangeComplete?: (value: number) => void;
}

function valueFromX(x: number, width: number): number {
  const ratio = clamp(x / width, 0, 1);
  return Math.round(ratio * SPEECH_VOLUME_SLIDER_MAX);
}

export function VolumeSlider({ value, onChange, onChangeComplete }: Props) {
  const trackWidth = useRef(0);
  const display = Math.round(value);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        onChange(valueFromX(evt.nativeEvent.locationX, trackWidth.current));
      },
      onPanResponderMove: (evt) => {
        onChange(valueFromX(evt.nativeEvent.locationX, trackWidth.current));
      },
      onPanResponderRelease: (evt) => {
        onChangeComplete?.(valueFromX(evt.nativeEvent.locationX, trackWidth.current));
      },
    }),
  ).current;

  const ratio = value / SPEECH_VOLUME_SLIDER_MAX;

  const onLayout = (e: LayoutChangeEvent) => {
    trackWidth.current = e.nativeEvent.layout.width;
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.label}>Speech Volume</Text>
        <Text style={styles.value}>{display}</Text>
      </View>
      <View
        style={styles.track}
        onLayout={onLayout}
        {...panResponder.panHandlers}
      >
        <View style={[styles.fill, { width: `${ratio * 100}%` }]} />
        <View style={[styles.thumb, { left: `${ratio * 100}%` }]} />
      </View>
      <View style={styles.ticks}>
        <Text style={styles.tick}>{SPEECH_VOLUME_SLIDER_MIN}</Text>
        <Text style={styles.tick}>Default {SPEECH_VOLUME_SLIDER_DEFAULT}</Text>
        <Text style={styles.tick}>{SPEECH_VOLUME_SLIDER_MAX}</Text>
      </View>
    </View>
  );
}

const THUMB = 22;

const styles = StyleSheet.create({
  container: { marginBottom: Spacing.md },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  label: { color: Colors.text, fontSize: FontSize.md },
  value: { color: Colors.primary, fontSize: FontSize.md, fontWeight: '700' },
  track: {
    height: 36,
    justifyContent: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: 18,
    overflow: 'visible',
  },
  fill: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    backgroundColor: Colors.primary,
    borderRadius: 18,
    opacity: 0.35,
  },
  thumb: {
    position: 'absolute',
    width: THUMB,
    height: THUMB,
    marginLeft: -THUMB / 2,
    borderRadius: THUMB / 2,
    backgroundColor: Colors.primary,
    top: (36 - THUMB) / 2,
    borderWidth: 2,
    borderColor: Colors.text,
  },
  ticks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: Spacing.sm,
  },
  tick: { color: Colors.textMuted, fontSize: 11 },
});
