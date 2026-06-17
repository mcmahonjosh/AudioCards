import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BarChart, LineChart } from 'react-native-gifted-charts';
import { Colors, Spacing, FontSize } from '@/constants/Colors';

interface ChartCardProps {
  title: string;
  children: React.ReactNode;
}

export function ChartCard({ title, children }: ChartCardProps) {
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{title}</Text>
      {children}
    </View>
  );
}

interface DailyReviewsChartProps {
  data: { date: string; count: number }[];
}

export function DailyReviewsChart({ data }: DailyReviewsChartProps) {
  const chartData = data.map((d) => ({
    value: d.count,
    label: d.date.slice(5),
    frontColor: Colors.primary,
  }));

  return (
    <BarChart
      data={chartData}
      barWidth={8}
      spacing={4}
      roundedTop
      hideRules
      xAxisColor={Colors.border}
      yAxisColor={Colors.border}
      yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 8, rotation: 45 }}
      noOfSections={4}
      maxValue={Math.max(...data.map((d) => d.count), 5)}
      isAnimated
    />
  );
}

interface RatingStackChartProps {
  data: { date: string; again: number; hard: number; good: number; easy: number }[];
}

export function RatingStackChart({ data }: RatingStackChartProps) {
  const chartData = data.map((d) => ({
    stacks: [
      { value: d.again, color: Colors.again },
      { value: d.hard, color: Colors.hard },
      { value: d.good, color: Colors.good },
      { value: d.easy, color: Colors.easy },
    ],
    label: d.date.slice(5),
  }));

  return (
    <BarChart
      stackData={chartData}
      barWidth={14}
      spacing={8}
      hideRules
      xAxisColor={Colors.border}
      yAxisColor={Colors.border}
      yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 8 }}
      noOfSections={4}
      isAnimated
    />
  );
}

interface DueForecastChartProps {
  data: { date: string; count: number }[];
}

export function DueForecastChart({ data }: DueForecastChartProps) {
  const chartData = data.map((d, i) => ({
    value: d.count,
    label: i === 0 ? 'Today' : d.date.slice(5),
    dataPointColor: Colors.accent,
  }));

  return (
    <LineChart
      data={chartData}
      color={Colors.accent}
      thickness={2}
      hideRules
      xAxisColor={Colors.border}
      yAxisColor={Colors.border}
      yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
      noOfSections={4}
      isAnimated
      areaChart
      startFillColor={Colors.accent}
      startOpacity={0.2}
      endOpacity={0.05}
    />
  );
}

interface ProgressChartProps {
  data: { date: string; mature: number }[];
}

export function ProgressChart({ data }: ProgressChartProps) {
  const chartData = data.filter((_, i) => i % 5 === 0 || i === data.length - 1).map((d) => ({
    value: d.mature,
    label: d.date.slice(5),
    dataPointColor: Colors.good,
  }));

  return (
    <LineChart
      data={chartData}
      color={Colors.good}
      thickness={2}
      hideRules
      xAxisColor={Colors.border}
      yAxisColor={Colors.border}
      yAxisTextStyle={{ color: Colors.textMuted, fontSize: 10 }}
      xAxisLabelTextStyle={{ color: Colors.textMuted, fontSize: 9 }}
      noOfSections={4}
      isAnimated
    />
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  title: {
    color: Colors.text,
    fontSize: FontSize.md,
    fontWeight: '600',
    marginBottom: Spacing.md,
  },
});
