// =====================================================================
//  MonthGrid — a Monday-first month calendar grid.
//  Used all over: the Calendar tab, date pickers, habit analytics and
//  the journal. Building it once and reusing it is the whole point.
//
//  Props:
//    year, month   — which month to show (month is 0-based, like JS Dates)
//    selected      — the currently selected date key ("2026-07-02") or null
//    onSelect(key) — called when the user taps a day
//    dots          — { "2026-07-02": [color, color], ... } small dots
//                    under a day (up to 3 shown)
//    filled        — a Set of keys drawn as solid espresso circles
//                    (used as a "done" heatmap in habit analytics)
//    maxKey        — days after this key are dimmed and untappable
//                    (the journal can't write in the future)
// =====================================================================

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS } from '../theme';
import { monthCells, todayKey, WEEKDAY_LETTERS } from '../utils/dates';

export default function MonthGrid({ year, month, selected, onSelect, dots, filled, maxKey }) {
  const cells = monthCells(year, month);
  const today = todayKey();

  return (
    <View>
      {/* Weekday header row */}
      <View style={styles.week}>
        {WEEKDAY_LETTERS.map((w, i) => (
          <Text key={i} style={styles.weekday}>{w}</Text>
        ))}
      </View>

      {/* Day cells, 7 per row (flexWrap does the wrapping for us) */}
      <View style={styles.grid}>
        {cells.map((cell, i) => {
          if (!cell) return <View key={i} style={styles.cell} />;
          const isToday = cell.key === today;
          const isSelected = cell.key === selected;
          const isFilled = filled && filled.has(cell.key);
          const disabled = maxKey && cell.key > maxKey;
          const dayDots = (dots && dots[cell.key]) || [];
          return (
            <TouchableOpacity
              key={i}
              style={styles.cell}
              disabled={disabled || !onSelect}
              onPress={() => onSelect && onSelect(cell.key)}
            >
              <View style={[
                styles.dayCircle,
                isToday && styles.dayToday,
                isFilled && styles.dayFilled,
                isSelected && styles.daySelected,
              ]}>
                <Text style={[
                  styles.dayText,
                  isToday && styles.dayTextToday,
                  disabled && styles.dayTextDisabled,
                  (isSelected || isFilled) && styles.dayTextSelected,
                ]}>
                  {cell.day}
                </Text>
              </View>
              {/* up to three little dots sit under the number */}
              <View style={styles.dotRow}>
                {dayDots.slice(0, 3).map((c, j) => (
                  <View key={j} style={[styles.dot, { backgroundColor: c }]} />
                ))}
              </View>
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
  dayFilled: { backgroundColor: COLORS.espresso },
  daySelected: { backgroundColor: COLORS.espresso },
  dayText: { color: COLORS.ink, fontSize: 14 },
  dayTextToday: { fontWeight: '700', color: COLORS.espressoLight },
  dayTextDisabled: { color: COLORS.muted2, opacity: 0.5 },
  dayTextSelected: { color: COLORS.bg, fontWeight: '700' },
  dotRow: { flexDirection: 'row', gap: 3, height: 5, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
