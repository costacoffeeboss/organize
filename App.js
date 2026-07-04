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
import { StatusBar } from 'expo-status-bar';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import { COLORS } from './theme';
import {
  todayKey, addDays, parseKey, weekdayIndex,
  nextOccurrence, currentStreak,
} from './utils/dates';
import TodosScreen from './screens/TodosScreen';
import CalendarScreen from './screens/CalendarScreen';
import HabitsScreen from './screens/HabitsScreen';
import JournalScreen from './screens/JournalScreen';

// Storage keys. (Habits keep the old "atomic" key so nothing is lost.)
const HABITS_KEY = '@atomic_habits_v1';
const TODOS_V1_KEY = '@organize_todos_v1';
const TODOS_KEY = '@organize_todos_v2';
const EVENTS_KEY = '@organize_events_v1';
const REMINDERS_KEY = '@organize_reminders_v1';
const JOURNAL_KEY = '@organize_journal_v1';

const Tab = createBottomTabNavigator();

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
function migrateHabit(h) {
  if (h.history) return h;
  const history = h.lastDone ? [h.lastDone] : [];
  return { ...h, history, streak: currentStreak(new Set(history)) };
}

export default function App() {
  const [habits, setHabits] = useState([]);
  const [todos, setTodos] = useState([]);
  const [events, setEvents] = useState([]);
  const [reminders, setReminders] = useState([]);
  const [journal, setJournal] = useState({});
  const [loaded, setLoaded] = useState(false);

  // --- Load everything once, when the app opens ---
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([
          HABITS_KEY, TODOS_KEY, TODOS_V1_KEY, EVENTS_KEY, REMINDERS_KEY, JOURNAL_KEY,
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

  // ================= Habit actions =================

  function addHabit(name) {
    setHabits((prev) => [...prev, {
      id: Date.now().toString(), name, streak: 0, lastDone: null, history: [],
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
          streak: currentStreak(days),
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

  // ================= Navigation =================

  const ICONS = {
    'To-dos': 'checkbox-outline',
    'Calendar': 'calendar-outline',
    'Habits': 'flame-outline',
    'Journal': 'book-outline',
  };

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <NavigationContainer theme={navTheme}>
        <Tab.Navigator
          screenOptions={({ route }) => ({
            headerShown: false,
            tabBarActiveTintColor: COLORS.espresso,
            tabBarInactiveTintColor: COLORS.muted2,
            tabBarStyle: {
              backgroundColor: COLORS.panel,
              borderTopColor: COLORS.line,
            },
            tabBarIcon: ({ color, size }) => (
              <Ionicons name={ICONS[route.name]} size={size} color={color} />
            ),
          })}
        >
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
          <Tab.Screen name="Journal">
            {() => (
              <JournalScreen
                journal={journal}
                saveEntry={saveEntry}
                deleteEntry={deleteEntry}
                habits={habits}
                todos={todos}
              />
            )}
          </Tab.Screen>
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
