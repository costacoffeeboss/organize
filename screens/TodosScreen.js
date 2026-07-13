// =====================================================================
//  To-dos tab
//  Three groups, calmest first:
//    Today    — things with a deadline that lands today (overdue ones
//               sit above in red so they can't hide)
//    To-do    — the open list: anytime tasks + repeatable tasks that
//               are currently due. Ticking a repeatable puts it away
//               until it comes around again. (Expandable)
//    Upcoming — the next three dated things, collapsed by default.
//
//  The floating ＋ opens the add pop-up: title, repeat (daily · weekly
//  on chosen weekdays · once a week on any day · every 2/4 weeks ·
//  monthly on a day) or deadline.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useThemedStyles } from '../theme';
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
  { id: 'rollweekly', label: 'Once a week' },
  { id: 'biweekly', label: '2 weeks' },
  { id: 'fourweekly', label: '4 weeks' },
  { id: 'monthly', label: 'Monthly' },
];

export default function TodosScreen({ todos, addTodo, updateTodo, toggleTodo, deleteTodo }) {
  const { COLORS, styles } = useThemedStyles(makeStyles);
  const today = todayKey();

  // Which groups are open. To-do starts open (it's the working list),
  // Upcoming starts closed (it's a glance, not a burden).
  const [todoOpen, setTodoOpen] = useState(true);
  const [upcomingOpen, setUpcomingOpen] = useState(false);

  // --- Pop-up state (shared by add and hold-to-edit) ---
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId] = useState(null); // null = adding new
  const [page, setPage] = useState('form'); // 'form' | 'deadline' | 'start'
  const [title, setTitle] = useState('');
  const [mode, setMode] = useState('off');
  const [weekdays, setWeekdays] = useState([]);   // [0..6] Mon-first
  const [startKey, setStartKey] = useState(today); // interval repeats
  const [monthDay, setMonthDay] = useState(new Date().getDate());
  const [deadline, setDeadline] = useState(null);

  function resetForm() {
    setPage('form'); setTitle(''); setMode('off'); setEditId(null);
    setWeekdays([]); setStartKey(todayKey());
    setMonthDay(new Date().getDate()); setDeadline(null);
  }
  function openAdd() { resetForm(); setShowAdd(true); }

  // Hold a row → the same form, pre-filled with the to-do's setup.
  function openEdit(t) {
    resetForm();
    setEditId(t.id);
    setTitle(t.title);
    setDeadline(t.repeat ? null : t.deadline);
    const r = t.repeat;
    if (r) {
      if (r.type === 'weekly') {
        if (r.days.length === 7) setMode('daily');
        else { setMode('weekly'); setWeekdays(r.days); }
      } else if (r.type === 'rolling') {
        setMode('rollweekly'); setStartKey(r.start || todayKey());
      } else if (r.type === 'interval') {
        setMode(r.every === 14 ? 'biweekly' : 'fourweekly');
        setStartKey(r.start);
      } else if (r.type === 'monthly') {
        setMode('monthly'); setMonthDay(r.day);
      }
    }
    setShowAdd(true);
  }

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
    if (mode === 'rollweekly') return { type: 'rolling', every: 7, start: startKey };
    if (mode === 'biweekly') return { type: 'interval', every: 14, start: startKey };
    if (mode === 'fourweekly') return { type: 'interval', every: 28, start: startKey };
    if (mode === 'monthly') return { type: 'monthly', day: monthDay };
    return null;
  }

  function onSubmit() {
    const t = title.trim();
    if (!t) return;
    if (mode === 'weekly' && weekdays.length === 0) {
      Alert.alert('Pick a day', 'Choose at least one weekday for a weekly repeat.');
      return;
    }
    const payload = { title: t, deadline: mode === 'off' ? deadline : null, repeat: buildRepeat() };
    if (editId) updateTodo(editId, payload);
    else addTodo(payload);
    setShowAdd(false);
  }

  function confirmDelete(id) {
    Alert.alert('Delete to-do?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { setShowAdd(false); deleteTodo(id); },
      },
    ]);
  }

  // --- Sort every to-do into its group ---
  const overdue = [], todayList = [], todoList = [], upcomingAll = [];
  todos.forEach((t) => {
    if (t.repeat) {
      // Repeatables live in To-do while due; once ticked they hide
      // until they come around again (their next date shows in Upcoming).
      if (t.completedOn !== today && t.nextDue <= today) todoList.push(t);
      else upcomingAll.push(t);
      return;
    }
    if (t.deadline) {
      if (t.done || t.deadline === today) todayList.push(t);      // due (or finished) today
      else if (t.deadline < today) overdue.push(t);
      else upcomingAll.push(t);
      return;
    }
    todoList.push(t); // anytime tasks — ticked ones tidy away overnight
  });
  overdue.sort((a, b) => (a.deadline < b.deadline ? -1 : 1));
  upcomingAll.sort((a, b) =>
    (a.deadline || a.nextDue) < (b.deadline || b.nextDue) ? -1 : 1
  );
  const upcoming = upcomingAll.slice(0, 3); // just the next three

  // --- The small right-hand label on each row ---
  function metaFor(t, group) {
    if (t.repeat) {
      const label = repeatLabel(t.repeat);
      return group === 'upcoming' ? `${shortDate(t.nextDue)} · ${label}` : label;
    }
    if (t.deadline) return shortDate(t.deadline);
    return null;
  }


  const isDone = (t) => (t.repeat ? t.completedOn === today : t.done);

  function renderRows(list, group) {
    return list.map((t) => (
      <TodoRow
        key={t.id}
        title={t.title}
        done={isDone(t)}
        meta={metaFor(t, group)}
        metaColor={group === 'overdue' ? COLORS.danger : undefined}
        onToggle={() => toggleTodo(t.id)}
        onLongPress={() => openEdit(t)}
      />
    ));
  }

  // An expandable group header — a full card-height row so it's easy
  // to hit: title · count pill · chevron.
  function GroupHead({ label, count, open, onPress }) {
    return (
      <TouchableOpacity
        style={[styles.groupHead, open && styles.groupHeadOpen]}
        onPress={onPress}
        activeOpacity={0.75}
        hitSlop={{ top: 4, bottom: 4 }}
      >
        <Text style={styles.groupTitle}>{label}</Text>
        <View style={styles.groupRight}>
          {count > 0 && (
            <View style={styles.groupCountPill}>
              <Text style={styles.groupCount}>{count}</Text>
            </View>
          )}
          <Text style={styles.chevron}>{open ? '▾' : '▸'}</Text>
        </View>
      </TouchableOpacity>
    );
  }

  const empty = todos.length === 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="To-dos" subtitle={niceDate()} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        {empty && (
          <Text style={styles.empty}>
            Nothing here yet. Tap ＋ to add your first to-do —{'\n'}everything in its place.
          </Text>
        )}

        {/* --- Overdue (can't hide) --- */}
        {overdue.length > 0 && (
          <View>
            <Text style={[styles.plainTitle, { color: COLORS.danger }]}>Overdue</Text>
            {renderRows(overdue, 'overdue')}
          </View>
        )}

        {/* --- Today --- */}
        {!empty && (
          <View>
            <Text style={styles.plainTitle}>Today</Text>
            {todayList.length > 0
              ? renderRows(todayList, 'today')
              : <Text style={styles.quiet}>No deadlines today.</Text>}
          </View>
        )}

        {/* --- To-do (expandable) --- */}
        {!empty && (
          <View>
            <GroupHead
              label="To-do"
              count={todoList.length}
              open={todoOpen}
              onPress={() => setTodoOpen(!todoOpen)}
            />
            {todoOpen && (
              todoList.length > 0
                ? renderRows(todoList, 'todo')
                : <Text style={styles.quiet}>All clear.</Text>
            )}
          </View>
        )}

        {/* --- Upcoming (expandable, next three) --- */}
        {!empty && (
          <View>
            <GroupHead
              label="Upcoming"
              count={upcomingAll.length}
              open={upcomingOpen}
              onPress={() => setUpcomingOpen(!upcomingOpen)}
            />
            {upcomingOpen && (
              upcoming.length > 0
                ? renderRows(upcoming, 'upcoming')
                : <Text style={styles.quiet}>Nothing on the horizon.</Text>
            )}
          </View>
        )}
      </ScrollView>

      <FAB onPress={openAdd} />

      {/* ================= Add pop-up ================= */}
      <ModalShell
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title={page === 'form' ? (editId ? 'Edit to-do' : 'New to-do')
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

            {/* Once a week / every 2/4 weeks → start date */}
            {(mode === 'rollweekly' || mode === 'biweekly' || mode === 'fourweekly') && (
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
              onPress={onSubmit}
              disabled={!title.trim()}
            >
              <Text style={styles.primaryBtnText}>{editId ? 'Save changes' : 'Add to-do'}</Text>
            </TouchableOpacity>

            {editId && (
              <TouchableOpacity style={styles.deleteTodoBtn} onPress={() => confirmDelete(editId)}>
                <Text style={styles.deleteTodoText}>Delete to-do</Text>
              </TouchableOpacity>
            )}
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

const makeStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  plainTitle: {
    color: COLORS.muted2, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginTop: 10, marginBottom: 8,
  },
  groupHead: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16,
    marginTop: 8, marginBottom: 10,
  },
  groupHeadOpen: { borderColor: COLORS.lineStrong },
  groupTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '700' },
  groupRight: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  groupCountPill: {
    backgroundColor: 'rgba(75,54,38,0.12)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 3,
  },
  groupCount: { color: COLORS.espressoLight, fontSize: 13, fontWeight: '700' },
  chevron: { color: COLORS.espressoLight, fontSize: 17, fontWeight: '600' },

  quiet: { color: COLORS.muted, fontSize: 13.5, marginBottom: 10 },
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
  deleteTodoBtn: { alignItems: 'center', paddingVertical: 13, marginTop: 2 },
  deleteTodoText: { color: COLORS.danger, fontSize: 14.5, fontWeight: '700' },

  pickerBtns: {
    flexDirection: 'row', justifyContent: 'space-between',
    marginTop: 12, paddingHorizontal: 4,
  },
  linkBtn: { color: COLORS.espresso, fontSize: 15, fontWeight: '700' },
  ghostBtn: { color: COLORS.muted, fontSize: 15, fontWeight: '600' },
});
