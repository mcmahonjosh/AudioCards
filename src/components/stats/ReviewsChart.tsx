import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StatsColors } from '@/src/stats/statsColors';
import type { ReviewsChartData } from '@/src/stats/StatsAggregator';
import {
  CHART_AXIS,
  dayOffsetAxisLabels,
  formatCountAxisLabel,
  niceMaxValue,
  PAST_DAY_BAR_SPACING,
  PAST_DAY_BAR_WIDTH,
  chartSeriesKey,
} from './chartAxis';
import { StatsChartFrame } from './StatsChartFrame';
import { useScrollToRecentDay } from './statsScrollChart';

interface ReviewsChartProps {
  data: ReviewsChartData;
  width: number;
  timeMode?: boolean;
}

export function ReviewsChart({ data, width, timeMode = false }: ReviewsChartProps) {
  const viewportWidth = width - CHART_AXIS.yAxisLabelWidth - 24;
  const { scrollRef, scrollToRecent } = useScrollToRecentDay(data.points.length, viewportWidth);

  if (data.points.length === 0) return null;

  const maxTotal = niceMaxValue(Math.max(...data.points.map((p) => p.total), 0));
  const labels = dayOffsetAxisLabels(data.points);

  const stackData = data.points.map((p, i) => ({
    stacks: [
      { value: p.learning, color: StatsColors.learning },
      { value: p.young, color: StatsColors.young },
      { value: p.mature, color: StatsColors.mature },
      { value: p.relearn, color: StatsColors.relearning },
    ],
    label: labels[i],
  }));

  const yUnit = timeMode ? 'sec / day' : 'Reviews / day';
  const seriesKey = chartSeriesKey(
    data.points.flatMap((p) => [p.total, p.learning, p.young, p.mature, p.relearn]),
  );

  return (
    <StatsChartFrame
      yAxisLabel={yUnit}
      xAxisLabel="Days ago (0 = today · swipe right for older)"
      legend={[
        { color: StatsColors.learning, label: 'Learning' },
        { color: StatsColors.young, label: 'Young' },
        { color: StatsColors.mature, label: 'Mature' },
        { color: StatsColors.relearning, label: 'Relearn' },
      ]}
    >
      <View style={styles.container}>
        <BarChart
          key={seriesKey}
          width={viewportWidth}
          height={180}
          stackData={stackData}
          barWidth={PAST_DAY_BAR_WIDTH}
          spacing={PAST_DAY_BAR_SPACING}
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
          maxValue={maxTotal}
          scrollRef={scrollRef}
          scrollToEnd={false}
          showScrollIndicator
          nestedScrollEnabled
          remainingScrollViewProps={{ onContentSizeChange: scrollToRecent }}
          isAnimated
        />
      </View>
    </StatsChartFrame>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'flex-start', overflow: 'hidden' },
});
