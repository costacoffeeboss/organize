// =====================================================================
//  Atomic — Habit Tracker (starter)
//  A single-screen React Native app you run with Expo.
//
//  Coming from Python? A few quick mental mappings:
//    - This file is JavaScript. `const` = a variable you won't reassign.
//    - A "component" is just a function that returns UI (like HTML).
//    - useState = a variable React watches; when it changes, the screen redraws.
//    - useEffect = "run this code when X happens" (e.g. on app start).
//    - => is a lambda, same idea as Python's `lambda` / a small function.
//  Don't worry about understanding every line yet — change things and see
//  what happens. That's the fastest way to learn.
// =====================================================================

import React, { useState, useEffect } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  FlatList, SafeAreaView, Alert, Platform, StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Where we save habits on the phone. Bump the "v1" if you change the shape.
const STORAGE_KEY = '@atomic_habits_v1';

// --- Brand colours (matches the Atomic landing page) --- #a78bfa
const COLORS = {
  bg: '#0c0c11',
  panel: '#16161f',
  line: 'rgba(255,255,255,0.08)',
  ink: '#f2f2f7',
  muted: '#8d909e',
  violet: '#8b5cf6',
  violetLight: '#a78bfa',
};

// --- Small date helpers ---
// We identify a day by a string like "2026-06-07" (local time).
function dateKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return dateKey(d);
}

export default function App() {
  // The list of habits. Each one looks like:
  //   { id, name, streak, lastDone }   (lastDone is a date string or null)
  const [habits, setHabits] = useState([]);
  // The text currently typed into the "add a habit" box.
  const [newHabit, setNewHabit] = useState('');
  // Tracks whether we've finished loading saved data (avoids a flicker).
  const [loaded, setLoaded] = useState(false);

  // 1) On app start, load any saved habits from the phone.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) setHabits(JSON.parse(raw));
      } catch (e) {
        console.log('Could not load habits:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []); // empty [] = "run once, when the app first opens"

  // 2) Whenever habits change, save them back to the phone.
  useEffect(() => {
    if (!loaded) return; // don't overwrite saved data before we've loaded it
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(habits)).catch((e) =>
      console.log('Could not save habits:', e)
    );
  }, [habits, loaded]);

  // --- Actions ---

  function addHabit() {
    const name = newHabit.trim();
    if (!name) return;
    const habit = { id: Date.now().toString(), name, streak: 0, lastDone: null };
    setHabits((prev) => [...prev, habit]); // [...prev, x] = a new list with x added
    setNewHabit('');
  }

  // Tick / un-tick a habit for today, updating its streak.
  function toggleHabit(id) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h; // leave other habits untouched
        const doneToday = h.lastDone === dateKey();
        if (doneToday) {
          // Un-tick: step the streak back by one. (Simplified — good enough to start.)
          return { ...h, lastDone: null, streak: Math.max(0, h.streak - 1) };
        }
        // Tick: if we did it yesterday too, the streak continues; otherwise it restarts at 1.
        const continued = h.lastDone === yesterdayKey();
        return { ...h, lastDone: dateKey(), streak: continued ? h.streak + 1 : 1 };
      })
    );
  }

  function deleteHabit(id) {
    Alert.alert('Delete habit?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => setHabits((prev) => prev.filter((h) => h.id !== id)),
      },
    ]);
  }

  // --- Derived values (recalculated every redraw) ---
  const doneCount = habits.filter((h) => h.lastDone === dateKey()).length;
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const niceDate = new Date().toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  // --- One row in the list ---
  function HabitRow({ habit }) {
    const done = habit.lastDone === dateKey();
    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => toggleHabit(habit.id)}
        onLongPress={() => deleteHabit(habit.id)} // hold to delete
      >
        <View style={[styles.check, done && styles.checkOn]}>
          {done && <Text style={styles.checkMark}>✓</Text>}
        </View>
        <Text style={[styles.habitName, done && styles.habitNameDone]}>
          {habit.name}
        </Text>
        {habit.streak > 0 && (
          <Text style={styles.streak}>🔥 {habit.streak}</Text>
        )}
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.logo}>atomic</Text>
        <Text style={styles.date}>{niceDate}</Text>
      </View>

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
          placeholderTextColor={COLORS.muted}
          value={newHabit}
          onChangeText={setNewHabit}
          onSubmitEditing={addHabit} // pressing "return" adds it
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={addHabit}>
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* The list of habits */}
      <FlatList
        data={habits}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => <HabitRow habit={item} />}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            No habits yet. Add your first one above —{'\n'}small pieces, big impact.
          </Text>
        }
      />
    </SafeAreaView>
  );
}

// --- Styles (like CSS, but written as a JS object) ---
const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: COLORS.bg,
    paddingHorizontal: 20,
    // Push content below the phone's status bar on Android:
    paddingTop: Platform.OS === 'android' ? RNStatusBar.currentHeight : 0,
  },
  header: { marginTop: 12, marginBottom: 20 },
  logo: { color: COLORS.ink, fontSize: 28, fontWeight: '800', letterSpacing: -0.5 },
  date: { color: COLORS.muted, fontSize: 14, marginTop: 2 },

  summary: {
    backgroundColor: COLORS.panel,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    padding: 18,
    marginBottom: 18,
  },
  summaryBig: { color: COLORS.ink, fontSize: 22, fontWeight: '700' },
  summaryDim: { color: COLORS.muted, fontSize: 16, fontWeight: '500' },
  barTrack: {
    height: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    marginTop: 14,
    overflow: 'hidden',
  },
  barFill: { height: 8, borderRadius: 8, backgroundColor: COLORS.violet },

  addRow: { flexDirection: 'row', marginBottom: 18 },
  input: {
    flex: 1,
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: COLORS.ink,
    fontSize: 16,
  },
  addBtn: {
    width: 48,
    marginLeft: 10,
    borderRadius: 14,
    backgroundColor: COLORS.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addBtnText: { color: '#fff', fontSize: 26, fontWeight: '600', marginTop: -2 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: COLORS.muted,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  checkOn: { backgroundColor: COLORS.violet, borderColor: COLORS.violet },
  checkMark: { color: '#fff', fontSize: 14, fontWeight: '700' },
  habitName: { color: COLORS.ink, fontSize: 16, flex: 1 },
  habitNameDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  streak: { color: COLORS.violetLight, fontSize: 14, fontWeight: '600' },

  empty: { color: COLORS.muted, fontSize: 15, textAlign: 'center', marginTop: 50, lineHeight: 22 },
});
