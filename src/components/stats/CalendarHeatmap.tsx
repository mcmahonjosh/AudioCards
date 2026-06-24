import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Colors, Spacing, FontSize } from '@/constants/Colors';
import type { CalendarHeatmapData } from '@/src/stats/StatsAggregator';

interface CalendarHeatmapProps {
  data: CalendarHeatmapData;
  onYearChange: (year: number) => void;
}

const DOW_LABELS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const CELL = 12;
const CELL_GAP = 2;
const ROW_HEIGHT = CELL + CELL_GAP;
const GRID_HEIGHT = DOW_LABELS.length * ROW_HEIGHT;

function heatColor(count: number, max: number): string {
  if (count === 0) return Colors.background;
  const intensity = max > 0 ? count / max : 0;
  if (intensity < 0.25) return '#1a4d2e';
  if (intensity < 0.5) return '#2d6a4f';
  if (intensity < 0.75) return '#40916c';
  return '#52b788';
}

export function CalendarHeatmap({ data, onYearChange }: CalendarHeatmapProps) {
  const weekColWidth = CELL + CELL_GAP;
  const gridWidth = data.weeks.length * weekColWidth;

  return (
    <View>
      <View style={styles.yearRow}>
        <Text style={styles.yearText}>{data.year}</Text>
        <TouchableOpacity onPress={() => onYearChange(data.year - 1)} style={styles.navBtn}>
          <Text style={styles.navText}>◀</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => onYearChange(data.year + 1)} style={styles.navBtn}>
          <Text style={styles.navText}>▶</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.borderBox}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <View style={[styles.grid, { minHeight: GRID_HEIGHT }]}>
            <View style={[styles.dowCol, { height: GRID_HEIGHT }]}>
              {DOW_LABELS.map((d, i) => (
                <Text key={`${d}-${i}`} style={styles.dowLabel}>
                  {d}
                </Text>
              ))}
            </View>
            <View style={[styles.weeksRow, { width: Math.max(gridWidth, 1), height: GRID_HEIGHT }]}>
              {data.weeks.map((week) => (
                <View key={week.weekIndex} style={styles.weekCol}>
                  {week.cells.map((cell, dow) => (
                    <View
                      key={`${week.weekIndex}-${dow}`}
                      style={[
                        styles.cell,
                        cell
                          ? {
                              backgroundColor: heatColor(cell.count, data.maxCount),
                              borderColor: Colors.border,
                            }
                          : styles.cellPadding,
                      ]}
                    />
                  ))}
                </View>
              ))}
            </View>
          </View>
        </ScrollView>
      </View>
      <Text style={styles.caption}>Reviews per day (darker green = more)</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  yearRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  yearText: { color: Colors.text, fontSize: FontSize.md, fontWeight: '600' },
  navBtn: { padding: Spacing.xs },
  navText: { color: Colors.primary, fontSize: FontSize.md },
  borderBox: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 8,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    padding: Spacing.sm,
  },
  scrollContent: { flexGrow: 1 },
  grid: { flexDirection: 'row', alignItems: 'flex-start' },
  dowCol: { width: 16, marginRight: 4, justifyContent: 'flex-start' },
  dowLabel: {
    color: Colors.textMuted,
    fontSize: 9,
    height: ROW_HEIGHT,
    lineHeight: ROW_HEIGHT,
    textAlign: 'center',
  },
  weeksRow: { flexDirection: 'row' },
  weekCol: { width: CELL + CELL_GAP, marginRight: 0 },
  cell: {
    width: CELL,
    height: CELL,
    borderRadius: 2,
    marginBottom: CELL_GAP,
    borderWidth: 1,
  },
  cellPadding: {
    width: CELL,
    height: CELL,
    marginBottom: CELL_GAP,
    backgroundColor: Colors.surfaceLight,
    borderRadius: 2,
    borderWidth: 1,
    borderColor: Colors.border,
    opacity: 0.35,
  },
  caption: {
    color: Colors.textMuted,
    fontSize: 10,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
