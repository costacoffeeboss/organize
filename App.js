// =====================================================================
//  Organize — main app
//  Three tabs: To-dos · Calendar · Habits.
//
//  This file is the "brain": it owns all the data (todos + habits),
//  saves it to the phone, and hands the data + actions down to each
//  screen as props. The screens only worry about how things look.
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
import { todayKey, yesterdayKey, nextOccurrence } from './utils/dates';
import TodosScreen from './screens/TodosScreen';
import CalendarScreen from './screens/CalendarScreen';
import HabitsScreen from './screens/HabitsScreen';

// Storage keys. (Habits keep the old "atomic" key so nothing is lost.)
const HABITS_KEY = '@atomic_habits_v1';
const TODOS_KEY = '@organize_todos_v1';

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

export default function App() {
  const [habits, setHabits] = useState([]);
  const [todos, setTodos] = useState([]);
  const [loaded, setLoaded] = useState(false);

  // --- Load both lists once, when the app opens ---
  useEffect(() => {
    (async () => {
      try {
        const pairs = await AsyncStorage.multiGet([HABITS_KEY, TODOS_KEY]);
        const rawHabits = pairs[0][1];
        const rawTodos = pairs[1][1];
        if (rawHabits) setHabits(JSON.parse(rawHabits));
        if (rawTodos) {
          const today = todayKey();
          // Overnight tidy-up: one-offs ticked before today disappear.
          const kept = JSON.parse(rawTodos).filter(
            (t) => !(t.done && t.completedOn && t.completedOn < today)
          );
          setTodos(kept);
        }
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

  // ================= Habit actions =================

  function addHabit(name) {
    const habit = { id: Date.now().toString(), name, streak: 0, lastDone: null };
    setHabits((prev) => [...prev, habit]);
    return habit.id;
  }

  function toggleHabit(id) {
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== id) return h;
        const doneToday = h.lastDone === todayKey();
        if (doneToday) {
          return { ...h, lastDone: null, streak: Math.max(0, h.streak - 1) };
        }
        const continued = h.lastDone === yesterdayKey();
        return { ...h, lastDone: todayKey(), streak: continued ? h.streak + 1 : 1 };
      })
    );
  }

  function deleteHabit(id) {
    setHabits((prev) => prev.filter((h) => h.id !== id));
    // If a to-do was linked to this habit, remove it too.
    setTodos((prev) => prev.filter((t) => t.habitId !== id));
  }

  // ================= To-do actions =================

  // options = { title, deadline, recur, habit }
  function addTodo({ title, deadline, recur, habit }) {
    if (habit) {
      // "Habit" to-dos live in BOTH tabs: create the habit, then a
      // linked to-do. The habit is the source of truth for ticks.
      const habitId = addHabit(title);
      setTodos((prev) => [...prev, {
        id: habitId + '-todo', title, habitId,
        recur: 'daily', nextDue: null, deadline: null,
        done: false, completedOn: null,
      }]);
      return;
    }
    setTodos((prev) => [...prev, {
      id: Date.now().toString(), title, habitId: null,
      recur: recur || null,
      nextDue: recur ? todayKey() : null,
      deadline: deadline || null,
      done: false, completedOn: null,
    }]);
  }

  function toggleTodo(id) {
    const t = todos.find((x) => x.id === id);
    if (!t) return;

    // Habit-linked: the habit carries the state; one tick updates both tabs.
    if (t.habitId) { toggleHabit(t.habitId); return; }

    const today = todayKey();
    if (t.recur) {
      // Recurring: stays ticked for the rest of today, then hides
      // until it's next due. Unticking today brings it straight back.
      setTodos((prev) => prev.map((x) => {
        if (x.id !== id) return x;
        return x.completedOn === today
          ? { ...x, completedOn: null, nextDue: today }
          : { ...x, completedOn: today, nextDue: nextOccurrence(today, x.recur) };
      }));
      return;
    }

    // One-off: ticked today, tidied away overnight (see the load effect).
    setTodos((prev) => prev.map((x) => {
      if (x.id !== id) return x;
      return x.done
        ? { ...x, done: false, completedOn: null }
        : { ...x, done: true, completedOn: today };
    }));
  }

  function deleteTodo(id) {
    const t = todos.find((x) => x.id === id);
    setTodos((prev) => prev.filter((x) => x.id !== id));
    // Deleting a habit-linked to-do removes the habit as well
    // (the To-dos screen warns before calling this).
    if (t && t.habitId) setHabits((prev) => prev.filter((h) => h.id !== t.habitId));
  }

  // ================= Navigation =================

  const ICONS = {
    'To-dos': 'checkbox-outline',
    'Calendar': 'calendar-outline',
    'Habits': 'flame-outline',
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
                habits={habits}
                addTodo={addTodo}
                toggleTodo={toggleTodo}
                deleteTodo={deleteTodo}
              />
            )}
          </Tab.Screen>
          <Tab.Screen name="Calendar">
            {() => <CalendarScreen todos={todos} toggleTodo={toggleTodo} />}
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
        </Tab.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
