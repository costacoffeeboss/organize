// =====================================================================
//  Habits tab
//  Two halves, like the landing page promised:
//    Today   — the checkable list of daily habits
//    Tracker — tap any habit to see its analytics: a month heatmap of
//              completed days, current & best streak, and the last
//              30 days as a percentage.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import { todayKey, addDays, currentStreak, bestStreak } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import CalendarPager from '../components/CalendarPager';
import ModalShell from '../components/ModalShell';

export default function HabitsScreen({ habits, addHabit, toggleHabit, deleteHabit }) {
  const [newHabit, setNewHabit] = useState('');
  const [openId, setOpenId] = useState(null); // which habit's analytics are open
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
    Alert.alert('Delete habit?', 'Its history will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
    ]);
  }

  // --- One row in the Today checklist ---
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

  // --- One row in the Tracker: name + the last 7 days as mini cells ---
  function TrackerRow({ habit }) {
    const days = new Set(habit.history || []);
    const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => setOpenId(habit.id)}
        onLongPress={() => onLongPress(habit)}
      >
        <Text style={styles.habitName} numberOfLines={1}>{habit.name}</Text>
        <View style={styles.weekStrip}>
          {week.map((k) => (
            <View key={k} style={[styles.weekCell, days.has(k) && styles.weekCellOn]} />
          ))}
        </View>
      </TouchableOpacity>
    );
  }

  const open = habits.find((h) => h.id === openId);
  const openDays = open ? new Set(open.history || []) : new Set();
  const last30 = open
    ? Array.from({ length: 30 }, (_, i) => addDays(today, -i)).filter((k) => openDays.has(k)).length
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Habits" subtitle="Small things, done daily" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
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

        {/* Today checklist */}
        <Text style={styles.sectionTitle}>Today</Text>
        {habits.length === 0 && (
          <Text style={styles.empty}>No habits yet — add one above.</Text>
        )}
        {habits.map((h) => <HabitRow key={h.id} habit={h} />)}

        {/* Tracker */}
        {habits.length > 0 && (
          <View>
            <Text style={styles.sectionTitle}>Habit tracker</Text>
            <Text style={styles.trackerHint}>Last 7 days — tap a habit for the full picture.</Text>
            {habits.map((h) => <TrackerRow key={h.id} habit={h} />)}
          </View>
        )}
      </ScrollView>

      {/* ================= Analytics pop-up ================= */}
      <ModalShell
        visible={!!open}
        onClose={() => setOpenId(null)}
        title={open ? open.name : ''}
      >
        {open && (
          <View>
            {/* Stat tiles */}
            <View style={styles.statRow}>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{currentStreak(openDays)}</Text>
                <Text style={styles.statLabel}>streak</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{bestStreak(openDays)}</Text>
                <Text style={styles.statLabel}>best</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{Math.round((last30 / 30) * 100)}%</Text>
                <Text style={styles.statLabel}>last 30 days</Text>
              </View>
              <View style={styles.stat}>
                <Text style={styles.statNum}>{openDays.size}</Text>
                <Text style={styles.statLabel}>total</Text>
              </View>
            </View>

            {/* Month heatmap — filled circles are completed days */}
            <CalendarPager filled={openDays} maxKey={today} />
          </View>
        )}
      </ModalShell>
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

  addRow: { flexDirection: 'row', marginBottom: 6 },
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

  sectionTitle: {
    color: COLORS.muted2, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginTop: 14, marginBottom: 8,
  },
  trackerHint: { color: COLORS.muted, fontSize: 13, marginBottom: 10, marginTop: -4 },

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

  weekStrip: { flexDirection: 'row', gap: 5, marginLeft: 10 },
  weekCell: {
    width: 16, height: 22, borderRadius: 5,
    backgroundColor: 'rgba(59,44,30,0.07)',
    borderWidth: 1, borderColor: COLORS.line,
  },
  weekCellOn: { backgroundColor: COLORS.espressoLight, borderColor: COLORS.espressoLight },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: {
    flex: 1, backgroundColor: COLORS.panelDeep, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.line,
    paddingVertical: 12, alignItems: 'center',
  },
  statNum: { color: COLORS.ink, fontSize: 20, fontWeight: '700', fontFamily: SERIF },
  statLabel: { color: COLORS.muted2, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3 },

  empty: { color: COLORS.muted, fontSize: 14.5, marginBottom: 8 },
});
