import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StatsColors } from '@/src/stats/statsColors';
import type { HourlyPoint } from '@/src/stats/StatsAggregator';
import {
  CHART_AXIS,
  formatCountAxisLabel,
  hourlyAxisLabels,
  niceMaxValue,
  chartSeriesKey,
} from './chartAxis';
import { StatsChartFrame } from './StatsChartFrame';

interface HourlyChartProps {
  data: HourlyPoint[];
  width: number;
}

export function HourlyChart({ data, width }: HourlyChartProps) {
  const maxVolume = niceMaxValue(Math.max(...data.map((p) => p.volume), 0));
  const labels = hourlyAxisLabels(data.map((p) => p.hour));
  const chartWidth = width - CHART_AXIS.yAxisLabelWidth - 24;

  const barData = data.map((p, i) => ({
    value: p.volume,
    label: labels[i],
    frontColor: StatsColors.volumeBar,
  }));

  return (
    <StatsChartFrame
      yAxisLabel="Reviews"
      xAxisLabel="Hour of day"
      legend={[{ color: StatsColors.volumeBar, label: 'Volume' }]}
    >
      <View style={styles.container}>
        <BarChart
          key={chartSeriesKey(data.map((p) => p.volume))}
          width={chartWidth}
          height={180}
          data={barData}
          barWidth={Math.max(6, chartWidth / 24 - 4)}
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
          maxValue={maxVolume}
          isAnimated
        />
      </View>
    </StatsChartFrame>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', overflow: 'hidden' },
});
