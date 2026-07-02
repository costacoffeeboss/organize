// =====================================================================
//  Habits tab
//  Daily routines with streaks. Habits arrive here two ways:
//    1. Added directly below.
//    2. Created from the To-dos tab with the "Habit" option — those
//       live in BOTH tabs, and one tick updates both.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme';
import { todayKey } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';

export default function HabitsScreen({ habits, addHabit, toggleHabit, deleteHabit }) {
  const [newHabit, setNewHabit] = useState('');
  const today = todayKey();

  const doneCount = habits.filter((h) => h.lastDone === today).length;
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  function onAdd() {
    const name = newHabit.trim();
    if (!name) return;
    addHabit(name);
    setNewHabit('');
  }

  function onLongPress(habit) {
    Alert.alert('Delete habit?', 'Streak history will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
    ]);
  }

  function HabitRow({ habit }) {
    const done = habit.lastDone === today;
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => toggleHabit(habit.id)}
        onLongPress={() => onLongPress(habit)}
      >
        <View style={[styles.check, done && styles.checkOn]}>
          {done && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <Text style={[styles.habitName, done && styles.habitNameDone]}>
          {habit.name}
        </Text>
        {habit.streak > 0 && <Text style={styles.streak}>🔥 {habit.streak}</Text>}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Habits" subtitle="Small things, done daily" />

      {/* Progress summary */}
      <View style={styles.summary}>
        <Text style={styles.summaryBig}>
          {doneCount}<Text style={styles.summaryDim}> / {total} done today</Text>
        </Text>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${percent}%` }]} />
        </View>
      </View>

      {/* Add a habit */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a habit…"
          placeholderTextColor={COLORS.muted2}
          value={newHabit}
          onChangeText={setNewHabit}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HabitRow habit={item} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No habits yet. Add one above, or tag a to-do{'\n'}as a habit from the To-dos tab.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  summary: {
    backgroundColor: COLORS.panel, borderRadius: 16, borderWidth: 1,
    borderColor: COLORS.line, padding: 18, marginBottom: 14,
  },
  summaryBig: { color: COLORS.ink, fontSize: 22, fontWeight: '700' },
  summaryDim: { color: COLORS.muted, fontSize: 16, fontWeight: '500' },
  barTrack: {
    height: 8, borderRadius: 8, backgroundColor: 'rgba(59,44,30,0.08)',
    marginTop: 14, overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 8, backgroundColor: COLORS.espresso },

  addRow: { flexDirection: 'row', marginBottom: 14 },
  input: {
    flex: 1, backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: COLORS.ink, fontSize: 16,
  },
  addBtn: {
    width: 48, marginLeft: 10, borderRadius: 14, backgroundColor: COLORS.espresso,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtnText: { color: COLORS.bg, fontSize: 26, fontWeight: '600', marginTop: -2 },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 14,
    paddingVertical: 16, paddingHorizontal: 16, marginBottom: 10,
  },
  check: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2,
    borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  checkOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  checkMark: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },
  habitName: { color: COLORS.ink, fontSize: 16, flex: 1 },
  habitNameDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  streak: { color: COLORS.espressoLight, fontSize: 14, fontWeight: '600' },

  empty: { color: COLORS.muted, fontSize: 15, textAlign: 'center', marginTop: 50, lineHeight: 22 },
});
