import React from 'react';
import { View, StyleSheet } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { StatsColors } from '@/src/stats/statsColors';
import type { AddedChartData } from '@/src/stats/StatsAggregator';
import {
  CHART_AXIS,
  dayOffsetAxisLabels,
  formatCountAxisLabel,
  niceMaxValue,
  PAST_DAY_BAR_SPACING,
  PAST_DAY_BAR_WIDTH,
} from './chartAxis';
import { StatsChartFrame } from './StatsChartFrame';
import { useScrollToRecentDay } from './statsScrollChart';

interface AddedChartProps {
  data: AddedChartData;
  width: number;
}

export function AddedChart({ data, width }: AddedChartProps) {
  const viewportWidth = width - CHART_AXIS.yAxisLabelWidth - 24;
  const { scrollRef, scrollToRecent } = useScrollToRecentDay(data.points.length, viewportWidth);

  if (data.points.length === 0) return null;

  const maxCount = niceMaxValue(Math.max(...data.points.map((p) => p.count), 0));
  const maxCumulative = niceMaxValue(Math.max(...data.points.map((p) => p.cumulative), 0));
  const labels = dayOffsetAxisLabels(data.points);

  const barData = data.points.map((p, i) => ({
    value: p.count,
    label: labels[i],
    frontColor: StatsColors.added,
  }));

  const lineData = data.points.map((p) => ({
    value: p.cumulative,
  }));

  return (
    <StatsChartFrame
      yAxisLabel="New / day"
      secondaryYAxisLabel="Total studied"
      xAxisLabel="Days ago (0 = today · swipe right for older)"
      legend={[
        { color: StatsColors.added, label: 'New cards studied' },
        { color: StatsColors.cumulative, label: 'Cumulative' },
      ]}
    >
      <View style={styles.container}>
        <BarChart
          width={viewportWidth}
          height={180}
          data={barData}
          lineData={lineData}
          showLine
          lineConfig={{
            color: StatsColors.cumulative,
            thickness: 2,
            curved: false,
            hideDataPoints: false,
            dataPointsColor: StatsColors.cumulative,
            dataPointsRadius: 2,
            isSecondary: true,
          }}
          secondaryYAxis={{
            noOfSections: 4,
            maxValue: maxCumulative,
            roundToDigits: 0,
            yAxisColor: StatsColors.cumulative,
            yAxisTextStyle: { color: StatsColors.cumulative, fontSize: 9 },
          }}
          barWidth={PAST_DAY_BAR_WIDTH}
          spacing={PAST_DAY_BAR_SPACING}
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
