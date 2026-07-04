// =====================================================================
//  Habits tab
//  A slim rail on the left keeps the screen calm — one part at a time:
//    Today   — the checkable list of daily habits
//    Tracker — tap a habit for its analytics (heatmap, streaks, %)
//    Add     — create a new habit
//  The rail remembers which part you had open last time.
// =====================================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SERIF } from '../theme';
import { todayKey, addDays, currentStreak, bestStreak } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import CalendarPager from '../components/CalendarPager';
import ModalShell from '../components/ModalShell';

const SUBTAB_KEY = '@organize_habits_subtab';
const PARTS = [
  { id: 'today', label: 'Today' },
  { id: 'tracker', label: 'Tracker' },
  { id: 'add', label: 'Add' },
];

export default function HabitsScreen({ habits, addHabit, toggleHabit, deleteHabit }) {
  const [part, setPart] = useState('today');
  const [newHabit, setNewHabit] = useState('');
  const [openId, setOpenId] = useState(null); // which habit's analytics are open
  const today = todayKey();

  // Open where the user left off last time.
  useEffect(() => {
    AsyncStorage.getItem(SUBTAB_KEY)
      .then((v) => { if (v && PARTS.some((p) => p.id === v)) setPart(v); })
      .catch(() => {});
  }, []);
  function choosePart(id) {
    setPart(id);
    AsyncStorage.setItem(SUBTAB_KEY, id).catch(() => {});
  }

  const doneCount = habits.filter((h) => h.lastDone === today).length;
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);

  function onAdd() {
    const name = newHabit.trim();
    if (!name) return;
    addHabit(name);
    setNewHabit('');
    choosePart('today'); // straight back to the list, new habit ready to tick
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

      <View style={styles.body}>
        {/* --- Left rail --- */}
        <View style={styles.rail}>
          {PARTS.map((p) => (
            <TouchableOpacity
              key={p.id}
              style={[styles.railBtn, part === p.id && styles.railBtnOn]}
              onPress={() => choosePart(p.id)}
            >
              <Text style={[styles.railText, part === p.id && styles.railTextOn]}>
                {p.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* --- Content --- */}
        <View style={styles.content}>
          {part === 'today' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <View style={styles.summary}>
                <Text style={styles.summaryBig}>
                  {doneCount}<Text style={styles.summaryDim}> / {total}</Text>
                </Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${percent}%` }]} />
                </View>
              </View>
              {habits.length === 0 && (
                <Text style={styles.empty}>No habits yet — add your first from the rail.</Text>
              )}
              {habits.map((h) => <HabitRow key={h.id} habit={h} />)}
            </ScrollView>
          )}

          {part === 'tracker' && (
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 30 }}>
              <Text style={styles.hint}>Last 7 days — tap a habit for the full picture.</Text>
              {habits.length === 0 && (
                <Text style={styles.empty}>Nothing to track yet.</Text>
              )}
              {habits.map((h) => <TrackerRow key={h.id} habit={h} />)}
            </ScrollView>
          )}

          {part === 'add' && (
            <View>
              <Text style={styles.hint}>
                Small and specific beats big and vague —{'\n'}"Read 10 pages" over "Read more".
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Drink 2L of water…"
                placeholderTextColor={COLORS.muted2}
                value={newHabit}
                onChangeText={setNewHabit}
                onSubmitEditing={onAdd}
                returnKeyType="done"
                autoFocus
              />
              <TouchableOpacity
                style={[styles.primaryBtn, !newHabit.trim() && { opacity: 0.4 }]}
                onPress={onAdd}
                disabled={!newHabit.trim()}
              >
                <Text style={styles.primaryBtnText}>Add habit</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

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

  body: { flex: 1, flexDirection: 'row', gap: 12 },

  rail: { width: 86, gap: 8 },
  railBtn: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, paddingVertical: 13, alignItems: 'center',
  },
  railBtnOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  railText: { color: COLORS.muted, fontSize: 13.5, fontWeight: '600' },
  railTextOn: { color: COLORS.bg, fontWeight: '700' },

  content: { flex: 1 },

  summary: {
    backgroundColor: COLORS.panel, borderRadius: 14, borderWidth: 1,
    borderColor: COLORS.line, padding: 14, marginBottom: 12,
  },
  summaryBig: { color: COLORS.ink, fontSize: 20, fontWeight: '700' },
  summaryDim: { color: COLORS.muted, fontSize: 15, fontWeight: '500' },
  barTrack: {
    height: 7, borderRadius: 7, backgroundColor: 'rgba(59,44,30,0.08)',
    marginTop: 10, overflow: 'hidden',
  },
  barFill: { height: 7, borderRadius: 7, backgroundColor: COLORS.espresso },

  hint: { color: COLORS.muted, fontSize: 13, lineHeight: 19, marginBottom: 12 },

  input: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: COLORS.ink, fontSize: 16, marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.bg, fontSize: 15.5, fontWeight: '700' },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 14,
    paddingVertical: 14, paddingHorizontal: 14, marginBottom: 10,
  },
  check: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2,
    borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center',
    marginRight: 12,
  },
  checkOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  checkMark: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },
  habitName: { color: COLORS.ink, fontSize: 15.5, flex: 1 },
  habitNameDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  streak: { color: COLORS.espressoLight, fontSize: 13.5, fontWeight: '600' },

  weekStrip: { flexDirection: 'row', gap: 4, marginLeft: 8 },
  weekCell: {
    width: 13, height: 20, borderRadius: 4,
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

  empty: { color: COLORS.muted, fontSize: 14, lineHeight: 20 },
});
