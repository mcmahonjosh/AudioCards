import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StatsColors } from '@/src/stats/statsColors';
import type { IntervalHistogramData } from '@/src/stats/StatsAggregator';
import {
  CHART_AXIS,
  formatCountAxisLabel,
  histogramAxisLabels,
  niceMaxValue,
} from './chartAxis';
import { StatsChartFrame } from './StatsChartFrame';

interface IntervalHistogramProps {
  data: IntervalHistogramData;
  width: number;
}

export function IntervalHistogram({ data, width }: IntervalHistogramProps) {
  if (data.bins.length === 0) return null;

  const maxCount = niceMaxValue(Math.max(...data.bins.map((b) => b.count), 0));
  const tickLabels = histogramAxisLabels(data.bins.map((b) => b.label));
  const chartWidth = width - CHART_AXIS.yAxisLabelWidth - 24;

  const barData = data.bins.map((b, i) => ({
    value: b.count,
    label: tickLabels[i],
    frontColor: StatsColors.mature,
  }));

  return (
    <StatsChartFrame
      yAxisLabel="Cards"
      xAxisLabel="Interval (days)"
    >
      <View style={styles.container}>
        <BarChart
          width={chartWidth}
          height={180}
          data={barData}
          barWidth={Math.max(6, Math.min(16, chartWidth / data.bins.length - 4))}
          spacing={4}
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
          maxValue={maxCount}
          isAnimated
        />
      </View>
    </StatsChartFrame>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', overflow: 'hidden' },
});
