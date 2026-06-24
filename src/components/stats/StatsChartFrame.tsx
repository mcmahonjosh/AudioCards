import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';

interface StatsChartFrameProps {
  yAxisLabel?: string;
  xAxisLabel?: string;
  secondaryYAxisLabel?: string;
  legend?: { color: string; label: string }[];
  children: React.ReactNode;
}

export function StatsChartFrame({
  yAxisLabel,
  xAxisLabel,
  secondaryYAxisLabel,
  legend,
  children,
}: StatsChartFrameProps) {
  return (
    <View style={styles.wrapper}>
      {(yAxisLabel || secondaryYAxisLabel) && (
        <View style={styles.axisTitleRow}>
          {yAxisLabel ? <Text style={styles.yAxisTitle}>{yAxisLabel}</Text> : <View />}
          {secondaryYAxisLabel ? (
            <Text style={styles.yAxisTitleSecondary}>{secondaryYAxisLabel}</Text>
          ) : null}
        </View>
      )}
      {children}
      {xAxisLabel ? <Text style={styles.xAxisTitle}>{xAxisLabel}</Text> : null}
      {legend && legend.length > 0 && (
        <View style={styles.legendRow}>
          {legend.map((item) => (
            <View key={item.label} style={styles.legendItem}>
              <View style={[styles.legendSwatch, { backgroundColor: item.color }]} />
              <Text style={styles.legendText}>{item.label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { marginTop: Spacing.xs },
  axisTitleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
    paddingHorizontal: 4,
  },
  yAxisTitle: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  yAxisTitleSecondary: {
    color: Colors.textMuted,
    fontSize: 10,
    fontWeight: '600',
  },
  xAxisTitle: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: 4,
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: Spacing.md,
    marginTop: Spacing.sm,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  legendSwatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { color: Colors.textMuted, fontSize: 10 },
});
