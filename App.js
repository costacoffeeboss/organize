// =====================================================================
//  Organize — main app
//  Six tabs: Home · To-dos · Calendar · Habits · Goals · Journal.
//
//  This file is the "brain": it owns all the data (todos, habits,
//  events, reminders, journal), saves it to the phone, and hands the
//  data + actions down to each screen as props. The screens only worry
//  about how things look.
//
//  Two sides, one app:
//    Life — the original coffee-and-cream Organize
//    Work — "Organize Work", black and metallic silver
//  To-dos, habits, goals and journals are kept fully separate per side
//  (stored as { life, work } pairs). Calendar events and reminders are
//  one shared list — each entry knows its `owner` side and whether it's
//  `shared` into the other side's calendar.
//
//  Coming from Python? useState = a variable React watches;
//  useEffect = "run this when X changes"; props = function arguments
//  for components.
// =====================================================================

import React, { useState, useEffect, useRef, useMemo } from 'react';
import { View, Text, Animated, Easing, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
// Material top tabs (parked at the bottom) give us swipe-between-tabs.
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { LIFE, WORK, ThemeContext, SERIF } from './theme';
import {
  todayKey, addDays, parseKey, weekdayIndex,
  nextOccurrence, currentStreak, weekStreak,
} from './utils/dates';
import { ensureCalendarPermission, fetchDeviceEvents } from './utils/deviceCalendar';
import { ensureNotifyPermission, rescheduleMorningDigests } from './utils/notify';
import HomeScreen from './screens/HomeScreen';
import TodosScreen from './screens/TodosScreen';
import CalendarScreen from './screens/CalendarScreen';
import HabitsScreen from './screens/HabitsScreen';
import JournalScreen, { DEFAULT_GUIDED_SECTIONS } from './screens/JournalScreen';
import GoalsScreen from './screens/GoalsScreen';
import WelcomeScreen from './screens/WelcomeScreen';

// Storage keys. (Habits keep the old "atomic" key so nothing is lost.)
// Life data stays on the original keys; Work gets its own set.
const HABITS_KEY = '@atomic_habits_v1';
const TODOS_V1_KEY = '@organize_todos_v1';
const TODOS_KEY = '@organize_todos_v2';
const EVENTS_KEY = '@organize_events_v1';
const REMINDERS_KEY = '@organize_reminders_v1';
const JOURNAL_KEY = '@organize_journal_v1';
const GOALS_KEY = '@organize_goals_v1';
const STEPS_KEY = '@organize_steps_v1'; // journal's "one step at a time" entries
const WELCOME_KEY = '@organize_welcomed_v1';
const NAME_KEY = '@organize_name';
const MODE_KEY = '@organize_mode_v1';
const DEVICE_CAL_KEY = '@organize_device_cal_v1';
const DEVICE_CAL_ALL_KEY = '@organize_device_cal_all_v1';
const GUIDED_ON_KEY = '@organize_journal_guided_v1';
const GUIDED_SECTIONS_KEY = '@organize_journal_sections_v1';
const NOTIFY_KEY = '@organize_notify_v1';
const WORK_HABITS_KEY = '@organize_work_habits_v1';
const WORK_TODOS_KEY = '@organize_work_todos_v1';
const WORK_JOURNAL_KEY = '@organize_work_journal_v1';
const WORK_GOALS_KEY = '@organize_work_goals_v1';
const WORK_STEPS_KEY = '@organize_work_steps_v1';

const Tab = createMaterialTopTabNavigator();

// ---------------------------------------------------------------------
//  One-off migrations from the earlier data shapes.
// ---------------------------------------------------------------------

// v1 to-dos used recur: 'daily' | 'weekly' | … and could be habit-linked.
// v2 uses structured repeat objects, and habits live only in Habits.
function migrateTodosV1(old) {
  const today = todayKey();
  return old
    .filter((t) => !t.habitId) // habit-linked rows: the habit itself remains
    .map((t) => {
      let repeat = null;
      const anchor = t.nextDue || today;
      if (t.recur === 'daily') repeat = { type: 'weekly', days: [0, 1, 2, 3, 4, 5, 6] };
      if (t.recur === 'weekly') repeat = { type: 'weekly', days: [weekdayIndex(anchor)] };
      if (t.recur === 'fortnightly') repeat = { type: 'interval', every: 14, start: anchor };
      if (t.recur === 'monthly') repeat = { type: 'monthly', day: parseKey(anchor).getDate() };
      return {
        id: t.id, title: t.title,
        deadline: t.deadline || null,
        repeat,
        nextDue: repeat ? nextOccurrence(repeat, today) : null,
        done: !!t.done, completedOn: t.completedOn || null,
      };
    });
}

// Old habits only remembered `lastDone`; now `history` (every completed
// day) is the source of truth and the streak is computed from it.
// `target` (days per week, 1–7) arrived later — older habits are daily.
function migrateHabit(h) {
  let out = h;
  if (!out.history) {
    const history = out.lastDone ? [out.lastDone] : [];
    out = { ...out, history, streak: currentStreak(new Set(history)) };
  }
  if (!out.target) out = { ...out, target: 7 };
  return out;
}

// Events/reminders from before the Life/Work split belong to Life and
// show in both calendars (sharing is the default).
function migrateSharedEntry(e) {
  return e.owner ? e : { ...e, owner: 'life', shared: true };
}

// The flame means: consecutive days for daily habits, consecutive
// weeks the target was hit for "n×/week" habits.
function habitStreak(daySet, target) {
  return target < 7 ? weekStreak(daySet, target) : currentStreak(daySet);
}

// One-off overnight tidy-up for a to-do list (ticked one-offs vanish).
function tidyTodos(list) {
  const today = todayKey();
  return list.filter((t) => !(t.done && t.completedOn && t.completedOn < today));
}

export default function App() {
  // Per-side stores: { life, work }.
  const [habits, setHabits] = useState({ life: [], work: [] });
  const [todos, setTodos] = useState({ life: [], work: [] });
  const [journal, setJournal] = useState({ life: {}, work: {} });
  const [goals, setGoals] = useState({ life: [], work: [] });
  const [steps, setSteps] = useState({ life: {}, work: {} });
  // Shared stores: every entry carries { owner: 'life'|'work', shared }.
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);

  const [mode, setMode] = useState('life');
  // Optional extras (both live behind toggles in Settings).
  const [deviceCalOn, setDeviceCalOn] = useState(false);
  const [deviceCalAll, setDeviceCalAll] = useState(false); // include preloaded feeds too
  const [deviceEvents, setDeviceEvents] = useState([]);
  const [notifyOn, setNotifyOn] = useState(false);
  const [guidedOn, setGuidedOn] = useState(false);
  const [guidedSections, setGuidedSections] = useState(DEFAULT_GUIDED_SECTIONS);
  const [welcomed, setWelcomed] = useState(false);
  const [name, setName] = useState('');
  const [journalSeed, setJournalSeed] = useState(null); // companion → journal prompt
  const [loaded, setLoaded] = useState(false);

  const palette = mode === 'work' ? WORK : LIFE;

  // Updates one side of a { life, work } store, leaving the other alone.
  const onSide = (fn) => (prev) => ({ ...prev, [mode]: fn(prev[mode]) });

  // --- Load everything once, when the app opens ---
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          HABITS_KEY, TODOS_KEY, TODOS_V1_KEY, EVENTS_KEY, REMINDERS_KEY, JOURNAL_KEY,
          GOALS_KEY, STEPS_KEY, WELCOME_KEY, NAME_KEY,
          MODE_KEY, WORK_HABITS_KEY, WORK_TODOS_KEY, WORK_JOURNAL_KEY,
          WORK_GOALS_KEY, WORK_STEPS_KEY, DEVICE_CAL_KEY, NOTIFY_KEY,
          DEVICE_CAL_ALL_KEY, GUIDED_ON_KEY, GUIDED_SECTIONS_KEY,
        ]);
        const val = (i) => (pairs[i][1] ? JSON.parse(pairs[i][1]) : null);

        const lifeHabits = (val(0) || []).map(migrateHabit);
        const workHabits = (val(11) || []).map(migrateHabit);
        setHabits({ life: lifeHabits, work: workHabits });

        // Prefer v2 to-dos; fall back to migrating v1.
        const v2 = val(1);
        const v1 = val(2);
        const lifeTodos = v2 || (v1 ? migrateTodosV1(v1) : []);
        setTodos({ life: tidyTodos(lifeTodos), work: tidyTodos(val(12) || []) });

        setEvents((val(3) || []).map(migrateSharedEntry));
        setReminders((val(4) || []).map(migrateSharedEntry));
        setJournal({ life: val(5) || {}, work: val(13) || {} });
        setGoals({ life: val(6) || [], work: val(14) || [] });
        setSteps({ life: val(7) || {}, work: val(15) || {} });
        // Welcome flag, name and mode are plain strings, not JSON.
        setWelcomed(pairs[8][1] === '1');
        setName(pairs[9][1] || '');
        setMode(pairs[10][1] === 'work' ? 'work' : 'life');
        setDeviceCalOn(pairs[16][1] === '1');
        setNotifyOn(pairs[17][1] === '1');
        setDeviceCalAll(pairs[18][1] === '1');
        setGuidedOn(pairs[19][1] === '1');
        const savedSections = val(20);
        if (Array.isArray(savedSections) && savedSections.length) {
          setGuidedSections(savedSections);
        }
      } catch (e) {
        console.log('Could not load data:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // --- Save whenever anything changes (but not before loading) ---
  const save = (key, value) =>
    AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {});
  useEffect(() => {
    if (!loaded) return;
    save(HABITS_KEY, habits.life); save(WORK_HABITS_KEY, habits.work);
  }, [habits, loaded]);
  useEffect(() => {
    if (!loaded) return;
    save(TODOS_KEY, todos.life); save(WORK_TODOS_KEY, todos.work);
  }, [todos, loaded]);
  useEffect(() => {
    if (!loaded) return;
    save(EVENTS_KEY, events);
  }, [events, loaded]);
  useEffect(() => {
    if (!loaded) return;
    save(REMINDERS_KEY, reminders);
  }, [reminders, loaded]);
  useEffect(() => {
    if (!loaded) return;
    save(JOURNAL_KEY, journal.life); save(WORK_JOURNAL_KEY, journal.work);
  }, [journal, loaded]);
  useEffect(() => {
    if (!loaded) return;
    save(GOALS_KEY, goals.life); save(WORK_GOALS_KEY, goals.work);
  }, [goals, loaded]);
  useEffect(() => {
    if (!loaded) return;
    save(STEPS_KEY, steps.life); save(WORK_STEPS_KEY, steps.work);
  }, [steps, loaded]);

  // ================= Phone calendar & morning digests =================

  // Mirror the phone's calendar while the toggle is on (nothing stored).
  useEffect(() => {
    if (!loaded) return;
    if (!deviceCalOn) { setDeviceEvents([]); return; }
    let alive = true;
    fetchDeviceEvents(deviceCalAll).then((list) => { if (alive) setDeviceEvents(list); });
    return () => { alive = false; };
  }, [deviceCalOn, deviceCalAll, loaded]);

  // Binary: mirror everything (preloaded feeds included) or just the
  // user's own calendars.
  function toggleDeviceCalAll() {
    const next = !deviceCalAll;
    setDeviceCalAll(next);
    AsyncStorage.setItem(DEVICE_CAL_ALL_KEY, next ? '1' : '0').catch(() => {});
  }

  // Replan the 8am digests whenever events change (or the toggle flips).
  useEffect(() => {
    if (!loaded) return;
    rescheduleMorningDigests(events, notifyOn);
  }, [events, notifyOn, loaded]);

  async function toggleDeviceCal() {
    if (deviceCalOn) {
      setDeviceCalOn(false);
      AsyncStorage.setItem(DEVICE_CAL_KEY, '0').catch(() => {});
      return;
    }
    const ok = await ensureCalendarPermission();
    if (!ok) {
      Alert.alert(
        'Calendar access needed',
        'Organize needs permission to read your calendar. You can grant it in the iPhone Settings app under Organize.'
      );
      return;
    }
    setDeviceCalOn(true);
    AsyncStorage.setItem(DEVICE_CAL_KEY, '1').catch(() => {});
  }

  async function toggleNotify() {
    if (notifyOn) {
      setNotifyOn(false);
      AsyncStorage.setItem(NOTIFY_KEY, '0').catch(() => {});
      return;
    }
    const ok = await ensureNotifyPermission();
    if (!ok) {
      Alert.alert(
        'Notifications are off',
        'Allow notifications for Organize in the iPhone Settings app to get the morning digest.'
      );
      return;
    }
    setNotifyOn(true);
    AsyncStorage.setItem(NOTIFY_KEY, '1').catch(() => {});
  }

  // ================= Switching sides =================

  // A full-screen veil in the target side's colours fades in, the mark
  // blooms, the app re-themes underneath, and the veil lifts.
  const switchAnim = useRef(new Animated.Value(0)).current;
  const [switchTarget, setSwitchTarget] = useState(null);

  function switchMode() {
    const target = mode === 'life' ? 'work' : 'life';
    setSwitchTarget(target);
    Animated.timing(switchAnim, {
      toValue: 1, duration: 340,
      easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => {
      setMode(target);
      AsyncStorage.setItem(MODE_KEY, target).catch(() => {});
      Animated.timing(switchAnim, {
        toValue: 0, duration: 480, delay: 260,
        easing: Easing.out(Easing.cubic), useNativeDriver: true,
      }).start(() => setSwitchTarget(null));
    });
  }

  // ================= Habit actions =================

  function addHabit(habitName, target = 7) {
    setHabits(onSide((list) => [...list, {
      id: Date.now().toString(), name: habitName, target,
      streak: 0, lastDone: null, history: [],
    }]));
  }

  function toggleHabit(id) {
    const today = todayKey();
    setHabits(onSide((list) =>
      list.map((h) => {
        if (h.id !== id) return h;
        const days = new Set(h.history || []);
        if (days.has(today)) days.delete(today);
        else days.add(today);
        const history = [...days].sort();
        return {
          ...h, history,
          streak: habitStreak(days, h.target || 7),
          lastDone: history[history.length - 1] || null,
        };
      })
    ));
  }

  function deleteHabit(id) {
    setHabits(onSide((list) => list.filter((h) => h.id !== id)));
  }

  // ================= To-do actions =================

  // options = { title, deadline, repeat }
  function addTodo({ title, deadline, repeat }) {
    const today = todayKey();
    setTodos(onSide((list) => [...list, {
      id: Date.now().toString(), title,
      deadline: deadline || null,
      repeat: repeat || null,
      nextDue: repeat ? nextOccurrence(repeat, today) : null,
      done: false, completedOn: null,
    }]));
  }

  function toggleTodo(id) {
    const today = todayKey();
    setTodos(onSide((list) => list.map((t) => {
      if (t.id !== id) return t;

      if (t.repeat) {
        // Recurring: stays ticked for the rest of today, then hides
        // until it's next due. Unticking today brings it straight back.
        // Rolling repeats ("once a week, any day") come back a fixed
        // number of days after the tick rather than on a fixed day.
        const rolling = t.repeat.type === 'rolling';
        return t.completedOn === today
          ? { ...t, completedOn: null, nextDue: rolling ? today : nextOccurrence(t.repeat, today) }
          : { ...t, completedOn: today, nextDue: rolling ? addDays(today, t.repeat.every) : nextOccurrence(t.repeat, addDays(today, 1)) };
      }

      // One-off: ticked today, tidied away overnight (see the load effect).
      return t.done
        ? { ...t, done: false, completedOn: null }
        : { ...t, done: true, completedOn: today };
    })));
  }

  function deleteTodo(id) {
    setTodos(onSide((list) => list.filter((t) => t.id !== id)));
  }

  // ================= Event & reminder actions =================
  //  Entries are born on the current side (`owner: mode`). `shared`
  //  (default true) also shows them in the other side's calendar.

  function addEvent({ title, date, endDate, time, shared }) {
    setEvents((prev) => [...prev, {
      id: Date.now().toString(), title, date,
      endDate: endDate && endDate > date ? endDate : null, // multi-day span
      time: time || null,
      owner: mode, shared: shared !== false,
    }]);
  }
  function deleteEvent(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }
  // "Remove from this calendar" on the side that doesn't own it.
  function unshareEvent(id) {
    setEvents((prev) => prev.map((e) => (e.id === id ? { ...e, shared: false } : e)));
  }

  function addReminder({ title, date, yearly, shared }) {
    setReminders((prev) => [...prev, {
      id: Date.now().toString(), title, date, yearly: !!yearly,
      owner: mode, shared: shared !== false,
    }]);
  }
  function deleteReminder(id) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }
  function unshareReminder(id) {
    setReminders((prev) => prev.map((r) => (r.id === id ? { ...r, shared: false } : r)));
  }

  // ================= Journal actions =================

  function saveEntry(key, { text, mood, guided }) {
    setJournal(onSide((entries) => ({
      ...entries,
      [key]: { text, mood: mood || null, guided: guided || null },
    })));
  }

  // Guided-journal preferences (shared across Life and Work).
  function toggleGuided() {
    const next = !guidedOn;
    setGuidedOn(next);
    AsyncStorage.setItem(GUIDED_ON_KEY, next ? '1' : '0').catch(() => {});
  }
  function updateGuidedSections(sections) {
    setGuidedSections(sections);
    AsyncStorage.setItem(GUIDED_SECTIONS_KEY, JSON.stringify(sections)).catch(() => {});
  }
  function deleteEntry(key) {
    setJournal(onSide((entries) => {
      const next = { ...entries };
      delete next[key];
      return next;
    }));
  }

  // "One step at a time" entries — the journal's goals side.
  function saveStep(key, text) {
    setSteps(onSide((entries) => ({ ...entries, [key]: { text } })));
  }
  function deleteStep(key) {
    setSteps(onSide((entries) => {
      const next = { ...entries };
      delete next[key];
      return next;
    }));
  }

  // ================= Goal actions =================

  // goal = { title, specific, why, milestones: [text], targetDate }
  function addGoal({ title, specific, why, milestones, targetDate }) {
    setGoals(onSide((list) => [...list, {
      id: Date.now().toString(), title,
      specific: specific || '', why: why || '',
      milestones: milestones.map((text, i) => ({
        id: `${Date.now()}-${i}`, text, done: false,
      })),
      targetDate: targetDate || null,
      createdOn: todayKey(), achievedOn: null,
    }]));
  }

  // Flesh a goal out after the fact — "make it more SMART".
  function updateGoal(goalId, fields) {
    setGoals(onSide((list) => list.map((g) =>
      g.id === goalId ? { ...g, ...fields } : g
    )));
  }

  function toggleMilestone(goalId, milestoneId) {
    setGoals(onSide((list) => list.map((g) => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        milestones: g.milestones.map((m) =>
          m.id === milestoneId ? { ...m, done: !m.done } : m
        ),
      };
    })));
  }

  function markGoalAchieved(goalId) {
    setGoals(onSide((list) => list.map((g) =>
      g.id === goalId ? { ...g, achievedOn: g.achievedOn ? null : todayKey() } : g
    )));
  }

  function deleteGoal(goalId) {
    setGoals(onSide((list) => list.filter((g) => g.id !== goalId)));
  }

  // ================= Welcome =================

  function finishWelcome(chosenName) {
    setName(chosenName);
    setWelcomed(true);
    AsyncStorage.setItem(WELCOME_KEY, '1').catch(() => {});
    AsyncStorage.setItem(NAME_KEY, chosenName).catch(() => {});
  }

  // ================= Settings =================

  function updateName(newName) {
    setName(newName);
    AsyncStorage.setItem(NAME_KEY, newName).catch(() => {});
  }

  // Wipe everything — storage and state, both sides — and return to the
  // welcome flow, exactly like a fresh install.
  async function resetAllData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      // Everything the app owns is namespaced @organize_* or @atomic_*.
      await AsyncStorage.multiRemove(
        keys.filter((k) => k.startsWith('@organize_') || k.startsWith('@atomic_'))
      );
    } catch (e) {}
    setHabits({ life: [], work: [] }); setTodos({ life: [], work: [] });
    setJournal({ life: {}, work: {} }); setGoals({ life: [], work: [] });
    setSteps({ life: {}, work: {} });
    setEvents([]); setReminders([]);
    setJournalSeed(null); setName('');
    setMode('life');
    setDeviceCalOn(false); setDeviceCalAll(false); setDeviceEvents([]); setNotifyOn(false);
    setGuidedOn(false); setGuidedSections(DEFAULT_GUIDED_SECTIONS);
    setWelcomed(false); // straight back to the welcome flow
  }

  // ================= Navigation =================

  const ICONS = {
    'Home': 'home-outline',
    'To-dos': 'checkbox-outline',
    'Calendar': 'calendar-outline',
    'Habits': 'flame-outline',
    'Goals': 'flag-outline',
    'Journal': 'book-outline',
  };

  // Make react-navigation's default surfaces match the active side.
  const navTheme = useMemo(() => ({
    ...DefaultTheme,
    dark: palette.mode === 'work',
    colors: {
      ...DefaultTheme.colors,
      background: palette.bg,
      card: palette.panel,
      text: palette.ink,
      border: palette.line,
      primary: palette.espresso,
    },
  }), [palette]);

  // Hold on the plain background until storage has answered — avoids
  // flashing the tabs at a first-time user (or the welcome at a regular).
  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: LIFE.bg }} />;
  }

  if (!welcomed) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <WelcomeScreen onDone={finishWelcome} />
      </SafeAreaProvider>
    );
  }

  const veilPalette = switchTarget === 'work' ? WORK : LIFE;

  return (
    <SafeAreaProvider>
      <ThemeContext.Provider value={palette}>
        <StatusBar style={palette.mode === 'work' ? 'light' : 'dark'} />
        {/* bottom edge padded here so the tab bar clears the home indicator */}
        <SafeAreaView
          key={mode} /* remount so every static piece re-themes cleanly */
          style={{ flex: 1, backgroundColor: palette.panel }}
          edges={['bottom']}
        >
          <NavigationContainer theme={navTheme}>
            <Tab.Navigator
              tabBarPosition="bottom"
              screenOptions={({ route }) => ({
                swipeEnabled: true,
                lazy: true,
                tabBarShowIcon: true,
                tabBarActiveTintColor: palette.espresso,
                tabBarInactiveTintColor: palette.muted2,
                tabBarStyle: {
                  backgroundColor: palette.panel,
                  borderTopWidth: 1,
                  borderTopColor: palette.line,
                  elevation: 0,
                  shadowOpacity: 0,
                },
                tabBarItemStyle: { paddingVertical: 7, paddingHorizontal: 0 },
                tabBarLabelStyle: {
                  fontSize: 9.5, fontWeight: '600', textTransform: 'none',
                  marginTop: 2, marginHorizontal: 0,
                },
                tabBarIconStyle: { width: 24, height: 24, alignSelf: 'center' },
                // the little accent line rides along as you swipe
                tabBarIndicatorStyle: { backgroundColor: palette.espresso, height: 2, top: 0 },
                tabBarPressColor: palette.line,
                tabBarIcon: ({ color }) => (
                  <Ionicons name={ICONS[route.name]} size={21} color={color} />
                ),
              })}
            >
            <Tab.Screen name="Home">
              {() => (
                <HomeScreen
                  name={name}
                  mode={mode}
                  habits={habits[mode]}
                  todos={todos[mode]}
                  events={events}
                  deviceEvents={deviceEvents}
                  reminders={reminders}
                  journal={journal[mode]}
                  toggleTodo={toggleTodo}
                  onSeedJournal={setJournalSeed}
                  onUpdateName={updateName}
                  onResetAll={resetAllData}
                  onSwitchMode={switchMode}
                  notifyOn={notifyOn}
                  onToggleNotify={toggleNotify}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="To-dos">
              {() => (
                <TodosScreen
                  todos={todos[mode]}
                  addTodo={addTodo}
                  toggleTodo={toggleTodo}
                  deleteTodo={deleteTodo}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Calendar">
              {() => (
                <CalendarScreen
                  mode={mode}
                  todos={todos[mode]}
                  toggleTodo={toggleTodo}
                  events={events}
                  deviceEvents={deviceEvents}
                  deviceCalOn={deviceCalOn}
                  onToggleDeviceCal={toggleDeviceCal}
                  deviceCalAll={deviceCalAll}
                  onToggleDeviceCalAll={toggleDeviceCalAll}
                  addEvent={addEvent}
                  deleteEvent={deleteEvent}
                  unshareEvent={unshareEvent}
                  reminders={reminders}
                  addReminder={addReminder}
                  deleteReminder={deleteReminder}
                  unshareReminder={unshareReminder}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Habits">
              {() => (
                <HabitsScreen
                  habits={habits[mode]}
                  addHabit={addHabit}
                  toggleHabit={toggleHabit}
                  deleteHabit={deleteHabit}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Goals">
              {() => (
                <GoalsScreen
                  goals={goals[mode]}
                  addGoal={addGoal}
                  updateGoal={updateGoal}
                  toggleMilestone={toggleMilestone}
                  markGoalAchieved={markGoalAchieved}
                  deleteGoal={deleteGoal}
                />
              )}
            </Tab.Screen>
            <Tab.Screen name="Journal">
              {() => (
                <JournalScreen
                  journal={journal[mode]}
                  saveEntry={saveEntry}
                  deleteEntry={deleteEntry}
                  steps={steps[mode]}
                  saveStep={saveStep}
                  deleteStep={deleteStep}
                  goals={goals[mode]}
                  journalSeed={journalSeed}
                  onSeedConsumed={() => setJournalSeed(null)}
                  guidedOn={guidedOn}
                  onToggleGuided={toggleGuided}
                  guidedSections={guidedSections}
                  onSetGuidedSections={updateGuidedSections}
                />
              )}
            </Tab.Screen>
            </Tab.Navigator>
          </NavigationContainer>
        </SafeAreaView>

        {/* ---- the switching veil ---- */}
        {switchTarget && (
          <Animated.View
            pointerEvents="auto"
            style={{
              position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
              backgroundColor: veilPalette.bg,
              alignItems: 'center', justifyContent: 'center',
              opacity: switchAnim,
            }}
          >
            <Animated.View
              style={{
                alignItems: 'center',
                transform: [{
                  scale: switchAnim.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }),
                }],
              }}
            >
              <VeilMark colors={veilPalette} />
              <Text style={{
                marginTop: 22, fontSize: 24, fontFamily: SERIF,
                color: veilPalette.ink, fontWeight: '600', letterSpacing: 0.3,
              }}>
                Organize
                {switchTarget === 'work' && (
                  <Text style={{ fontStyle: 'italic', color: veilPalette.espressoLight }}> Work</Text>
                )}
                {switchTarget === 'life' && (
                  <Text style={{ fontStyle: 'italic', color: veilPalette.espressoLight }}> Life</Text>
                )}
              </Text>
            </Animated.View>
          </Animated.View>
        )}
      </ThemeContext.Provider>
    </SafeAreaProvider>
  );
}

// The 2×2 stacked-squares mark, drawn in the veil's colours.
function VeilMark({ colors, size = 30, gap = 8 }) {
  const sq = (filled) => ({
    width: size, height: size, borderRadius: size * 0.28,
    borderWidth: 2.5, borderColor: colors.espresso,
    backgroundColor: filled ? colors.espresso : 'transparent',
  });
  return (
    <View style={{ width: size * 2 + gap, height: size * 2 + gap }}>
      <View style={{ flexDirection: 'row', gap, marginBottom: gap }}>
        <View style={sq(true)} /><View style={sq(false)} />
      </View>
      <View style={{ flexDirection: 'row', gap }}>
        <View style={sq(false)} /><View style={sq(false)} />
      </View>
    </View>
  );
}
