// =====================================================================
//  Organize — main app
//  Four tabs: To-dos · Calendar · Habits · Journal.
//
//  This file is the "brain": it owns all the data (todos, habits,
//  events, reminders, journal), saves it to the phone, and hands the
//  data + actions down to each screen as props. The screens only worry
//  about how things look.
//
//  Coming from Python? useState = a variable React watches;
//  useEffect = "run this when X changes"; props = function arguments
//  for components.
// =====================================================================

import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
// Material top tabs (parked at the bottom) give us swipe-between-tabs.
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from './theme';
import {
  todayKey, addDays, parseKey, weekdayIndex,
  nextOccurrence, currentStreak, weekStreak,
} from './utils/dates';
import HomeScreen from './screens/HomeScreen';
import TodosScreen from './screens/TodosScreen';
import CalendarScreen from './screens/CalendarScreen';
import HabitsScreen from './screens/HabitsScreen';
import JournalScreen from './screens/JournalScreen';
import GoalsScreen from './screens/GoalsScreen';
import WelcomeScreen from './screens/WelcomeScreen';

// Storage keys. (Habits keep the old "atomic" key so nothing is lost.)
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

const Tab = createMaterialTopTabNavigator();

// Make react-navigation's default surfaces match our cream theme.
const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: COLORS.bg,
    card: COLORS.panel,
    text: COLORS.ink,
    border: COLORS.line,
    primary: COLORS.espresso,
  },
};

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

// The flame means: consecutive days for daily habits, consecutive
// weeks the target was hit for "n×/week" habits.
function habitStreak(daySet, target) {
  return target < 7 ? weekStreak(daySet, target) : currentStreak(daySet);
}

