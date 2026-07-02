// =====================================================================
//  Calendar tab
//  A month view of every to-do that has a deadline. Days with
//  deadlines get a dot; tap a day to see (and tick off) its to-dos.
// =====================================================================

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, FlatList, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import { todayKey, monthLabel, shortDate } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import TodoRow from '../components/TodoRow';
import MonthGrid from '../components/MonthGrid';

export default function CalendarScreen({ todos, toggleTodo }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [selected, setSelected] = useState(todayKey());

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  // Every date that has at least one deadline gets a dot.
  const marked = new Set(todos.filter((t) => t.deadline).map((t) => t.deadline));

  // The to-dos due on the selected day.
  const dayTodos = todos.filter((t) => t.deadline === selected);
  const overdue = selected < todayKey();

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Calendar" subtitle="Deadlines at a glance" />

      <View style={styles.card}>
        <View style={styles.monthHead}>
          <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navArrow}>‹</Text>
          </TouchableOpacity>
          <Text style={styles.monthTitle}>{monthLabel(year, month)}</Text>
          <TouchableOpacity onPress={nextMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.navArrow}>›</Text>
          </TouchableOpacity>
        </View>
        <MonthGrid
          year={year}
          month={month}
          selected={selected}
          onSelect={setSelected}
          marked={marked}
        />
      </View>

      <Text style={styles.dayTitle}>{shortDate(selected)}</Text>
      <FlatList
        data={dayTodos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <TodoRow
            title={item.title}
            done={item.done}
            meta={item.done ? 'done' : overdue ? 'overdue' : null}
            metaColor={!item.done && overdue ? COLORS.danger : undefined}
            onToggle={() => toggleTodo(item.id)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>No deadlines on this day.</Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },
  card: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 16, padding: 14, marginBottom: 16,
  },
  monthHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  monthTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  navArrow: { color: COLORS.espressoLight, fontSize: 28, paddingHorizontal: 10, marginTop: -4 },
  dayTitle: {
    color: COLORS.muted2, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  empty: { color: COLORS.muted, fontSize: 14.5, textAlign: 'center', marginTop: 24 },
});
