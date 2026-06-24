import { useCallback, useEffect, useRef } from 'react';
import type { ScrollView } from 'react-native';
import { CHART_AXIS, PAST_DAY_BAR_SPACING, PAST_DAY_BAR_WIDTH } from './chartAxis';

export function pastDayChartContentWidth(pointCount: number): number {
  if (pointCount <= 0) return 0;
  return (
    CHART_AXIS.initialSpacing +
    CHART_AXIS.endSpacing +
    pointCount * PAST_DAY_BAR_WIDTH +
    (pointCount - 1) * PAST_DAY_BAR_SPACING
  );
}

/** Scroll offset so the last bar (today) sits fully inside the viewport. */
export function pastDayScrollX(pointCount: number, viewportWidth: number): number {
  const contentWidth = pastDayChartContentWidth(pointCount);
  const trailingPad = PAST_DAY_BAR_WIDTH + PAST_DAY_BAR_SPACING + 20;
  return Math.max(0, contentWidth - viewportWidth + trailingPad);
}

export function useScrollToRecentDay(pointCount: number, viewportWidth: number) {
  const scrollRef = useRef<ScrollView>(null);

  const scrollToRecent = useCallback(() => {
    if (pointCount <= 0 || viewportWidth <= 0) return;
    const x = pastDayScrollX(pointCount, viewportWidth);
    scrollRef.current?.scrollTo({ x, animated: false });
  }, [pointCount, viewportWidth]);

  useEffect(() => {
    scrollToRecent();
    const t = setTimeout(scrollToRecent, 50);
    const t2 = setTimeout(scrollToRecent, 200);
    return () => {
      clearTimeout(t);
      clearTimeout(t2);
    };
  }, [scrollToRecent]);

  return { scrollRef, scrollToRecent };
}
