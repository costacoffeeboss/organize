// =====================================================================
//  Home — the dashboard, and the first thing you see. One glance:
//    · what Organize noticed (the companion card)
//    · today's habit ring (like the landing page mock)
//    · what's on the schedule — events, reminders, due to-dos
//    · a nudge to journal (or today's entry, once written)
//  Every card is a doorway: tap through to the tab it summarises.
// =====================================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { COLORS, SERIF } from '../theme';
import {
  todayKey, niceDate, greetingLabel, repeatOccursOn, reminderOccursOn,
  currentStreak,
} from '../utils/dates';
import { getNotices } from '../utils/noticer';
import ScreenHeader from '../components/ScreenHeader';
import CompanionCard from '../components/CompanionCard';
import ProgressRing from '../components/ProgressRing';
import TodoRow from '../components/TodoRow';
import Rise from '../components/Rise';

const DISMISSED_KEY = '@organize_dismissed_notices';

const PROMPTS = [
  'What gave you energy today?',
  'What is one thing you did well today?',
  'What would make tomorrow feel lighter?',
  'What are you grateful for right now?',
  'What did today teach you?',
];

export default function HomeScreen({
  name, habits, todos, events, reminders, journal, toggleTodo, onSeedJournal,
}) {
  const navigation = useNavigation();
  const today = todayKey();
  const [dismissed, setDismissed] = useState([]);

  // --- Companion ---
  useEffect(() => {
    AsyncStorage.getItem(DISMISSED_KEY)
      .then((v) => { if (v) setDismissed(JSON.parse(v)); })
      .catch(() => {});
  }, []);
  const notices = getNotices({ habits, todos, journal, today });
  const notice = notices.find((n) => !dismissed.includes(n.id));
  function dismissNotice(n) {
    const next = [...dismissed, n.id].filter((id) => id.endsWith(today));
    setDismissed(next);
    AsyncStorage.setItem(DISMISSED_KEY, JSON.stringify(next)).catch(() => {});
  }

  // --- Habits ring ---
  const doneCount = habits.filter((h) => h.lastDone === today).length;
  const total = habits.length;
  const percent = total === 0 ? 0 : Math.round((doneCount / total) * 100);
  // Best DAY streak among daily habits (weekly-target habits count weeks).
  const topStreak = Math.max(0, ...habits
    .filter((h) => (h.target || 7) === 7)
    .map((h) => h.streak || 0));

  // --- Today's schedule ---
  const dayEvents = events
    .filter((e) => e.date === today)
    .sort((a, b) => ((a.time || '') < (b.time || '') ? -1 : 1));
  const dayReminders = reminders.filter((r) => reminderOccursOn(r, today));
  const overdueTodos = todos.filter((t) => !t.repeat && !t.done && t.deadline && t.deadline < today);
  const dueTodos = todos.filter((t) =>
    t.repeat
      ? (t.completedOn === today || repeatOccursOn(t.repeat, today))
      : t.deadline === today
  );
  const scheduleEmpty =
    !dayEvents.length && !dayReminders.length && !dueTodos.length && !overdueTodos.length;

  const isTodoDone = (t) => (t.repeat ? t.completedOn === today : t.done);

  // --- Journal card ---
  const todayEntry = journal[today];
  const jStreak = currentStreak(new Set(Object.keys(journal)));
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title={name ? `${greetingLabel()}, ${name}` : 'Organize'}
        subtitle={niceDate()}
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* --- What Organize noticed --- */}
        {notice && (
          <CompanionCard
            notice={notice}
            onWrite={() => {
              onSeedJournal(notice.question);
              navigation.navigate('Journal');
            }}
            onDismiss={() => dismissNotice(notice)}
          />
        )}

        {/* --- The habit ring, straight off the landing page --- */}
        <Rise delay={60}>
          <TouchableOpacity
            style={[styles.card, styles.ringCard]}
            onPress={() => navigation.navigate('Habits')}
            activeOpacity={0.85}
          >
            <ProgressRing percent={percent}>
              <Text style={styles.ringPct}>{percent}%</Text>
            </ProgressRing>
            <View style={{ flex: 1, marginLeft: 18 }}>
              <Text style={styles.cardTitle}>Today</Text>
              <Text style={styles.ringMeta}>
                {total === 0
                  ? 'No habits yet — start one small.'
                  : <Text><Text style={styles.ringStrong}>{doneCount} of {total}</Text> done{topStreak > 1 ? ` · ${topStreak}-day streak` : ''}</Text>}
              </Text>
              <Text style={styles.cardLink}>
                {total === 0 ? 'Add a habit ›' : 'See habits ›'}
              </Text>
            </View>
          </TouchableOpacity>
        </Rise>

        {/* --- On today --- */}
        <Rise delay={140}>
          <View style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>On today</Text>
              <TouchableOpacity onPress={() => navigation.navigate('Calendar')}>
                <Text style={styles.cardLink}>Calendar ›</Text>
              </TouchableOpacity>
            </View>

            {scheduleEmpty && (
              <Text style={styles.quiet}>Nothing scheduled — enjoy the space.</Text>
            )}

            {dayEvents.map((e) => (
              <View key={e.id} style={styles.lineRow}>
                <View style={[styles.lineDot, { backgroundColor: COLORS.espresso }]} />
                <Text style={styles.lineText} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.lineMeta}>{e.time || 'all day'}</Text>
              </View>
            ))}
            {dayReminders.map((r) => (
              <View key={r.id} style={styles.lineRow}>
                <View style={[styles.lineDot, { backgroundColor: COLORS.gold }]} />
                <Text style={styles.lineText} numberOfLines={1}>{r.title}</Text>
                {r.yearly && <Text style={styles.lineMeta}>yearly</Text>}
              </View>
            ))}

            {(overdueTodos.length > 0 || dueTodos.length > 0) && (
              <View style={{ marginTop: dayEvents.length + dayReminders.length ? 10 : 0 }}>
                {overdueTodos.map((t) => (
                  <TodoRow
                    key={t.id}
                    title={t.title}
                    done={false}
                    meta="overdue"
                    metaColor={COLORS.danger}
                    onToggle={() => toggleTodo(t.id)}
                  />
                ))}
                {dueTodos.map((t) => (
                  <TodoRow
                    key={t.id}
                    title={t.title}
                    done={isTodoDone(t)}
                    meta={isTodoDone(t) ? 'done' : t.repeat ? 'repeats' : 'today'}
                    onToggle={() => toggleTodo(t.id)}
                  />
                ))}
              </View>
            )}
          </View>
        </Rise>

        {/* --- Journal nudge / today's entry --- */}
        <Rise delay={220}>
          <TouchableOpacity
            style={styles.journalCard}
            onPress={() => navigation.navigate('Journal')}
            activeOpacity={0.85}
          >
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>Journal</Text>
              {jStreak > 1 && <Text style={styles.streakTag}>{jStreak}-day streak</Text>}
            </View>
            {todayEntry ? (
              <Text style={styles.journalText} numberOfLines={3}>{todayEntry.text}</Text>
            ) : (
              <Text style={styles.journalPrompt}>{prompt}</Text>
            )}
            <Text style={[styles.cardLink, { marginTop: 10 }]}>
              {todayEntry ? 'Read or edit ›' : 'Write it down ›'}
            </Text>
          </TouchableOpacity>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  card: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  ringCard: { flexDirection: 'row', alignItems: 'center' },
  ringPct: { color: COLORS.ink, fontSize: 17, fontWeight: '700', fontFamily: SERIF },
  ringMeta: { color: COLORS.muted, fontSize: 14, marginTop: 3 },
  ringStrong: { color: COLORS.espressoLight, fontWeight: '700' },

  cardHead: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 8,
  },
  cardTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  cardLink: { color: COLORS.espresso, fontSize: 13.5, fontWeight: '700', marginTop: 6 },
  quiet: { color: COLORS.muted, fontSize: 14 },

  lineRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  lineDot: { width: 8, height: 8, borderRadius: 4, marginRight: 11 },
  lineText: { color: COLORS.ink, fontSize: 15, flex: 1 },
  lineMeta: { color: COLORS.espressoLight, fontSize: 12.5, fontWeight: '600', marginLeft: 10 },

  journalCard: {
    backgroundColor: COLORS.crema, borderWidth: 1,
    borderColor: 'rgba(75,54,38,0.2)', borderRadius: 16,
    padding: 16, marginBottom: 14,
  },
  journalText: { color: '#4b3d2c', fontSize: 14.5, lineHeight: 21 },
  journalPrompt: { color: '#4b3d2c', fontSize: 15, fontStyle: 'italic', fontFamily: SERIF, lineHeight: 22 },
  streakTag: {
    color: COLORS.espressoLight, fontSize: 12, fontWeight: '700',
    borderWidth: 1, borderColor: 'rgba(75,54,38,0.3)',
    paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999,
  },
});
