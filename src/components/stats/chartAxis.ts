import { Colors } from '@/constants/Colors';

export const CHART_AXIS = {
  xAxisColor: Colors.border,
  yAxisColor: Colors.textMuted,
  xAxisThickness: 1,
  yAxisThickness: 1,
  rulesColor: 'rgba(107, 107, 128, 0.35)',
  rulesType: 'solid' as const,
  yAxisTextStyle: { color: Colors.textSecondary, fontSize: 10 },
  xAxisLabelTextStyle: { color: Colors.textSecondary, fontSize: 9 },
  yAxisLabelWidth: 42,
  initialSpacing: 8,
  endSpacing: 32,
  labelsExtraHeight: 14,
};

/** Past-to-present charts: custom scroll positions today at the right edge. */
export const PAST_DAY_BAR_WIDTH = 8;
export const PAST_DAY_BAR_SPACING = 3;

export function formatCountAxisLabel(label: string): string {
  const n = Number(label);
  if (Number.isNaN(n)) return label;
  if (n >= 10_000) return `${Math.round(n / 1000)}k`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(Math.round(n));
}

export function formatPercentAxisLabel(label: string): string {
  const n = Number(label);
  if (Number.isNaN(n)) return label;
  return `${Math.round(n)}%`;
}

/** Pick readable x-axis ticks from day-offset series (e.g. reviews: -30 … 0). */
export function dayOffsetAxisLabels(
  points: { dayOffset: number }[],
  maxTicks = 5,
): string[] {
  if (points.length === 0) return [];
  const offsets = points.map((p) => p.dayOffset);
  const min = offsets[0];
  const max = offsets[offsets.length - 1];
  const ticks = new Set<number>([min, max, 0]);

  if (maxTicks > 3) {
    const span = max - min || 1;
    const step = Math.max(1, Math.round(span / (maxTicks - 1)));
    for (let v = min; v <= max; v += step) ticks.add(v);
  }

  return points.map((p, i) =>
    ticks.has(p.dayOffset) || (i === points.length - 1 && p.dayOffset === 0)
      ? String(p.dayOffset)
      : '',
  );
}

/** X-axis ticks for future-due (may include negative backlog days). */
export function futureDueAxisLabels(
  points: { dayOffset: number }[],
  maxTicks = 6,
): string[] {
  return dayOffsetAxisLabels(points, maxTicks);
}

/** Hourly chart: show every 6 hours plus last hour. */
export function hourlyAxisLabels(hours: number[]): string[] {
  const ticks = new Set([0, 6, 12, 18, 23]);
  return hours.map((h) => (ticks.has(h) ? String(h) : ''));
}

/** Histogram bins: label first, middle, last buckets. */
export function histogramAxisLabels(labels: string[], maxTicks = 5): string[] {
  if (labels.length <= maxTicks) return labels;
  const step = Math.max(1, Math.floor(labels.length / (maxTicks - 1)));
  return labels.map((label, i) =>
    i === 0 || i === labels.length - 1 || i % step === 0 ? label : '',
  );
}

export function niceMaxValue(max: number, sections = 4): number {
  if (max <= 0) return sections;
  const raw = max * 1.05;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  let nice: number;
  if (normalized <= 1) nice = 1;
  else if (normalized <= 2) nice = 2;
  else if (normalized <= 5) nice = 5;
  else nice = 10;
  return Math.ceil(nice * magnitude);
}
