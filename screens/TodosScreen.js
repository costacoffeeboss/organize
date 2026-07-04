// =====================================================================
//  To-dos tab
//  A clean list with a floating ＋. The pop-up takes a title plus two
//  optional details:
//    Repeat   — daily · weekly on chosen weekdays · every 2/4 weeks
//               from a start date · monthly on a day of the month
//    Deadline — a single date (repeating tasks don't have one)
//
//  Sections: Overdue (missed deadlines) → Today → Upcoming.
//  Completed one-offs stay ticked for the rest of the day — small win,
//  small reward — then tidy themselves away overnight.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, SectionList, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../theme';
import {
  todayKey, shortDate, niceDate, repeatLabel, WEEKDAY_LETTERS,
} from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import TodoRow from '../components/TodoRow';
import ModalShell from '../components/ModalShell';
import CalendarPager from '../components/CalendarPager';
import FAB from '../components/FAB';

// The repeat "modes" shown as chips in the pop-up.
const REPEAT_MODES = [
  { id: 'off', label: 'Off' },
  { id: 'daily', label: 'Daily' },
  { id: 'weekly', label: 'Weekly' },
  { id: 'biweekly', label: '2 weeks' },
  { id: 'fourweekly', label: '4 weeks' },
  { id: 'monthly', label: 'Monthly' },
];

