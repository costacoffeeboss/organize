// =====================================================================
//  Calendar tab
//  A month view of everything: Events (espresso dot), Reminders like
//  birthdays (gold dot) and To-dos due that day (soft dot). Tap a day
//  and the bottom list shows those three groups; ＋ adds an event or
//  reminder on the selected day.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import {
  todayKey, monthLabel, shortDate, monthCells, repeatOccursOn,
  reminderOccursOn,
} from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import TodoRow from '../components/TodoRow';
import MonthGrid from '../components/MonthGrid';
import ModalShell from '../components/ModalShell';
import CalendarPager from '../components/CalendarPager';
import FAB from '../components/FAB';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

export default function CalendarScreen({
  todos, toggleTodo, events, addEvent, deleteEvent,
  reminders, addReminder, deleteReminder,
}) {
  const now = new Date();
  const today = todayKey();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [selected, setSelected] = useState(today);

  // --- Add pop-up state ---
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState('form'); // 'form' | 'date'
  const [kind, setKind] = useState('event'); // 'event' | 'reminder'
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [timeOn, setTimeOn] = useState(false);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [yearly, setYearly] = useState(false);

  function openAdd() {
    setPage('form'); setKind('event'); setTitle('');
    setDate(selected); setTimeOn(false); setHour('09'); setMinute('00');
    setYearly(false); setShowAdd(true);
  }

  function onAdd() {
    const t = title.trim();
    if (!t) return;
    if (kind === 'event') addEvent({ title: t, date, time: timeOn ? `${hour}:${minute}` : null });
    else addReminder({ title: t, date, yearly });
    setShowAdd(false);
    setSelected(date);
  }

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(year - 1); }
    else setMonth(month - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(year + 1); }
    else setMonth(month + 1);
  }

  // --- What's happening on a given day? ---
  function todosOn(key) {
    return todos.filter((t) =>
      t.repeat ? repeatOccursOn(t.repeat, key) : t.deadline === key
    );
  }
  function eventsOn(key) {
    return events
      .filter((e) => e.date === key)
      .sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1); // all-day first
  }
  function remindersOn(key) {
    return reminders.filter((r) => reminderOccursOn(r, key));
  }

  // Dots for the visible month only (cheap: ~31 days each render).
  const dots = {};
  monthCells(year, month).forEach((cell) => {
    if (!cell) return;
    const d = [];
    if (eventsOn(cell.key).length) d.push(COLORS.espresso);
    if (remindersOn(cell.key).length) d.push(COLORS.gold);
    if (todosOn(cell.key).length) d.push(COLORS.muted2);
    if (d.length) dots[cell.key] = d;
  });

  const dayEvents = eventsOn(selected);
  const dayReminders = remindersOn(selected);
  const dayTodos = todosOn(selected);
  const nothing = !dayEvents.length && !dayReminders.length && !dayTodos.length;
  const overdue = selected < today;

  function confirmDelete(label, fn) {
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: fn },
    ]);
  }

  const isTodoDone = (t) => (t.repeat ? t.completedOn === selected : t.done);

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Calendar" subtitle="Your month at a glance" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
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
            dots={dots}
          />
        </View>

        <Text style={styles.dayTitle}>{shortDate(selected)}</Text>

        {nothing && <Text style={styles.empty}>Nothing on this day.</Text>}

        {/* --- Events --- */}
        {dayEvents.length > 0 && (
          <View>
            <Text style={styles.groupTitle}>Events</Text>
            {dayEvents.map((e) => (
              <TouchableOpacity
                key={e.id}
                style={styles.itemRow}
                onLongPress={() => confirmDelete('event', () => deleteEvent(e.id))}
                activeOpacity={0.8}
              >
                <View style={[styles.itemDot, { backgroundColor: COLORS.espresso }]} />
                <Text style={styles.itemTitle} numberOfLines={2}>{e.title}</Text>
                <Text style={styles.itemMeta}>{e.time || 'all day'}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* --- Reminders --- */}
        {dayReminders.length > 0 && (
          <View>
            <Text style={styles.groupTitle}>Reminders</Text>
            {dayReminders.map((r) => (
              <TouchableOpacity
                key={r.id}
                style={styles.itemRow}
                onLongPress={() => confirmDelete('reminder', () => deleteReminder(r.id))}
                activeOpacity={0.8}
              >
                <View style={[styles.itemDot, { backgroundColor: COLORS.gold }]} />
                <Text style={styles.itemTitle} numberOfLines={2}>{r.title}</Text>
                {r.yearly && <Text style={styles.itemMeta}>yearly</Text>}
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* --- To-dos --- */}
        {dayTodos.length > 0 && (
          <View>
            <Text style={styles.groupTitle}>To-dos</Text>
            {dayTodos.map((t) => (
              <TodoRow
                key={t.id}
                title={t.title}
                done={isTodoDone(t)}
                meta={
                  isTodoDone(t) ? 'done'
                    : !t.repeat && overdue ? 'overdue'
                    : t.repeat && selected !== today ? 'repeats' : null
                }
                metaColor={!isTodoDone(t) && !t.repeat && overdue ? COLORS.danger : undefined}
                // Recurring tasks can only be ticked on the day itself.
                onToggle={() => {
                  if (t.repeat && selected !== today) return;
                  toggleTodo(t.id);
                }}
              />
            ))}
          </View>
        )}
      </ScrollView>

      <FAB onPress={openAdd} />

      {/* ================= Add pop-up ================= */}
      <ModalShell
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title={page === 'date' ? 'Date' : kind === 'event' ? 'New event' : 'New reminder'}
      >
        {page === 'form' && (
          <View>
            {/* Event | Reminder switch */}
            <View style={styles.segment}>
              {['event', 'reminder'].map((k) => (
                <TouchableOpacity
                  key={k}
                  style={[styles.segmentBtn, kind === k && styles.segmentOn]}
                  onPress={() => setKind(k)}
                >
                  <Text style={[styles.segmentText, kind === k && styles.segmentTextOn]}>
                    {k === 'event' ? 'Event' : 'Reminder'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput
              style={styles.input}
              placeholder={kind === 'event' ? 'Dinner with Sam…' : "Mum's birthday…"}
              placeholderTextColor={COLORS.muted2}
              value={title}
              onChangeText={setTitle}
              autoFocus
              returnKeyType="done"
            />

            <TouchableOpacity style={styles.fieldRow} onPress={() => setPage('date')}>
              <Text style={styles.fieldLabel}>Date</Text>
              <Text style={styles.fieldValue}>{shortDate(date)} ›</Text>
            </TouchableOpacity>

            {/* Event: optional time */}
            {kind === 'event' && (
              <View>
                <TouchableOpacity style={styles.fieldRow} onPress={() => setTimeOn(!timeOn)}>
                  <Text style={styles.fieldLabel}>Time</Text>
                  <Text style={styles.fieldValue}>
                    {timeOn ? `${hour}:${minute}` : 'All day'}
                  </Text>
                </TouchableOpacity>
                {timeOn && (
                  <View>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.timeRow}>
                      {HOURS.map((h) => (
                        <TouchableOpacity
                          key={h}
                          style={[styles.timeChip, hour === h && styles.chipOn]}
                          onPress={() => setHour(h)}
                        >
                          <Text style={[styles.chipText, hour === h && styles.chipTextOn]}>{h}</Text>
                        </TouchableOpacity>
                      ))}
                    </ScrollView>
                    <View style={styles.minuteRow}>
                      {MINUTES.map((m) => (
                        <TouchableOpacity
                          key={m}
                          style={[styles.timeChip, minute === m && styles.chipOn]}
                          onPress={() => setMinute(m)}
                        >
                          <Text style={[styles.chipText, minute === m && styles.chipTextOn]}>:{m}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </View>
            )}

            {/* Reminder: yearly toggle */}
            {kind === 'reminder' && (
              <TouchableOpacity style={styles.fieldRow} onPress={() => setYearly(!yearly)}>
                <Text style={styles.fieldLabel}>Repeat every year</Text>
                <View style={[styles.toggle, yearly && styles.toggleOn]}>
                  <View style={[styles.knob, yearly && styles.knobOn]} />
                </View>
              </TouchableOpacity>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, !title.trim() && { opacity: 0.4 }]}
              onPress={onAdd}
              disabled={!title.trim()}
            >
              <Text style={styles.primaryBtnText}>
                {kind === 'event' ? 'Add event' : 'Add reminder'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {page === 'date' && (
          <View>
            <CalendarPager
              initialKey={date}
              selected={date}
              onSelect={(k) => { setDate(k); setPage('form'); }}
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
    color: COLORS.ink, fontSize: 17, fontWeight: '600',
    fontFamily: SERIF, marginBottom: 10,
  },
  groupTitle: {
    color: COLORS.muted2, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase',
    marginTop: 6, marginBottom: 8,
  },
  empty: { color: COLORS.muted, fontSize: 14.5, marginTop: 6 },

  itemRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingVertical: 15, paddingHorizontal: 16, marginBottom: 10,
  },
  itemDot: { width: 9, height: 9, borderRadius: 5, marginRight: 13 },
  itemTitle: { color: COLORS.ink, fontSize: 16, flex: 1 },
  itemMeta: { color: COLORS.espressoLight, fontSize: 12.5, fontWeight: '600', marginLeft: 10 },

  // --- pop-up ---
  segment: {
    flexDirection: 'row', backgroundColor: COLORS.panelDeep,
    borderRadius: 12, padding: 4, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentOn: { backgroundColor: COLORS.espresso },
  segmentText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: COLORS.bg },

  input: {
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12,
    color: COLORS.ink, fontSize: 16, marginBottom: 14,
  },
  fieldRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 16, paddingVertical: 13, marginBottom: 12,
  },
  fieldLabel: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
  fieldValue: { color: COLORS.espressoLight, fontSize: 14, fontWeight: '600' },

  timeRow: { marginBottom: 8 },
  minuteRow: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  timeChip: {
    borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 999,
    paddingHorizontal: 13, paddingVertical: 7, backgroundColor: COLORS.panel,
    marginRight: 8,
  },
  chipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  chipText: { color: COLORS.muted, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: COLORS.bg },

  toggle: {
    width: 46, height: 28, borderRadius: 14, padding: 3,
    backgroundColor: 'rgba(59,44,30,0.15)',
  },
  toggleOn: { backgroundColor: COLORS.espresso },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.panel },
  knobOn: { marginLeft: 18 },

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
});
