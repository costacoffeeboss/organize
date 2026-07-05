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
  View, Text, TextInput, TouchableOpacity, ScrollView, Animated, Easing,
  Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import {
  todayKey, addDays, currentStreak, bestStreak, weekStartKey, countInWeek,
  WEEKDAY_LETTERS,
} from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import CalendarPager from '../components/CalendarPager';
import ModalShell from '../components/ModalShell';
import ProgressRing from '../components/ProgressRing';
import FAB from '../components/FAB';

// One habit: check to tick, tap for analytics, hold to delete.
// The strip shows THIS week (Mon–Sun) against the habit's weekly
// target; hitting the target plays a small celebration on the row.
// Module-level so animations survive parent re-renders.
function HabitRow({ habit, today, onToggle, onOpen, onLongPress }) {
  const done = habit.lastDone === today;
  const days = new Set(habit.history || []);
  const target = habit.target || 7;
  const weekly = target < 7;
  const ws = weekStartKey(today);
  const week = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
  const weekCount = countInWeek(days, ws);
  const weekHit = weekCount >= target;

  // Tick pop
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

  // Week-complete celebration: the tick that reaches the target makes
  // the row swell, glow crema, and a "Week complete" ribbon springs in
  // before settling back down. Bigger than a pop, smaller than a popup.
  const flash = useRef(new Animated.Value(0)).current;
  const prevCount = useRef(weekCount);
  useEffect(() => {
    if (weekCount >= target && prevCount.current === target - 1) {
      Animated.sequence([
        Animated.spring(flash, { toValue: 1, friction: 5, tension: 120, useNativeDriver: true }),
        Animated.delay(1500),
        Animated.timing(flash, {
          toValue: 0, duration: 550, easing: Easing.in(Easing.quad), useNativeDriver: true,
        }),
      ]).start();
    }
    prevCount.current = weekCount;
  }, [weekCount]);

  return (
    <Animated.View style={{
      transform: [{ scale: flash.interpolate({ inputRange: [0, 1], outputRange: [1, 1.035] }) }],
    }}>
      <TouchableOpacity
        style={styles.row}
        onPress={onOpen}
        onLongPress={onLongPress}
        activeOpacity={0.8}
      >
        {/* celebration glow */}
        <Animated.View pointerEvents="none" style={[styles.celebration, {
          opacity: flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        }]} />
        {/* celebration ribbon */}
        <Animated.View pointerEvents="none" style={[styles.ribbon, {
          opacity: flash,
          transform: [{ translateY: flash.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
        }]}>
          <Text style={styles.ribbonText}>✦ Week complete</Text>
        </Animated.View>

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
          <View style={styles.weekWrap}>
            <View style={styles.weekStrip}>
              {week.map((k, i) => (
                <View key={k} style={[
                  styles.weekCell,
                  days.has(k) && (weekHit ? styles.weekCellHit : styles.weekCellOn),
                  k > today && styles.weekCellFuture,
                  k === today && styles.weekCellToday,
                ]} />
              ))}
            </View>
            {weekly && (
              weekHit
                ? <Text style={styles.weekHitTag}>✓ {weekCount}/{target}</Text>
                : <Text style={styles.weekCountTag}>{weekCount}/{target}</Text>
            )}
          </View>
        </View>

        <View style={styles.rowRight}>
          {habit.streak > 0 && (
            <Text style={styles.streak}>🔥 {habit.streak}{weekly ? 'w' : ''}</Text>
          )}
          <Text style={styles.chevron}>›</Text>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}

export default function HabitsScreen({ habits, addHabit, toggleHabit, deleteHabit }) {
  const [showAdd, setShowAdd] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const [newTarget, setNewTarget] = useState(7); // times per week
  const [openId, setOpenId] = useState(null); // which habit's analytics are open
  const today = todayKey();

  const doneCount = habits.filter((h) => h.lastDone === today).length;
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  // The headline streak is the best DAY streak among daily habits.
  const topStreak = Math.max(0, ...habits
    .filter((h) => (h.target || 7) === 7)
    .map((h) => h.streak || 0));

  function onAdd() {
    const name = newHabit.trim();
    if (!name) return;
    addHabit(name, newTarget);
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

      <FAB onPress={() => { setNewHabit(''); setNewTarget(7); setShowAdd(true); }} />

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

          <Text style={styles.targetLabel}>How many days a week?</Text>
          <View style={styles.targetRow}>
            {[1, 2, 3, 4, 5, 6, 7].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.targetChip, newTarget === n && styles.targetChipOn]}
                onPress={() => setNewTarget(n)}
              >
                <Text style={[styles.targetChipText, newTarget === n && styles.targetChipTextOn]}>
                  {n}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.targetHint}>
            {newTarget === 7 ? 'Every day — streak counts days.' : `${newTarget}× a week — streak counts weeks you hit it.`}
          </Text>

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
                <Text style={styles.statNum}>{open.streak || 0}</Text>
                <Text style={styles.statLabel}>
                  {(open.target || 7) < 7 ? 'week streak' : 'streak'}
                </Text>
              </View>
              {(open.target || 7) < 7 && (
                <View style={styles.stat}>
                  <Text style={styles.statNum}>
                    {countInWeek(openDays, weekStartKey(today))}/{open.target}
                  </Text>
                  <Text style={styles.statLabel}>this week</Text>
                </View>
              )}
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

  weekWrap: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 7 },
  weekStrip: { flexDirection: 'row', gap: 4 },
  weekCell: {
    width: 15, height: 9, borderRadius: 3,
    backgroundColor: 'rgba(59,44,30,0.07)',
    borderWidth: 1, borderColor: COLORS.line,
  },
  weekCellOn: { backgroundColor: COLORS.espressoLight, borderColor: COLORS.espressoLight },
  weekCellHit: { backgroundColor: COLORS.gold, borderColor: COLORS.gold },
  weekCellFuture: { opacity: 0.45 },
  weekCellToday: { borderColor: COLORS.espressoLight },
  weekCountTag: { color: COLORS.muted2, fontSize: 11.5, fontWeight: '700' },
  weekHitTag: { color: COLORS.gold, fontSize: 11.5, fontWeight: '800' },

  celebration: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: COLORS.crema, borderRadius: 14,
  },
  ribbon: {
    position: 'absolute', top: -10, right: 12, zIndex: 2,
    backgroundColor: COLORS.espresso, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 4,
    shadowColor: COLORS.ink, shadowOpacity: 0.25, shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 }, elevation: 4,
  },
  ribbonText: { color: COLORS.bg, fontSize: 11.5, fontWeight: '800', letterSpacing: 0.3 },

  targetLabel: { color: COLORS.ink, fontSize: 14, fontWeight: '700', marginTop: 10, marginBottom: 8 },
  targetRow: { flexDirection: 'row', gap: 7 },
  targetChip: {
    flex: 1, height: 40, borderRadius: 12, borderWidth: 1,
    borderColor: COLORS.lineStrong, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  targetChipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  targetChipText: { color: COLORS.muted, fontSize: 14.5, fontWeight: '700' },
  targetChipTextOn: { color: COLORS.bg },
  targetHint: { color: COLORS.muted2, fontSize: 12.5, marginTop: 8, marginBottom: 4 },

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