export default function TodosScreen({ todos, addTodo, toggleTodo, deleteTodo }) {
  const today = todayKey();

  // --- Pop-up state ---
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState('form'); // 'form' | 'deadline' | 'start'
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('off');
  const [weekdays, setWeekdays] = useState([]);   // [0..6] Mon-first
  const [startKey, setStartKey] = useState(today); // interval repeats
  const [monthDay, setMonthDay] = useState(new Date().getDate());
  const [deadline, setDeadline] = useState(null);

  function resetForm() {
    setPage('form'); setTitle(''); setMode('off');
    setWeekdays([]); setStartKey(todayKey());
    setMonthDay(new Date().getDate()); setDeadline(null);
  }
  function openAdd() { resetForm(); setShowAdd(true); }

  function chooseMode(id) {
    setMode(id);
    if (id !== 'off') setDeadline(null); // repeating tasks have no deadline
  }

  function toggleWeekday(i) {
    setWeekdays((prev) =>
      prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i].sort()
    );
  }

  // Turn the pop-up's state into the repeat object the app stores.
  function buildRepeat() {
    if (mode === 'daily') return { type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] };
    if (mode === 'weekly') return weekdays.length ? { type: 'weekly', days: weekdays } : null;
    if (mode === 'biweekly') return { type: 'interval', every: 14, start: startKey };
    if (mode === 'fourweekly') return { type: 'interval', every: 28, start: startKey };
    if (mode === 'monthly') return { type: 'monthly', day: monthDay };
    return null;
  }

  function onAdd() {
    const t = title.trim();
    if (!t) return;
    if (mode === 'weekly' && weekdays.length === 0) {
      Alert.alert('Pick a day', 'Choose at least one weekday for a weekly repeat.');
      return;
    }
    addTodo({ title: t, deadline: mode === 'off' ? deadline : null, repeat: buildRepeat() });
    setShowAdd(false);
  }

  // --- Sort every to-do into a section ---
  const overdue = [], todayList = [], upcoming = [];
  todos.forEach((t) => {
    if (t.repeat) {
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
    if (t.repeat) {
      const label = repeatLabel(t.repeat);
      return section === 'Upcoming' ? `${shortDate(t.nextDue)} · ${label}` : label;
    }
    if (t.deadline) return shortDate(t.deadline);
    return null;
  }

  function onLongPress(t) {
    Alert.alert('Delete to-do?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteTodo(t.id) },
    ]);
  }

  const isDone = (t) => (t.repeat ? t.completedOn === today : t.done);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Organize" subtitle={niceDate()} />

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
        contentContainerStyle={{ paddingBottom: 110 }}
        ListEmptyComponent={
          <Text style={styles.empty}>
            Nothing here yet. Tap ＋ to add your first to-do —{'\n'}everything in its place.
          </Text>
        }
      />

      <FAB onPress={openAdd} />

      {/* ================= Add pop-up ================= */}
      <ModalShell
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title={page === 'form' ? 'New to-do'
          : page === 'deadline' ? 'Deadline' : 'Starts on'}
      >
        {page === 'form' && (
          <View>
            <TextInput
              style={styles.input}
              placeholder="What needs doing?"
              placeholderTextColor={COLORS.muted2}
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="done"
            />

            {/* Repeat */}
            <Text style={styles.label}>Repeat</Text>
            <View style={styles.chips}>
              {REPEAT_MODES.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.chip, mode === m.id && styles.chipOn]}
                  onPress={() => chooseMode(m.id)}
                >
                  <Text style={[styles.chipText, mode === m.id && styles.chipTextOn]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Weekly → weekday chips */}
            {mode === 'weekly' && (
              <View style={styles.chips}>
                {WEEKDAY_LETTERS.map((w, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.dayChip, weekdays.includes(i) && styles.chipOn]}
                    onPress={() => toggleWeekday(i)}
                  >
                    <Text style={[styles.chipText, weekdays.includes(i) && styles.chipTextOn]}>
                      {w}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Every 2/4 weeks → start date */}
            {(mode === 'biweekly' || mode === 'fourweekly') && (
              <TouchableOpacity style={styles.fieldRow} onPress={() => setPage('start')}>
                <Text style={styles.fieldLabel}>Starts</Text>
                <Text style={styles.fieldValue}>{shortDate(startKey)} ›</Text>
              </TouchableOpacity>
            )}

            {/* Monthly → day-of-month grid */}
            {mode === 'monthly' && (
              <View style={styles.monthDays}>
                {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                  <TouchableOpacity
                    key={d}
                    style={[styles.dayCell, monthDay === d && styles.chipOn]}
                    onPress={() => setMonthDay(d)}
                  >
                    <Text style={[styles.chipText, monthDay === d && styles.chipTextOn]}>
                      {d}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Deadline (one-off tasks only) */}
            {mode === 'off' && (
              <TouchableOpacity style={styles.fieldRow} onPress={() => setPage('deadline')}>
                <Text style={styles.fieldLabel}>Deadline</Text>
                <Text style={styles.fieldValue}>
                  {deadline ? `${shortDate(deadline)} ›` : 'None ›'}
                </Text>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, !title.trim() && { opacity: 0.4 }]}
              onPress={onAdd}
              disabled={!title.trim()}
            >
              <Text style={styles.primaryBtnText}>Add to-do</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* --- date pages swap in place of the form --- */}
        {page === 'deadline' && (
          <View>
            <CalendarPager
              initialKey={deadline || today}
              selected={deadline}
              onSelect={(k) => { setDeadline(k); setPage('form'); }}
            />
            <View style={styles.pickerBtns}>
              <TouchableOpacity onPress={() => { setDeadline(null); setPage('form'); }}>
                <Text style={styles.ghostBtn}>Clear</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPage('form')}>
                <Text style={styles.linkBtn}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {page === 'start' && (
          <View>
            <CalendarPager
              initialKey={startKey}
              selected={startKey}
              onSelect={(k) => { setStartKey(k); setPage('form'); }}
            />
            <View style={styles.pickerBtns}>
              <View />
              <TouchableOpacity onPress={() => setPage('form')}>
                <Text style={styles.linkBtn}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ModalShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  sectionTitle: {
    color: COLORS.muted2, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginTop: 8, marginBottom: 8,
  },
  empty: { color: COLORS.muted, fontSize: 15, textAlign: 'center', marginTop: 50, lineHeight: 22 },

  // --- pop-up form ---
  input: {
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: COLORS.ink, fontSize: 16, marginBottom: 16,
  },
  label: {
    color: COLORS.muted2, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  chip: {
    borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 7, backgroundColor: COLORS.panel,
  },
  dayChip: {
    width: 38, height: 38, borderRadius: 19, borderWidth: 1,
    borderColor: COLORS.lineStrong, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center',
  },
  chipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  chipText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: COLORS.bg },

  monthDays: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  dayCell: {
    width: 40, height: 34, borderRadius: 10, borderWidth: 1,
    borderColor: COLORS.line, backgroundColor: COLORS.panel,
    alignItems: 'center', justifyContent: 'center',
  },

  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 14,
  },
  fieldLabel: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
  fieldValue: { color: COLORS.espressoLight, fontSize: 14, fontWeight: '600' },

  primaryBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 4,
  },
  primaryBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: '700' },

  pickerBtns: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingHorizontal: 4,
  },
  linkBtn: { color: COLORS.espresso, fontSize: 15, fontWeight: '700' },
  ghostBtn: { color: COLORS.muted, fontSize: 15, fontWeight: '600' },
});
