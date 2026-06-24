import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { Colors, Spacing } from '@/constants/Colors';
import { Rating, IntervalPreview } from '@/src/models/types';

interface Props {
  onRate: (rating: Rating) => void;
  previews?: Partial<Record<Rating, IntervalPreview>> | null;
  visible: boolean;
  loading?: boolean;
}

const RATINGS: {
  rating: Rating;
  variant: 'again' | 'hard' | 'good' | 'easy';
  label: string;
}[] = [
  { rating: 'again', variant: 'again', label: 'Again' },
  { rating: 'hard', variant: 'hard', label: 'Hard' },
  { rating: 'good', variant: 'good', label: 'Good' },
  { rating: 'easy', variant: 'easy', label: 'Easy' },
];

const variantColors: Record<string, { bg: string; text: string }> = {
  again: { bg: Colors.again, text: Colors.text },
  hard: { bg: Colors.hard, text: '#1a1a2e' },
  good: { bg: Colors.good, text: '#1a1a2e' },
  easy: { bg: Colors.easy, text: Colors.text },
};

export function RatingButtons({ onRate, previews, visible, loading }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {RATINGS.map(({ rating, variant, label }) => {
        const colors = variantColors[variant];
        const interval = previews?.[rating]?.label ?? '—';

        return (
          <TouchableOpacity
            key={rating}
            style={[styles.button, { backgroundColor: colors.bg }]}
            onPress={() => onRate(rating)}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator color={colors.text} size="small" />
            ) : (
              <>
                <Text style={[styles.interval, { color: colors.text }]} numberOfLines={1}>
                  {interval}
                </Text>
                <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>
                  {label}
                </Text>
              </>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
    marginBottom: Spacing.sm,
  },
  button: {
    flex: 1,
    paddingVertical: 6,
    paddingHorizontal: 2,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  interval: {
    fontSize: 11,
    fontWeight: '700',
    lineHeight: 13,
  },
  label: {
    fontSize: 10,
    fontWeight: '600',
    lineHeight: 12,
    marginTop: 2,
    opacity: 0.92,
  },
});
