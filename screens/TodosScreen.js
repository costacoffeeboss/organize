// =====================================================================
//  To-dos tab
//  The main list. Adding a to-do offers three options:
//    Repeat   — daily / weekly / every 2 weeks / monthly
//    Deadline — pick a date on a mini calendar (shows up in Calendar tab)
//    Habit    — ALSO track it as a daily habit (lives in both tabs;
//               one tick updates both places)
//
//  Sections: Overdue (missed deadlines) → Today → Upcoming.
//  Completed items stay ticked for the rest of the day — small win,
//  small reward — then tidy themselves away overnight.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, SectionList,
  Modal, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import { todayKey, shortDate, niceDate, RECUR_LABELS } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import TodoRow from '../components/TodoRow';
import MonthGrid from '../components/MonthGrid';

const RECUR_OPTIONS = [
  { value: null, label: 'Off' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'fortnightly', label: '2 weeks' },
  { value: 'monthly', label: 'Monthly' },
];

export default function TodosScreen({ todos, habits, addTodo, toggleTodo, deleteTodo }) {
  const today = todayKey();

  // --- The "add a to-do" form state ---
  const [title, setTitle] = useState('');
  const [recur, setRecur] = useState(null);       // null | 'daily' | ...
  const [deadline, setDeadline] = useState(null); // null | "2026-07-04"
  const [habitOn, setHabitOn] = useState(false);
  const [showRecurRow, setShowRecurRow] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  // Which month the deadline picker is looking at:
  const now = new Date();
  const [pickYear, setPickYear] = useState(now.getFullYear());
  const [pickMonth, setPickMonth] = useState(now.getMonth());

  // The three options are mutually exclusive where they'd conflict:
  // a habit is implicitly daily, and a repeating task has no single deadline.
  function chooseRecur(value) {
    setRecur(value);
    if (value) { setDeadline(null); setHabitOn(false); }
    setShowRecurRow(false);
  }
  function chooseDeadline(key) {
    setDeadline(key);
    setRecur(null); setHabitOn(false);
    setShowPicker(false);
  }
  function toggleHabitOption() {
    setHabitOn((on) => {
      const next = !on;
      if (next) { setRecur(null); setDeadline(null); }
      return next;
    });
  }

  function onAdd() {
    const t = title.trim();
    if (!t) return;
    addTodo({ title: t, deadline, recur, habit: habitOn });
    setTitle(''); setRecur(null); setDeadline(null); setHabitOn(false);
  }

  // --- Is a given to-do ticked right now? ---
  function isDone(t) {
    if (t.habitId) {
      const h = habits.find((h) => h.id === t.habitId);
      return h ? h.lastDone === today : false;
    }
    if (t.recur) return t.completedOn === today;
    return t.done;
  }

  // --- Sort every to-do into a section ---
  const overdue = [], todayList = [], upcoming = [];
  todos.forEach((t) => {
    if (t.habitId) { todayList.push(t); return; }          // habits are daily
    if (t.recur) {
      if (t.completedOn === today || t.nextDue <= today) todayList.push(t);
      else upcoming.push(t);
      return;
    }
    if (t.done) { todayList.push(t); return; }             // ticked today
    if (t.deadline && t.deadline < today) overdue.push(t);
    else if (t.deadline && t.deadline > today) upcoming.push(t);
    else todayList.push(t);                                // due today / no deadline
  });
  overdue.sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  upcoming.sort((a, b) =>
    (a.deadline || a.nextDue) < (b.deadline || b.nextDue) ? -1 : 1
  );

  const sections = [
    { title: 'Overdue', data: overdue },
    { title: 'Today', data: todayList },
    { title: 'Upcoming', data: upcoming },
  ].filter((s) => s.data.length > 0);

  // --- The small right-hand label on each row ---
  function metaFor(t, section) {
    if (t.habitId) {
      const h = habits.find((h) => h.id === t.habitId);
      return h && h.streak > 0 ? `🔥 ${h.streak}` : 'habit';
    }
    if (t.recur) {
      const label = RECUR_LABELS[t.recur];
      return section === 'Upcoming' ? `${shortDate(t.nextDue)} · ${label}` : label;
    }
    if (t.deadline) return shortDate(t.deadline);
    return null;
  }

  function onLongPress(t) {
    const isHabit = !!t.habitId;
    Alert.alert(
      isHabit ? 'Delete habit?' : 'Delete to-do?',
      isHabit
        ? 'This is tracked as a habit — deleting removes it from both tabs.'
        : 'This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => deleteTodo(t.id) },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Organize" subtitle={niceDate()} />

      {/* --- Add a to-do --- */}
      <View style={styles.addRow}>
        <TextInput
          style={styles.input}
          placeholder="Add a to-do…"
          placeholderTextColor={COLORS.muted2}
          value={title}
          onChangeText={setTitle}
          onSubmitEditing={onAdd}
          returnKeyType="done"
        />
        <TouchableOpacity style={styles.addBtn} onPress={onAdd}>
          <Text style={styles.addBtnText}>＋</Text>
        </TouchableOpacity>
      </View>

      {/* --- Option chips --- */}
      <View style={styles.chips}>
        <TouchableOpacity
          style={[styles.chip, recur && styles.chipOn]}
          onPress={() => setShowRecurRow((v) => !v)}
        >
          <Text style={[styles.chipText, recur && styles.chipTextOn]}>
            ↻ {recur ? RECUR_LABELS[recur] : 'Repeat'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, deadline && styles.chipOn]}
          onPress={() => setShowPicker(true)}
        >
          <Text style={[styles.chipText, deadline && styles.chipTextOn]}>
            {deadline ? shortDate(deadline) : 'Deadline'}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.chip, habitOn && styles.chipOn]}
          onPress={toggleHabitOption}
        >
          <Text style={[styles.chipText, habitOn && styles.chipTextOn]}>
            {habitOn ? '✓ Habit' : 'Habit'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* --- Repeat choices (expand under the chips) --- */}
      {showRecurRow && (
        <View style={styles.chips}>
          {RECUR_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={String(opt.value)}
              style={[styles.chipSmall, recur === opt.value && styles.chipOn]}
              onPress={() => chooseRecur(opt.value)}
            >
              <Text style={[styles.chipText, recur === opt.value && styles.chipTextOn]}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* --- The list --- */}
      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        stickySectionHeadersEnabled={false}
        renderSectionHeader={({ section }) => (
          <Text style={[
            styles.sectionTitle,
            section.title === 'Overdue' && { color: COLORS.danger },
          ]}>
            {section.title}
          </Text>
        )}
        renderItem={({ item, section }) => (
          <TodoRow
            title={item.title}
            done={isDone(item)}
            meta={metaFor(item, section.title)}
            metaColor={section.title === 'Overdue' ? COLORS.danger : undefined}
            onToggle={() => toggleTodo(item.id)}
            onLongPress={() => onLongPress(item)}
          />
        )}
        contentContainerStyle={{ paddingBottom: 40 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing here yet. Add your first to-do above —{'\n'}everything in its place.
          </Text>
        }
      />

      {/* --- Deadline picker modal --- */}
      <Modal visible={showPicker} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <TouchableOpacity onPress={() => {
                if (pickMonth === 0) { setPickMonth(11); setPickYear(pickYear - 1); }
                else setPickMonth(pickMonth - 1);
              }}>
                <Text style={styles.navArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.modalMonth}>
                {new Date(pickYear, pickMonth, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}
              </Text>
              <TouchableOpacity onPress={() => {
                if (pickMonth === 11) { setPickMonth(0); setPickYear(pickYear + 1); }
                else setPickMonth(pickMonth + 1);
              }}>
                <Text style={styles.navArrow}>›</Text>
              </TouchableOpacity>
            </View>
            <MonthGrid
              year={pickYear}
              month={pickMonth}
              selected={deadline}
              onSelect={chooseDeadline}
            />
            <View style={styles.modalBtns}>
              <TouchableOpacity onPress={() => { setDeadline(null); setShowPicker(false); }}>
                <Text style={styles.modalBtnGhost}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowPicker(false)}>
                <Text style={styles.modalBtn}>Done</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  addRow: { flexDirection: 'row', marginBottom: 10 },
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

  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  chip: {
    borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 7, backgroundColor: COLORS.panel,
  },
  chipSmall: {
    borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 999,
    paddingHorizontal: 12, paddingVertical: 6, backgroundColor: COLORS.panel,
  },
  chipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  chipText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: COLORS.bg },

  sectionTitle: {
    color: COLORS.muted2, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginTop: 8, marginBottom: 8,
  },
  empty: { color: COLORS.muted, fontSize: 15, textAlign: 'center', marginTop: 50, lineHeight: 22 },

  modalBackdrop: {
    flex: 1, backgroundColor: 'rgba(42,33,24,0.45)',
    justifyContent: 'center', padding: 24,
  },
  modalCard: {
    backgroundColor: COLORS.panel, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: COLORS.line,
  },
  modalHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 10,
  },
  modalMonth: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  navArrow: { color: COLORS.espressoLight, fontSize: 28, paddingHorizontal: 14, marginTop: -4 },
  modalBtns: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 14, paddingHorizontal: 6,
  },
  modalBtn: { color: COLORS.espresso, fontSize: 15, fontWeight: '700' },
  modalBtnGhost: { color: COLORS.muted, fontSize: 15, fontWeight: '600' },
});
