import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import { ContentFormat, CardMedia, CardPhase } from '@/src/models/types';
import { CardContentRenderer } from '@/src/components/card/CardContentRenderer';

interface Props {
  text: string;
  contentFormat?: ContentFormat;
  media?: CardMedia[];
  side: 'front' | 'back';
  locale: string;
  isFlipped: boolean;
  phase?: CardPhase;
  onPlaySound?: (filename: string) => void;
}

export function CardDisplay({
  text,
  contentFormat = 'plain',
  media = [],
  side,
  locale,
  isFlipped,
  phase,
  onPlaySound,
}: Props) {
  const showingBack = isFlipped;
  const label = showingBack ? 'Back' : 'Front';

  return (
    <View style={[styles.card, showingBack && styles.cardBack]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.sideLabel}>{label}</Text>
          {phase ? <CardPhaseBadge phase={phase} /> : null}
        </View>
        <Text style={styles.locale}>{locale}</Text>
      </View>
      <CardContentRenderer
        text={text}
        contentFormat={contentFormat}
        media={media}
        onPlaySound={onPlaySound}
        maxHeight={400}
      />
    </View>
  );
}

function CardPhaseBadge({ phase }: { phase: CardPhase }) {
  const color = phaseColor(phase);
  return (
    <View style={[styles.phaseBadge, { backgroundColor: `${color}22`, borderColor: color }]}>
      <Text style={[styles.phaseBadgeText, { color }]}>{phaseLabel(phase)}</Text>
    </View>
  );
}

function phaseLabel(phase: CardPhase): string {
  switch (phase) {
    case 'new':
      return 'New';
    case 'learning':
      return 'Learning';
    case 'relearning':
      return 'Relearning';
    case 'review':
      return 'Review';
  }
}

function phaseColor(phase: CardPhase): string {
  switch (phase) {
    case 'new':
      return Colors.primary;
    case 'review':
      return Colors.accent;
    case 'learning':
    case 'relearning':
      return Colors.hard;
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    minHeight: 200,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  cardBack: {
    borderColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    flexShrink: 1,
  },
  phaseBadge: {
    borderRadius: 6,
    borderWidth: 1,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
  },
  phaseBadgeText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sideLabel: {
    color: Colors.primary,
    fontSize: FontSize.sm,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  locale: {
    color: Colors.textMuted,
    fontSize: FontSize.sm,
  },
});
