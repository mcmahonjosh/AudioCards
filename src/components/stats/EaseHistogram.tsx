import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StatsColors } from '@/src/stats/statsColors';
import type { EaseHistogramData } from '@/src/stats/StatsAggregator';
import {
  CHART_AXIS,
  formatCountAxisLabel,
  histogramAxisLabels,
  niceMaxValue,
} from './chartAxis';
import { StatsChartFrame } from './StatsChartFrame';

interface EaseHistogramProps {
  data: EaseHistogramData;
  width: number;
}

export function EaseHistogram({ data, width }: EaseHistogramProps) {
  if (data.bins.length === 0) return null;

  const maxCount = niceMaxValue(Math.max(...data.bins.map((b) => b.count), 0));
  const tickLabels = histogramAxisLabels(data.bins.map((b) => b.label));
  const chartWidth = width - CHART_AXIS.yAxisLabelWidth - 24;

  const chartData = data.bins.map((b, i) => ({
    value: b.count,
    label: tickLabels[i],
    frontColor: StatsColors.learning,
  }));

  return (
    <StatsChartFrame yAxisLabel="Cards" xAxisLabel="Ease (%)">
      <View style={styles.container}>
        <BarChart
          width={chartWidth}
          height={180}
          data={chartData}
          barWidth={Math.max(8, Math.min(20, chartWidth / data.bins.length - 4))}
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
