import React from 'react';
import { View, StyleSheet } from 'react-native';
import { Button } from './Button';
import { Rating, IntervalPreview } from '@/src/models/types';
import { Spacing } from '@/constants/Colors';

interface Props {
  onRate: (rating: Rating) => void;
  previews?: Partial<Record<Rating, IntervalPreview>> | null;
  visible: boolean;
}

const RATINGS: { rating: Rating; variant: 'again' | 'hard' | 'good' | 'easy'; label: string }[] = [
  { rating: 'again', variant: 'again', label: 'Again' },
  { rating: 'hard', variant: 'hard', label: 'Hard' },
  { rating: 'good', variant: 'good', label: 'Good' },
  { rating: 'easy', variant: 'easy', label: 'Easy' },
];

export function RatingButtons({ onRate, previews, visible }: Props) {
  if (!visible) return null;

  return (
    <View style={styles.container}>
      {RATINGS.map(({ rating, variant, label }) => (
        <Button
          key={rating}
          title={label}
          subtitle={previews?.[rating]?.label}
          variant={variant}
          onPress={() => onRate(rating)}
          style={styles.button}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    justifyContent: 'center',
  },
  button: {
    flex: 1,
    minWidth: '45%',
  },
});