export default function App() {
  const [habits, setHabits] = useState([]);
  const [todos, setTodos] = useState([]);
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [journal, setJournal] = useState({});
  const [goals, setGoals] = useState([]);
  const [steps, setSteps] = useState({});
  const [welcomed, setWelcomed] = useState(false);
  const [name, setName] = useState('');
  const [journalSeed, setJournalSeed] = useState(null); // companion → journal prompt
  const [loaded, setLoaded] = useState(false);

  // --- Load everything once, when the app opens ---
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          HABITS_KEY, TODOS_KEY, TODOS_V1_KEY, EVENTS_KEY, REMINDERS_KEY, JOURNAL_KEY,
          GOALS_KEY, STEPS_KEY, WELCOME_KEY, NAME_KEY,
        ]);
        const val = (i) => (pairs[i][1] ? JSON.parse(pairs[i][1]) : null);

        const rawHabits = val(0);
        if (rawHabits) setHabits(rawHabits.map(migrateHabit));

        // Prefer v2 to-dos; fall back to migrating v1.
        const v2 = val(1);
        const v1 = val(2);
        let list = v2 || (v1 ? migrateTodosV1(v1) : []);
        // Overnight tidy-up: one-offs ticked before today disappear.
        const today = todayKey();
        list = list.filter((t) => !(t.done && t.completedOn && t.completedOn < today));
        setTodos(list);

        setEvents(val(3) || []);
        setReminders(val(4) || []);
        setJournal(val(5) || {});
        setGoals(val(6) || []);
        setSteps(val(7) || {});
        // Welcome flag + name are plain strings, not JSON.
        setWelcomed(pairs[8][1] === '1');
        setName(pairs[9][1] || '');
      } catch (e) {
        console.log('Could not load data:', e);
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  // --- Save whenever anything changes (but not before loading) ---
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits)).catch(() => {});
  }, [habits, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(TODOS_KEY, JSON.stringify(todos)).catch(() => {});
  }, [todos, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(EVENTS_KEY, JSON.stringify(events)).catch(() => {});
  }, [events, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(REMINDERS_KEY, JSON.stringify(reminders)).catch(() => {});
  }, [reminders, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(JOURNAL_KEY, JSON.stringify(journal)).catch(() => {});
  }, [journal, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(GOALS_KEY, JSON.stringify(goals)).catch(() => {});
  }, [goals, loaded]);
  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(STEPS_KEY, JSON.stringify(steps)).catch(() => {});
  }, [steps, loaded]);

  // ================= Habit actions =================

  function addHabit(name, target = 7) {
    setHabits((prev) => [...prev, {
      id: Date.now().toString(), name, target,
      streak: 0, lastDone: null, history: [],
    }]);
  }

  function toggleHabit(id) {
    const today = todayKey();
    setHabits((prev) =>
      prev.map((h) => {
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
    );
  }

  function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
  }

  // ================= To-do actions =================

  // options = { title, deadline, repeat }
  function addTodo({ title, deadline, repeat }) {
    const today = todayKey();
    setTodos((prev) => [...prev, {
      id: Date.now().toString(), title,
      deadline: deadline || null,
      repeat: repeat || null,
      nextDue: repeat ? nextOccurrence(repeat, today) : null,
      done: false, completedOn: null,
    }]);
  }

  function toggleTodo(id) {
    const today = todayKey();
    setTodos((prev) => prev.map((t) => {
      if (t.id !== id) return t;

      if (t.repeat) {
        // Recurring: stays ticked for the rest of today, then hides
        // until it's next due. Unticking today brings it straight back.
        return t.completedOn === today
          ? { ...t, completedOn: null, nextDue: nextOccurrence(t.repeat, today) }
          : { ...t, completedOn: today, nextDue: nextOccurrence(t.repeat, addDays(today, 1)) };
      }

      // One-off: ticked today, tidied away overnight (see the load effect).
      return t.done
        ? { ...t, done: false, completedOn: null }
        : { ...t, done: true, completedOn: today };
    }));
  }

  function deleteTodo(id) {
    setTodos((prev) => prev.filter((t) => t.id !== id));
  }

  // ================= Event & reminder actions =================

  function addEvent({ title, date, time }) {
    setEvents((prev) => [...prev, {
      id: Date.now().toString(), title, date, time: time || null,
    }]);
  }
  function deleteEvent(id) {
    setEvents((prev) => prev.filter((e) => e.id !== id));
  }

  function addReminder({ title, date, yearly }) {
    setReminders((prev) => [...prev, {
      id: Date.now().toString(), title, date, yearly: !!yearly,
    }]);
  }
  function deleteReminder(id) {
    setReminders((prev) => prev.filter((r) => r.id !== id));
  }

  // ================= Journal actions =================

  function saveEntry(key, { text, mood }) {
    setJournal((prev) => ({ ...prev, [key]: { text, mood: mood || null } }));
  }
  function deleteEntry(key) {
    setJournal((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // "One step at a time" entries — the journal's goals side.
  function saveStep(key, text) {
    setSteps((prev) => ({ ...prev, [key]: { text } }));
  }
  function deleteStep(key) {
    setSteps((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  // ================= Goal actions =================

  // goal = { title, specific, why, milestones: [text], targetDate }
  function addGoal({ title, specific, why, milestones, targetDate }) {
    setGoals((prev) => [...prev, {
      id: Date.now().toString(), title,
      specific: specific || '', why: why || '',
      milestones: milestones.map((text, i) => ({
        id: `${Date.now()}-${i}`, text, done: false,
      })),
      targetDate: targetDate || null,
      createdOn: todayKey(), achievedOn: null,
    }]);
  }

  // Flesh a goal out after the fact — "make it more SMART".
  function updateGoal(goalId, fields) {
    setGoals((prev) => prev.map((g) =>
      g.id === goalId ? { ...g, ...fields } : g
    ));
  }

  function toggleMilestone(goalId, milestoneId) {
    setGoals((prev) => prev.map((g) => {
      if (g.id !== goalId) return g;
      return {
        ...g,
        milestones: g.milestones.map((m) =>
          m.id === milestoneId ? { ...m, done: !m.done } : m
        ),
      };
    }));
  }

  function markGoalAchieved(goalId) {
    setGoals((prev) => prev.map((g) =>
      g.id === goalId ? { ...g, achievedOn: g.achievedOn ? null : todayKey() } : g
    ));
  }

  function deleteGoal(goalId) {
    setGoals((prev) => prev.filter((g) => g.id !== goalId));
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

  // Wipe everything — storage and state — and return to the welcome
  // flow, exactly like a fresh install.
  async function resetAllData() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      // Everything the app owns is namespaced @organize_* or @atomic_*.
      await AsyncStorage.multiRemove(
        keys.filter((k) => k.startsWith('@organize_') || k.startsWith('@atomic_'))
      );
    } catch (e) {}
    setHabits([]); setTodos([]); setEvents([]); setReminders([]);
    setJournal({}); setGoals([]); setSteps({});
    setJournalSeed(null); setName('');
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

  // Hold on the cream background until storage has answered — avoids
  // flashing the tabs at a first-time user (or the welcome at a regular).
  if (!loaded) {
    return <View style={{ flex: 1, backgroundColor: COLORS.bg }} />;
  }

  if (!welcomed) {
    return (
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <WelcomeScreen onDone={finishWelcome} />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      {/* bottom edge padded here so the tab bar clears the home indicator */}
      <SafeAreaView style={{ flex: 1, backgroundColor: COLORS.panel }} edges={['bottom']}>
        <NavigationContainer theme={navTheme}>
          <Tab.Navigator
            tabBarPosition="bottom"
            screenOptions={({ route }) => ({
              swipeEnabled: true,
              lazy: true,
              tabBarShowIcon: true,
              tabBarActiveTintColor: COLORS.espresso,
              tabBarInactiveTintColor: COLORS.muted2,
              tabBarStyle: {
                backgroundColor: COLORS.panel,
                borderTopWidth: 1,
                borderTopColor: COLORS.line,
                elevation: 0,
                shadowOpacity: 0,
              },
              tabBarItemStyle: { paddingVertical: 7, paddingHorizontal: 0 },
              tabBarLabelStyle: {
                fontSize: 9.5, fontWeight: '600', textTransform: 'none',
                marginTop: 2, marginHorizontal: 0,
              },
              tabBarIconStyle: { width: 24, height: 24, alignSelf: 'center' },
              // the little espresso line rides along as you swipe
              tabBarIndicatorStyle: { backgroundColor: COLORS.espresso, height: 2, top: 0 },
              tabBarPressColor: 'rgba(75,54,38,0.12)',
              tabBarIcon: ({ color }) => (
                <Ionicons name={ICONS[route.name]} size={21} color={color} />
              ),
            })}
          >
          <Tab.Screen name="Home">
            {() => (
              <HomeScreen
                name={name}
                habits={habits}
                todos={todos}
                events={events}
                reminders={reminders}
                journal={journal}
                toggleTodo={toggleTodo}
                onSeedJournal={setJournalSeed}
                onUpdateName={updateName}
                onResetAll={resetAllData}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="To-dos">
            {() => (
              <TodosScreen
                todos={todos}
                addTodo={addTodo}
                toggleTodo={toggleTodo}
                deleteTodo={deleteTodo}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Calendar">
            {() => (
              <CalendarScreen
                todos={todos}
                toggleTodo={toggleTodo}
                events={events}
                addEvent={addEvent}
                deleteEvent={deleteEvent}
                reminders={reminders}
                addReminder={addReminder}
                deleteReminder={deleteReminder}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Habits">
            {() => (
              <HabitsScreen
                habits={habits}
                addHabit={addHabit}
                toggleHabit={toggleHabit}
                deleteHabit={deleteHabit}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Goals">
            {() => (
              <GoalsScreen
                goals={goals}
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
                journal={journal}
                saveEntry={saveEntry}
                deleteEntry={deleteEntry}
                steps={steps}
                saveStep={saveStep}
                deleteStep={deleteStep}
                goals={goals}
                journalSeed={journalSeed}
                onSeedConsumed={() => setJournalSeed(null)}
              />
            )}
          </Tab.Screen>
          </Tab.Navigator>
        </NavigationContainer>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
