import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StatsColors } from '@/src/stats/statsColors';
import type { FutureDueChartData } from '@/src/stats/StatsAggregator';
import {
  CHART_AXIS,
  formatCountAxisLabel,
  futureDueAxisLabels,
  niceMaxValue,
  chartSeriesKey,
} from './chartAxis';
import { StatsChartFrame } from './StatsChartFrame';

interface FutureDueChartProps {
  data: FutureDueChartData;
  width: number;
}

export function FutureDueChart({ data, width }: FutureDueChartProps) {
  if (data.points.length === 0) return null;

  const maxDue = niceMaxValue(Math.max(...data.points.map((p) => p.due), 0));
  const labels = futureDueAxisLabels(data.points);

  const barData = data.points.map((p, i) => ({
    value: p.due,
    label: labels[i],
    frontColor: StatsColors.dueBar,
  }));

  const chartWidth = width - CHART_AXIS.yAxisLabelWidth - 24;

  return (
    <StatsChartFrame
      yAxisLabel="Due / day"
      xAxisLabel="Days from today"
      legend={[{ color: StatsColors.dueBar, label: 'Due' }]}
    >
      <View style={styles.container}>
        <BarChart
          key={chartSeriesKey(data.points.map((p) => p.due))}
          width={chartWidth}
          height={180}
          data={barData}
          barWidth={Math.max(4, Math.min(12, chartWidth / data.points.length - 2))}
          spacing={2}
          roundedTop
          hideRules={false}
          rulesType={CHART_AXIS.rulesType}
          rulesColor={CHART_AXIS.rulesColor}
          xAxisColor={CHART_AXIS.xAxisColor}
          yAxisColor={CHART_AXIS.yAxisColor}
          xAxisThickness={CHART_AXIS.xAxisThickness}
          yAxisThickness={CHART_AXIS.yAxisThickness}
          yAxisTextStyle={CHART_AXIS.yAxisTextStyle}
          xAxisLabelTextStyle={CHART_AXIS.xAxisLabelTextStyle}
          yAxisLabelWidth={CHART_AXIS.yAxisLabelWidth}
          formatYLabel={formatCountAxisLabel}
          initialSpacing={CHART_AXIS.initialSpacing}
          endSpacing={CHART_AXIS.endSpacing}
          labelsExtraHeight={CHART_AXIS.labelsExtraHeight}
          noOfSections={4}
          maxValue={maxDue}
          isAnimated
        />
      </View>
    </StatsChartFrame>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', overflow: 'hidden' },
});
