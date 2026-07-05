// =====================================================================
//  Habits tab
//  One calm page: the big completion ring up top (like the landing
//  page mock), then every habit as a rich row — tick it, see its last
//  seven days at a glance, and tap through for the full analytics.
//  The floating ＋ adds a new habit.
//
//  Row gestures: the checkbox ticks · the row opens analytics ·
//  a long press deletes.
// =====================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Animated,
  Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import { todayKey, addDays, currentStreak, bestStreak } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import CalendarPager from '../components/CalendarPager';
import ModalShell from '../components/ModalShell';
import ProgressRing from '../components/ProgressRing';
import FAB from '../components/FAB';

// One habit: check to tick, tap for analytics, hold to delete.
// Module-level so the tick-pop animation survives parent re-renders.
function HabitRow({ habit, today, onToggle, onOpen, onLongPress }) {
  const done = habit.lastDone === today;
  const days = new Set(habit.history || []);
  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  const pop = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);
  useEffect(() => {
    if (done && !wasDone.current) {
      pop.setValue(0.4);
      Animated.spring(pop, {
        toValue: 1, friction: 4, tension: 220, useNativeDriver: true,
      }).start();
    }
    wasDone.current = done;
  }, [done]);

  return (
    <TouchableOpacity
      style={styles.row}
      onPress={onOpen}
      onLongPress={onLongPress}
      activeOpacity={0.8}
    >
      <TouchableOpacity
        onPress={onToggle}
        hitSlop={{ top: 12, bottom: 12, left: 12, right: 8 }}
      >
        <Animated.View style={[styles.check, done && styles.checkOn, { transform: [{ scale: pop }] }]}>
          {done && <Text style={styles.checkMark}>✓</Text>}
        </Animated.View>
      </TouchableOpacity>

      <View style={{ flex: 1, marginLeft: 13 }}>
        <Text style={[styles.habitName, done && styles.habitNameDone]} numberOfLines={1}>
          {habit.name}
        </Text>
        <View style={styles.weekStrip}>
          {week.map((k) => (
            <View key={k} style={[styles.weekCell, days.has(k) && styles.weekCellOn]} />
          ))}
        </View>
      </View>

      <View style={styles.rowRight}>
        {habit.streak > 0 && <Text style={styles.streak}>🔥 {habit.streak}</Text>}
        <Text style={styles.chevron}>›</Text>
      </View>
    </TouchableOpacity>
  );
}

