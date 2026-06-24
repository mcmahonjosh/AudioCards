import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { G, Path } from 'react-native-svg';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import type { CardCountsData } from '@/src/stats/StatsAggregator';

interface CardCountsPieProps {
  data: CardCountsData;
  size?: number;
}

function describeArc(
  cx: number,
  cy: number,
  r: number,
  startAngle: number,
  endAngle: number,
): string {
  const start = polarToCartesian(cx, cy, r, endAngle);
  const end = polarToCartesian(cx, cy, r, startAngle);
  const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y} L ${cx} ${cy} Z`;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

export function CardCountsPie({ data, size = 120 }: CardCountsPieProps) {
  const cx = size / 2;
  const cy = size / 2;
  const r = size / 2 - 4;
  const nonZero = data.categories.filter((c) => c.count > 0);
  let angle = 0;
  const pieDenominator = data.pieTotal || 1;

  return (
    <View style={styles.row}>
      <Svg width={size} height={size}>
        <G>
          {nonZero.length === 0 ? (
            <Path
              d={describeArc(cx, cy, r, 0, 359.99)}
              fill={Colors.surfaceLight}
            />
          ) : (
            nonZero.map((slice) => {
              const sweep = (slice.count / pieDenominator) * 360;
              const path = describeArc(cx, cy, r, angle, angle + sweep);
              angle += sweep;
              return <Path key={slice.label} d={path} fill={slice.color} />;
            })
          )}
        </G>
      </Svg>
      <View style={styles.legend}>
        {data.categories.map((cat) => (
          <View key={cat.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: cat.color }]} />
            <Text style={styles.legendLabel}>{cat.label}</Text>
            <Text style={styles.legendCount}>{cat.count}</Text>
            <Text style={styles.legendPct}>{cat.percent}%</Text>
          </View>
        ))}
        <View style={[styles.legendRow, styles.totalRow]}>
          <Text style={styles.legendLabel}>Studied</Text>
          <Text style={styles.legendCount}>{data.total}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  legend: { flex: 1 },
  legendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 3,
    gap: Spacing.xs,
  },
  swatch: { width: 12, height: 12, borderRadius: 2 },
  legendLabel: { color: Colors.textSecondary, fontSize: FontSize.sm, flex: 1 },
  legendCount: { color: Colors.text, fontSize: FontSize.sm, minWidth: 28, textAlign: 'right' },
  legendPct: { color: Colors.textMuted, fontSize: FontSize.sm, minWidth: 40, textAlign: 'right' },
  totalRow: { borderTopWidth: 1, borderTopColor: Colors.border, marginTop: 4, paddingTop: 6 },
});
