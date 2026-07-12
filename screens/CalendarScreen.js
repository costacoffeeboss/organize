// =====================================================================
//  Calendar tab
//  A month view of everything: Events (espresso dot), Reminders like
//  birthdays (gold dot) and To-dos due that day (soft dot). Tap a day
//  and the bottom list shows those three groups; ＋ adds an event or
//  reminder on the selected day.
//
//  Events and reminders are the one thing Life and Work share. Each
//  belongs to the side it was added on (`owner`) and — unless the
//  "also in the other calendar" toggle was switched off — shows on
//  both sides, always wearing its home side's colours: a Work meeting
//  stays black-and-silver inside cream Life, and vice versa.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Alert,
  PanResponder, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles, paletteFor, SERIF } from '../theme';
import { DEVICE_GREY } from '../utils/deviceCalendar';
import {
  todayKey, monthLabel, shortDate, monthCells, repeatOccursOn,
  reminderOccursOn, eventOccursOn, weekStartKey, addDays, parseKey,
  WEEKDAY_LETTERS,
} from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import MonthGrid from '../components/MonthGrid';
import ModalShell from '../components/ModalShell';
import CalendarPager from '../components/CalendarPager';
import FullPage from '../components/FullPage';
import FAB from '../components/FAB';

const HOURS = Array.from({ length: 24 }, (_, h) => String(h).padStart(2, '0'));
const MINUTES = ['00', '15', '30', '45'];