export default function HabitsScreen({ habits, addHabit, toggleHabit, deleteHabit }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [openId, setOpenId] = useState(null); // which habit's analytics are open
  const today = todayKey();

  const doneCount = habits.filter((h) => h.lastDone === today).length;
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  const topStreak = Math.max(0, ...habits.map((h) => currentStreak(new Set(h.history || []))));

  function onAdd() {
    const name = newHabit.trim();
    if (!name) return;
    addHabit(name);
    setNewHabit('');
    setShowAdd(false);
  }

  function onLongPress(habit) {
    Alert.alert('Delete habit?', 'Its history will be lost.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteHabit(habit.id) },
    ]);
  }

  const open = habits.find((h) => h.id === openId);
  const openDays = open ? new Set(open.history || []) : new Set();
  const last30 = open
    ? Array.from({ length: 30 }, (_, i) => addDays(today, -i)).filter((k) => openDays.has(k)).length
    : 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Habits" subtitle="Small things, done daily" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {/* --- The ring --- */}
        <View style={styles.ringCard}>
          <ProgressRing percent={percent} size={96} stroke={10}>
            <Text style={styles.ringPct}>{percent}%</Text>
          </ProgressRing>
          <View style={{ flex: 1, marginLeft: 18 }}>
            <Text style={styles.ringTitle}>Today</Text>
            <Text style={styles.ringMeta}>
              {total === 0
                ? 'Nothing tracked yet.'
                : <Text><Text style={styles.ringStrong}>{doneCount} of {total}</Text> done{topStreak > 1 ? ` · ${topStreak}-day streak` : ''}</Text>}
            </Text>
            {total > 0 && doneCount === total && (
              <Text style={styles.ringDone}>All done. Quietly excellent.</Text>
            )}
          </View>
        </View>

        {/* --- The habits --- */}
        {habits.length === 0 ? (
          <Text style={styles.empty}>
            No habits yet. Tap ＋ and start with something small —{'\n'}"Read 10 pages" beats "Read more".
          </Text>
        ) : (
          <Text style={styles.hint}>Tick the box · tap a habit for its story · hold to delete.</Text>
        )}
        {habits.map((h) => (
          <HabitRow
            key={h.id}
            habit={h}
            today={today}
            onToggle={() => toggleHabit(h.id)}
            onOpen={() => setOpenId(h.id)}
            onLongPress={() => onLongPress(h)}
          />
        ))}
      </ScrollView>

      <FAB onPress={() => { setNewHabit(''); setShowAdd(true); }} />

      {/* ================= Add pop-up ================= */}
      <ModalShell visible={showAdd} onClose={() => setShowAdd(false)} title="New habit">
        <View>
          <Text style={styles.addHint}>
            Small and specific beats big and vague — "Drink 2L of water" over "Be healthier".
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
      </ModalShell>

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

  ringCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 18, padding: 18, marginBottom: 16,
  },
  ringPct: { color: COLORS.ink, fontSize: 19, fontWeight: '700', fontFamily: SERIF },
  ringTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '600', fontFamily: SERIF },
  ringMeta: { color: COLORS.muted, fontSize: 14.5, marginTop: 4 },
  ringStrong: { color: COLORS.espressoLight, fontWeight: '700' },
  ringDone: { color: COLORS.espresso, fontSize: 13, fontWeight: '700', marginTop: 6 },

  hint: { color: COLORS.muted2, fontSize: 12.5, marginBottom: 10 },
  empty: { color: COLORS.muted, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 30 },

  row: {
    flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 14,
    paddingVertical: 13, paddingHorizontal: 14, marginBottom: 10,
  },
  check: {
    width: 26, height: 26, borderRadius: 9, borderWidth: 2,
    borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  checkMark: { color: COLORS.bg, fontSize: 15, fontWeight: '700' },
  habitName: { color: COLORS.ink, fontSize: 15.5, fontWeight: '600' },
  habitNameDone: { color: COLORS.muted, textDecorationLine: 'line-through' },

  weekStrip: { flexDirection: 'row', gap: 4, marginTop: 7 },
  weekCell: {
    width: 15, height: 9, borderRadius: 3,
    backgroundColor: 'rgba(59,44,30,0.07)',
    borderWidth: 1, borderColor: COLORS.line,
  },
  weekCellOn: { backgroundColor: COLORS.espressoLight, borderColor: COLORS.espressoLight },

  rowRight: { alignItems: 'flex-end', marginLeft: 10, flexDirection: 'row', gap: 8 },
  streak: { color: COLORS.espressoLight, fontSize: 13.5, fontWeight: '600' },
  chevron: { color: COLORS.muted2, fontSize: 17, marginTop: -1 },

  addHint: { color: COLORS.muted, fontSize: 13.5, lineHeight: 19, marginBottom: 12 },
  input: {
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: COLORS.ink, fontSize: 16, marginBottom: 12,
  },
  primaryBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.bg, fontSize: 15.5, fontWeight: '700' },

  statRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  stat: {
    flex: 1, backgroundColor: COLORS.panelDeep, borderRadius: 12,
    borderWidth: 1, borderColor: COLORS.line,
    paddingVertical: 12, alignItems: 'center',
  },
  statNum: { color: COLORS.ink, fontSize: 20, fontWeight: '700', fontFamily: SERIF },
  statLabel: { color: COLORS.muted2, fontSize: 10.5, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase', marginTop: 3 },
});
