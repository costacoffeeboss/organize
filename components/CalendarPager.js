// =====================================================================
//  CalendarPager — a MonthGrid with ‹ month › arrows and its own
//  "which month am I looking at" state. Every calendar in the app
//  (Calendar tab, date pickers, habit heatmap, journal) is one of these.
//
//  Props: everything MonthGrid takes, plus:
//    initialKey — which month to open on (defaults to today's month)
// =====================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { COLORS, SERIF } from '../theme';
import { monthLabel, parseKey, todayKey } from '../utils/dates';
import MonthGrid from './MonthGrid';

export default function CalendarPager({ initialKey, ...gridProps }) {
  const start = parseKey(initialKey || todayKey());
  const [year, setYear] = useState(start.getFullYear());
  const [month, setMonth] = useState(start.getMonth()); // 0-based

  function prev() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function next() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  return (
    <View>
      <View style={styles.head}>
        <TouchableOpacity onPress={prev} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.arrow}>‹</Text>
        </TouchableOpacity>
        <Text style={styles.month}>{monthLabel(year, month)}</Text>
        <TouchableOpacity onPress={next} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>
      <MonthGrid year={year} month={month} {...gridProps} />
    </View>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  month: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  arrow: { color: COLORS.espressoLight, fontSize: 28, paddingHorizontal: 12, marginTop: -4 },
});