export default function CalendarScreen({
  mode, todos, toggleTodo, events, deviceEvents, addEvent, deleteEvent, unshareEvent,
  reminders, addReminder, deleteReminder, unshareReminder,
  deviceCalOn, onToggleDeviceCal, deviceCalAll, onToggleDeviceCalAll,
}) {
  const { COLORS, styles } = useThemedStyles(makeStyles);
  const now = new Date();
  const today = todayKey();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth()); // 0-based
  const [selected, setSelected] = useState(today);

  const otherLabel = mode === 'life' ? 'Work' : 'Life';
  const hereLabel = mode === 'life' ? 'Life' : 'Work';

  // --- Expanded, full-screen calendar ---
  const [expanded, setExpanded] = useState(false);
  const [expMode, setExpMode] = useState('month'); // 'month' | 'week'
  const [weekAnchor, setWeekAnchor] = useState(today);

  // Calendar-tab settings (the cog): phone-calendar mirroring.
  const [showPrefs, setShowPrefs] = useState(false);

  // --- Add pop-up state ---
  const [showAdd, setShowAdd] = useState(false);
  const [page, setPage] = useState('form'); // 'form' | 'date'
  const [kind, setKind] = useState('event'); // 'event' | 'reminder'
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(today);
  const [endDate, setEndDate] = useState(null); // multi-day events
  const [timeOn, setTimeOn] = useState(false);
  const [hour, setHour] = useState('09');
  const [minute, setMinute] = useState('00');
  const [yearly, setYearly] = useState(false);
  const [shareAcross, setShareAcross] = useState(true); // both calendars by default

  function openAdd() {
    setPage('form'); setKind('event'); setTitle('');
    setDate(selected); setEndDate(null);
    setTimeOn(false); setHour('09'); setMinute('00');
    setYearly(false); setShareAcross(true); setShowAdd(true);
  }

  function onAdd() {
    const t = title.trim();
    if (!t) return;
    if (kind === 'event') {
      addEvent({
        title: t, date,
        endDate: endDate && endDate > date ? endDate : null,
        time: timeOn ? `${hour}:${minute}` : null,
        shared: shareAcross,
      });
    } else {
      addReminder({ title: t, date, yearly, shared: shareAcross });
    }
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
  // This side sees its own entries plus anything shared from the other.
  const visible = (x) => x.owner === mode || x.shared;

  function todosOn(key) {
    return todos.filter((t) =>
      t.repeat
        ? (t.repeat.type === 'rolling' ? t.nextDue === key : repeatOccursOn(t.repeat, key))
        : t.deadline === key
    );
  }
  function eventsOn(key) {
    return [
      ...events.filter((e) => visible(e) && eventOccursOn(e, key)),
      // the phone's own events, mirrored read-only in neutral grey
      ...deviceEvents.filter((e) => eventOccursOn(e, key)),
    ].sort((a, b) => (a.time || '') < (b.time || '') ? -1 : 1); // all-day first
  }
  function remindersOn(key) {
    return reminders.filter((r) => visible(r) && reminderOccursOn(r, key));
  }

  // Everything on a day, in ribbon order: events, reminders, to-dos.
  function itemsOn(key) {
    return [
      ...eventsOn(key).map((e) => ({ id: `e${e.id}`, kind: 'event', title: e.title, time: e.time, owner: e.owner, device: e.device })),
      ...remindersOn(key).map((r) => ({ id: `r${r.id}`, kind: 'reminder', title: r.title, owner: r.owner })),
      ...todosOn(key).map((t) => ({ id: `t${t.id}`, kind: 'todo', title: t.title, owner: mode })),
    ];
  }

  // --- The other side's colours, for entries that live there ---
  const foreign = (owner) => owner !== mode;
  // Small dots: our entries keep espresso/gold; theirs wear their side's
  // signature surface (black graphite in Life, warm cream in Work).
  const dotFor = (it) => {
    if (it.device) return DEVICE_GREY;
    if (foreign(it.owner)) return paletteFor(it.owner).crema;
    return it.kind === 'event' ? COLORS.espresso
      : it.kind === 'reminder' ? COLORS.gold : COLORS.muted2;
  };
  // Ribbons in the big month view: foreign entries get their home
  // side's surface + accent text so they're unmistakable.
  const foreignRibbon = (owner) => {
    const p = paletteFor(owner);
    return {
      box: { backgroundColor: p.mode === 'work' ? p.panelDeep : p.crema },
      text: { color: p.espresso },
    };
  };

  function pickDayAndClose(key) {
    setSelected(key);
    const d = parseKey(key);
    setYear(d.getFullYear());
    setMonth(d.getMonth());
    setExpanded(false);
  }

  // Swipe up/down on the big month grid to scroll through months,
  // like a real calendar app. (Created per render so it always sees
  // the current month — PanResponder closures go stale otherwise.)
  const monthSwipe = PanResponder.create({
    onMoveShouldSetPanResponder: (_, g) =>
      Math.abs(g.dy) > 14 && Math.abs(g.dy) > Math.abs(g.dx) * 1.4,
    onPanResponderRelease: (_, g) => {
      if (g.dy <= -45) nextMonth();
      else if (g.dy >= 45) prevMonth();
    },
  });

  // Dots for the visible month only (cheap: ~31 days each render).
  const dots = {};
  monthCells(year, month).forEach((cell) => {
    if (!cell) return;
    const d = [];
    const ev = eventsOn(cell.key);
    const rem = remindersOn(cell.key);
    if (ev.some((e) => !e.device && !foreign(e.owner))) d.push(COLORS.espresso);
    if (rem.some((r) => !foreign(r.owner))) d.push(COLORS.gold);
    if ([...ev, ...rem].some((x) => !x.device && foreign(x.owner))) {
      d.push(paletteFor(mode === 'life' ? 'work' : 'life').crema);
    }
    if (ev.some((e) => e.device)) d.push(DEVICE_GREY);
    if (todosOn(cell.key).length) d.push(COLORS.muted2);
    if (d.length) dots[cell.key] = d;
  });

  // The list under the grid: the selected day plus the two after it.
  // Events and reminders only — to-dos live on the grid and their own tab.
  const threeDays = Array.from({ length: 3 }, (_, i) => addDays(selected, i));

  const eventMeta = (e) => {
    if (e.endDate) return `${e.time ? `${e.time} · ` : ''}until ${shortDate(e.endDate)}`;
    return e.time || 'all day';
  };

  function confirmDelete(label, fn) {
    Alert.alert(`Delete ${label}?`, 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: fn },
    ]);
  }

  // Long-press on a shared entry from the other side: the gentle option
  // just removes it from this calendar; deleting everywhere is explicit.
  // Phone events are read-only — point at the phone's calendar app.
  function confirmRemove(label, item, deleteFn, unshareFn) {
    if (item.device) {
      Alert.alert(
        'From your phone',
        "This event lives in your phone's calendar — edit or delete it there.");
      return;
    }
    if (!foreign(item.owner)) {
      confirmDelete(label, () => deleteFn(item.id));
      return;
    }
    const ownerName = item.owner === 'work' ? 'Work' : 'Life';
    Alert.alert(
      `Remove ${label}?`,
      `This ${label} lives in your ${ownerName} calendar and is shared into ${hereLabel}.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: `Remove from ${hereLabel} only`, onPress: () => unshareFn(item.id) },
        { text: 'Delete everywhere', style: 'destructive', onPress: () => deleteFn(item.id) },
      ]
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ScreenHeader title="Calendar" subtitle="Your month at a glance" />
        </View>
        <TouchableOpacity
          style={styles.cog}
          onPress={() => setShowPrefs(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={22} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        <View style={styles.card}>
          <View style={styles.monthHead}>
            <TouchableOpacity onPress={prevMonth} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.navArrow}>‹</Text>
            </TouchableOpacity>
            {/* tap the title to open the big calendar */}
            <TouchableOpacity
              onPress={() => { setWeekAnchor(selected); setExpanded(true); }}
              hitSlop={{ top: 8, bottom: 8, left: 20, right: 20 }}
              style={styles.monthTitleBtn}
            >
              <Text style={styles.monthTitle}>{monthLabel(year, month)}</Text>
              <Text style={styles.expandGlyph}>⤢</Text>
            </TouchableOpacity>
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

        {/* --- The next three days, starting from the selected one --- */}
        {threeDays.map((day) => {
          const evs = eventsOn(day);
          const rems = remindersOn(day);
          return (
            <View key={day}>
              <Text style={styles.dayTitle}>
                {day === today ? `Today · ${shortDate(day)}` : shortDate(day)}
              </Text>

              {evs.length === 0 && rems.length === 0 && (
                <Text style={styles.empty}>Nothing on.</Text>
              )}

              {evs.map((e) => (
                <TouchableOpacity
                  key={e.id}
                  style={styles.itemRow}
                  onLongPress={() => confirmRemove('event', e, deleteEvent, unshareEvent)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.itemDot, { backgroundColor: dotFor({ kind: 'event', owner: e.owner, device: e.device }) }]} />
                  <Text style={styles.itemTitle} numberOfLines={2}>{e.title}</Text>
                  {e.device ? (
                    <Text style={styles.ownerTag}>Phone</Text>
                  ) : foreign(e.owner) && (
                    <Text style={styles.ownerTag}>{e.owner === 'work' ? 'Work' : 'Life'}</Text>
                  )}
                  <Text style={styles.itemMeta}>{eventMeta(e)}</Text>
                </TouchableOpacity>
              ))}

              {rems.map((r) => (
                <TouchableOpacity
                  key={r.id}
                  style={styles.itemRow}
                  onLongPress={() => confirmRemove('reminder', r, deleteReminder, unshareReminder)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.itemDot, { backgroundColor: dotFor({ kind: 'reminder', owner: r.owner }) }]} />
                  <Text style={styles.itemTitle} numberOfLines={2}>{r.title}</Text>
                  {foreign(r.owner) && (
                    <Text style={styles.ownerTag}>{r.owner === 'work' ? 'Work' : 'Life'}</Text>
                  )}
                  {r.yearly && <Text style={styles.itemMeta}>yearly</Text>}
                </TouchableOpacity>
              ))}
            </View>
          );
        })}
      </ScrollView>

      <FAB onPress={openAdd} />

      {/* ================= Add pop-up ================= */}
      <ModalShell
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        title={page === 'date' ? 'Date' : page === 'end' ? 'Ends' : kind === 'event' ? 'New event' : 'New reminder'}
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
              <Text style={styles.fieldLabel}>{kind === 'event' ? 'Starts' : 'Date'}</Text>
              <Text style={styles.fieldValue}>{shortDate(date)} ›</Text>
            </TouchableOpacity>

            {/* Event: optional end date for multi-day events */}
            {kind === 'event' && (
              <TouchableOpacity style={styles.fieldRow} onPress={() => setPage('end')}>
                <Text style={styles.fieldLabel}>Ends</Text>
                <Text style={styles.fieldValue}>
                  {endDate && endDate > date ? `${shortDate(endDate)} ›` : 'Same day ›'}
                </Text>
              </TouchableOpacity>
            )}

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

            {/* Shared into the other side's calendar (on by default) */}
            <TouchableOpacity style={styles.fieldRow} onPress={() => setShareAcross(!shareAcross)}>
              <Text style={styles.fieldLabel}>Also in <Text style={styles.fieldItalic}>{otherLabel}</Text> calendar</Text>
              <View style={[styles.toggle, shareAcross && styles.toggleOn]}>
                <View style={[styles.knob, shareAcross && styles.knobOn]} />
              </View>
            </TouchableOpacity>

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
              onSelect={(k) => {
                setDate(k);
                if (endDate && endDate <= k) setEndDate(null); // keep span valid
                setPage('form');
              }}
            />
            <View style={styles.pickerBtns}>
              <View />
              <TouchableOpacity onPress={() => setPage('form')}>
                <Text style={styles.linkBtn}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {page === 'end' && (
          <View>
            <CalendarPager
              initialKey={endDate || date}
              selected={endDate}
              onSelect={(k) => {
                setEndDate(k > date ? k : null); // same/earlier day = single-day
                setPage('form');
              }}
            />
            <View style={styles.pickerBtns}>
              <TouchableOpacity onPress={() => { setEndDate(null); setPage('form'); }}>
                <Text style={styles.ghostBtn}>Same day</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setPage('form')}>
                <Text style={styles.linkBtn}>Back</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ModalShell>

      {/* ================= Calendar settings (the cog) ================= */}
      <ModalShell
        visible={showPrefs}
        onClose={() => setShowPrefs(false)}
        title="Calendar settings"
      >
        <View>
          <TouchableOpacity style={styles.prefRow} onPress={onToggleDeviceCal} activeOpacity={0.75}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Show phone calendar</Text>
              <Text style={styles.prefHint}>
                Events you've added in your iPhone's calendars — home, work,
                email accounts — appear here in grey, read-only.
              </Text>
            </View>
            <View style={[styles.toggle, deviceCalOn && styles.toggleOn]}>
              <View style={[styles.knob, deviceCalOn && styles.knobOn]} />
            </View>
          </TouchableOpacity>

          {deviceCalOn && (
            <TouchableOpacity style={styles.prefRow} onPress={onToggleDeviceCalAll} activeOpacity={0.75}>
              <View style={{ flex: 1 }}>
                <Text style={styles.prefTitle}>Include preloaded calendars</Text>
                <Text style={styles.prefHint}>
                  Also show holidays, birthdays and other feeds you didn't create.
                </Text>
              </View>
              <View style={[styles.toggle, deviceCalAll && styles.toggleOn]}>
                <View style={[styles.knob, deviceCalAll && styles.knobOn]} />
              </View>
            </TouchableOpacity>
          )}
        </View>
      </ModalShell>

      {/* ================= Expanded calendar ================= */}
      <Modal visible={expanded} animationType="slide" onRequestClose={() => setExpanded(false)}>
        <FullPage>
          {/* header: close · title · mode switch */}
          <View style={styles.expHead}>
            <TouchableOpacity
              onPress={() => setExpanded(false)}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <Text style={styles.expClose}>✕</Text>
            </TouchableOpacity>
            <View style={styles.expNav}>
              <TouchableOpacity
                onPress={() => expMode === 'month' ? prevMonth() : setWeekAnchor(addDays(weekAnchor, -7))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.navArrow}>‹</Text>
              </TouchableOpacity>
              <Text style={styles.expTitle}>
                {expMode === 'month'
                  ? monthLabel(year, month)
                  : `Week of ${shortDate(weekStartKey(weekAnchor))}`}
              </Text>
              <TouchableOpacity
                onPress={() => expMode === 'month' ? nextMonth() : setWeekAnchor(addDays(weekAnchor, 7))}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={styles.navArrow}>›</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.expSegment}>
              {[['month', 'M'], ['week', 'W']].map(([id, label]) => (
                <TouchableOpacity
                  key={id}
                  style={[styles.expSegBtn, expMode === id && styles.expSegOn]}
                  onPress={() => setExpMode(id)}
                >
                  <Text style={[styles.expSegText, expMode === id && styles.expSegTextOn]}>
                    {label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {expMode === 'month' ? (
            <View style={styles.bigGrid} {...monthSwipe.panHandlers}>
              {/* weekday letters */}
              <View style={styles.bigWeekHead}>
                {WEEKDAY_LETTERS.map((w, i) => (
                  <Text key={i} style={styles.bigWeekday}>{w}</Text>
                ))}
              </View>
              {/* the month, one flex row per week — each day carries
                  its ribbons underneath the number, calendar-app style */}
              {(() => {
                const cells = monthCells(year, month);
                const weeks = [];
                for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
                return weeks.map((week, wi) => (
                  <View key={wi} style={styles.bigRow}>
                    {week.map((cell, ci) => {
                      if (!cell) return <View key={ci} style={styles.bigCell} />;
                      const items = itemsOn(cell.key);
                      const isToday = cell.key === today;
                      return (
                        <TouchableOpacity
                          key={ci}
                          style={[styles.bigCell, cell.key === selected && styles.bigCellSel]}
                          onPress={() => pickDayAndClose(cell.key)}
                          activeOpacity={0.7}
                        >
                          <Text style={[styles.bigDayNum, isToday && styles.bigDayToday]}>
                            {cell.day}
                          </Text>
                          {items.slice(0, 3).map((it) => {
                            const away = !it.device && it.kind !== 'todo' && foreign(it.owner);
                            const f = away ? foreignRibbon(it.owner) : null;
                            return (
                              <View key={it.id} style={[
                                styles.ribbon,
                                it.kind === 'event' && styles.ribbonEvent,
                                it.kind === 'reminder' && styles.ribbonReminder,
                                it.kind === 'todo' && styles.ribbonTodo,
                                away && f.box,
                                it.device && styles.ribbonDevice,
                              ]}>
                                <Text
                                  style={[
                                    styles.ribbonText,
                                    it.kind === 'todo' && styles.ribbonTextTodo,
                                    away && f.text,
                                    it.device && styles.ribbonTextDevice,
                                  ]}
                                  numberOfLines={1}
                                >
                                  {it.title}
                                </Text>
                              </View>
                            );
                          })}
                          {items.length > 3 && (
                            <Text style={styles.moreText}>+{items.length - 3}</Text>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                ));
              })()}
            </View>
          ) : (
            <ScrollView
              style={{ flex: 1 }}
              showsVerticalScrollIndicator={false}
              alwaysBounceVertical
              // Pull past the top/bottom to scroll through the weeks.
              onScrollEndDrag={(e) => {
                const { contentOffset, contentSize, layoutMeasurement } = e.nativeEvent;
                const maxOffset = Math.max(0, contentSize.height - layoutMeasurement.height);
                if (contentOffset.y < -55) setWeekAnchor(addDays(weekAnchor, -7));
                else if (contentOffset.y > maxOffset + 55) setWeekAnchor(addDays(weekAnchor, 7));
              }}
            >
              {Array.from({ length: 7 }, (_, i) => addDays(weekStartKey(weekAnchor), i)).map((k) => {
                const items = itemsOn(k);
                const isToday = k === today;
                return (
                  <TouchableOpacity
                    key={k}
                    style={[styles.wkRow, isToday && styles.wkRowToday]}
                    onPress={() => pickDayAndClose(k)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.wkDayCol}>
                      <Text style={[styles.wkDayName, isToday && styles.wkTodayText]}>
                        {shortDate(k).split(' ')[0]}
                      </Text>
                      <Text style={[styles.wkDayNum, isToday && styles.wkTodayText]}>
                        {parseKey(k).getDate()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      {items.length === 0 && <Text style={styles.wkEmpty}>—</Text>}
                      {items.map((it) => (
                        <View key={it.id} style={styles.wkItem}>
                          <View style={[styles.itemDot, { backgroundColor: dotFor(it) }]} />
                          <Text style={styles.wkItemText} numberOfLines={1}>{it.title}</Text>
                          {it.device ? (
                            <Text style={styles.ownerTag}>Phone</Text>
                          ) : it.kind !== 'todo' && foreign(it.owner) && (
                            <Text style={styles.ownerTag}>{it.owner === 'work' ? 'Work' : 'Life'}</Text>
                          )}
                          {it.time && <Text style={styles.wkTime}>{it.time}</Text>}
                        </View>
                      ))}
                    </View>
                  </TouchableOpacity>
                );
              })}
              <Text style={styles.wkHint}>Tap a day to jump back to it · pull up or down for other weeks.</Text>
            </ScrollView>
          )}
        </FullPage>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) => {
  // themed rgba tints (espresso-brown in Life, silver in Work)
  const tint = COLORS.mode === 'work' ? '201,205,214' : '75,54,38';
  return StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cog: { paddingTop: 18, paddingLeft: 10 },
  prefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 10,
  },
  prefTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
  prefHint: { color: COLORS.muted2, fontSize: 12, marginTop: 2, lineHeight: 16 },
  card: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 16, padding: 14, marginBottom: 16,
  },
  monthHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  monthTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  monthTitleBtn: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  expandGlyph: { color: COLORS.muted2, fontSize: 13, marginTop: 1 },
  navArrow: { color: COLORS.espressoLight, fontSize: 28, paddingHorizontal: 10, marginTop: -4 },

  // --- expanded calendar ---
  expSafe: { flex: 1, backgroundColor: COLORS.bg },
  expHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 16, paddingTop: 8, paddingBottom: 10,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  expClose: { color: COLORS.muted, fontSize: 17, fontWeight: '600', padding: 4 },
  expNav: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  expTitle: {
    color: COLORS.ink, fontSize: 16.5, fontWeight: '600', fontFamily: SERIF,
    minWidth: 150, textAlign: 'center',
  },
  expSegment: {
    flexDirection: 'row', backgroundColor: COLORS.panelDeep,
    borderRadius: 10, padding: 3, borderWidth: 1, borderColor: COLORS.line,
  },
  expSegBtn: { paddingVertical: 5, paddingHorizontal: 11, borderRadius: 7 },
  expSegOn: { backgroundColor: COLORS.espresso },
  expSegText: { color: COLORS.muted, fontSize: 13, fontWeight: '700' },
  expSegTextOn: { color: COLORS.bg },

  bigGrid: { flex: 1, paddingHorizontal: 4, paddingBottom: 6 },
  bigWeekHead: { flexDirection: 'row', paddingVertical: 7 },
  bigWeekday: {
    flex: 1, textAlign: 'center', color: COLORS.muted2,
    fontSize: 11, fontWeight: '600', letterSpacing: 1,
  },
  bigRow: { flex: 1, flexDirection: 'row' },
  bigCell: {
    flex: 1, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.lineStrong,
    paddingTop: 4, paddingHorizontal: 2, overflow: 'hidden',
  },
  bigCellSel: { backgroundColor: `rgba(${tint},0.07)`, borderRadius: 8 },
  bigDayNum: {
    color: COLORS.ink, fontSize: 12.5, fontWeight: '600',
    textAlign: 'center', marginBottom: 3,
  },
  bigDayToday: { color: COLORS.espresso, fontWeight: '800' },
  ribbon: { borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2, marginBottom: 2 },
  ribbonEvent: { backgroundColor: COLORS.espresso },
  ribbonReminder: { backgroundColor: COLORS.gold },
  ribbonTodo: { backgroundColor: `rgba(${tint},0.08)`, borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.lineStrong },
  ribbonText: { color: COLORS.bg, fontSize: 8.5, fontWeight: '700' },
  ribbonTextTodo: { color: COLORS.muted },
  ribbonDevice: { backgroundColor: 'rgba(152,152,158,0.28)' },
  ribbonTextDevice: { color: COLORS.mode === 'work' ? '#c9cbd2' : '#5a5a60' },
  moreText: { color: COLORS.muted2, fontSize: 9, fontWeight: '700', textAlign: 'center' },

  wkRow: {
    flexDirection: 'row', gap: 14,
    paddingVertical: 14, paddingHorizontal: 18,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  wkRowToday: { backgroundColor: `rgba(${tint},0.05)` },
  wkDayCol: { width: 46, alignItems: 'center' },
  wkDayName: { color: COLORS.muted2, fontSize: 11.5, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.8 },
  wkDayNum: { color: COLORS.ink, fontSize: 21, fontWeight: '600', fontFamily: SERIF, marginTop: 1 },
  wkTodayText: { color: COLORS.espresso },
  wkItem: { flexDirection: 'row', alignItems: 'center', paddingVertical: 3.5 },
  wkItemText: { color: COLORS.ink, fontSize: 14.5, flex: 1 },
  wkTime: { color: COLORS.espressoLight, fontSize: 12.5, fontWeight: '600', marginLeft: 8 },
  wkEmpty: { color: COLORS.muted2, fontSize: 14, marginTop: 8 },
  wkHint: { color: COLORS.muted2, fontSize: 12.5, textAlign: 'center', paddingVertical: 18 },

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
  ownerTag: {
    color: COLORS.muted2, fontSize: 11.5, fontWeight: '600',
    fontStyle: 'italic', fontFamily: SERIF, marginLeft: 8,
  },

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
  fieldItalic: { fontStyle: 'italic', color: COLORS.espressoLight },
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
    backgroundColor: `rgba(${tint},0.15)`,
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
  ghostBtn: { color: COLORS.muted, fontSize: 15, fontWeight: '600' },
  });
};
