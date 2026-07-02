// =====================================================================
//  MonthGrid — a Monday-first month calendar grid.
//  Used in two places: the Calendar tab, and the deadline picker
//  when adding a to-do. Building it once and reusing it is the whole
//  point of components.
//
//  Props:
//    year, month   — which month to show (month is 0-based, like JS Dates)
//    selected      — the currently selected date key ("2026-07-02") or null
//    onSelect(key) — called when the user taps a day
//    marked        — a Set of date keys that get a dot (e.g. deadlines)
// =====================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import { monthCells, todayKey } from '../utils/dates';

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

export default function MonthGrid({ year, month, selected, onSelect, marked }) {
  const cells = monthCells(year, month);
  const today = todayKey();

  return (
    <View>
      {/* Weekday header row */}
      <View style={styles.week}>
        {WEEKDAYS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      {/* Day cells, 7 per row (flexWrap does the wrapping for us) */}
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={i} style={styles.cell} />;
          const isToday = cell.key === today;
          const isSelected = cell.key === selected;
          const hasDot = marked && marked.has(cell.key);
          return (
            <TouchableOpacity
              key={i}
              style={styles.cell}
              onPress={() => onSelect && onSelect(cell.key)}
            >
              <View style={[
                styles.dayCircle,
                isToday && styles.dayToday,
                isSelected && styles.daySelected,
              ]}>
                <Text style={[
                  styles.dayText,
                  isToday && styles.dayTextToday,
                  isSelected && styles.dayTextSelected,
                ]}>
                  {cell.day}
                </Text>
              </View>
              {/* the deadline dot sits under the number */}
              <View style={[styles.dot, hasDot && styles.dotOn]} />
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', marginBottom: 6 },
  weekday: {
    flexBasis: '14.28%', textAlign: 'center',
    color: COLORS.muted2, fontSize: 11, fontWeight: '600', letterSpacing: 1,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap' },
  cell: {
    flexBasis: '14.28%', alignItems: 'center',
    paddingVertical: 5,
  },
  dayCircle: {
    width: 34, height: 34, borderRadius: 17,
    alignItems: 'center', justifyContent: 'center',
  },
  dayToday: { borderWidth: 1.5, borderColor: COLORS.espressoLight },
  daySelected: { backgroundColor: COLORS.espresso },
  dayText: { color: COLORS.ink, fontSize: 14 },
  dayTextToday: { fontWeight: '700', color: COLORS.espressoLight },
  dayTextSelected: { color: COLORS.bg, fontWeight: '700' },
  dot: {
    width: 5, height: 5, borderRadius: 3, marginTop: 2,
    backgroundColor: 'transparent',
  },
  dotOn: { backgroundColor: COLORS.espressoLight },
});
