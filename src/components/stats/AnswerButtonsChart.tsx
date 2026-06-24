import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing } from '@/constants/Colors';
import type { AnswerButtonGroupData } from '@/src/stats/StatsAggregator';
import { niceMaxValue } from './chartAxis';
import { StatsChartFrame } from './StatsChartFrame';

interface AnswerButtonsChartProps {
  data: AnswerButtonGroupData[];
  width: number;
}

const RATING_COLORS = {
  again: Colors.again,
  hard: Colors.hard,
  good: Colors.good,
  easy: Colors.easy,
};

const RATING_KEYS = ['again', 'hard', 'good', 'easy'] as const;

export function AnswerButtonsChart({ data, width }: AnswerButtonsChartProps) {
  const maxTotal = niceMaxValue(
    Math.max(...data.map((g) => g.again + g.hard + g.good + g.easy), 0),
  );

  const chartHeight = 120;
  const yAxisWidth = 36;
  const plotWidth = width - yAxisWidth - 24;
  const groupWidth = plotWidth / data.length;
  const barWidth = Math.min(14, (groupWidth - 16) / 4);

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(maxTotal * f));

  return (
    <StatsChartFrame yAxisLabel="Presses" xAxisLabel="Card maturity">
      <View style={styles.row}>
        <View style={[styles.yAxis, { height: chartHeight }]}>
          {[...yTicks].reverse().map((tick) => (
            <Text key={tick} style={styles.yTick}>
              {tick}
            </Text>
          ))}
        </View>
        <View style={[styles.chart, { height: chartHeight, width: plotWidth }]}>
          {data.map((group) => (
            <View key={group.group} style={[styles.group, { width: groupWidth }]}>
              <View style={styles.barsRow}>
                {RATING_KEYS.map((key) => {
                  const value = group[key];
                  const height = maxTotal > 0 ? (value / maxTotal) * chartHeight : 0;
                  return (
                    <View key={key} style={styles.barCol}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: Math.max(height, value > 0 ? 2 : 0),
                            width: barWidth,
                            backgroundColor: RATING_COLORS[key],
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
              <Text style={styles.groupLabel} numberOfLines={2}>
                {group.label}{'\n'}({group.passPercent}%)
              </Text>
            </View>
          ))}
        </View>
      </View>
      <View style={styles.legend}>
        {(['Again', 'Hard', 'Good', 'Easy'] as const).map((label) => {
          const key = label.toLowerCase() as keyof typeof RATING_COLORS;
          return (
            <View key={label} style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: RATING_COLORS[key] }]} />
              <Text style={styles.legendText}>{label}</Text>
            </View>
          );
        })}
      </View>
    </StatsChartFrame>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start' },
  yAxis: {
    width: 36,
    justifyContent: 'space-between',
    paddingRight: 4,
  },
  yTick: { color: Colors.textMuted, fontSize: 9, textAlign: 'right' },
  chart: {
    flexDirection: 'row',
    alignItems: 'flex-end',
  },
  group: { alignItems: 'center' },
  barsRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: '100%',
  },
  barCol: { flex: 1, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { borderRadius: 2 },
  groupLabel: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
    minHeight: 28,
  },
  legend: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dot: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: Colors.textMuted, fontSize: 11 },
});
