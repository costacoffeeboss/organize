// =====================================================================
//  Home — the dashboard, and the first thing you see. One glance:
//    · what Organize noticed (the companion card)
//    · today's habit ring (like the landing page mock)
//    · what's on the schedule — events, reminders, due to-dos
//    · a nudge to journal (or today's entry, once written)
//  Every card is a doorway: tap through to the tab it summarises.
//
//  Top-left lives the side-switch mark: a mini stacked-squares logo in
//  the OTHER side's colours. Tap it → "Switch to Organize Work?" (or
//  back to Life) → the app re-themes. Calendar entries from the other
//  side keep their home colours here, so a work meeting still reads
//  black-and-silver inside cream Life.
// =====================================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, Modal,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useNavigation } from '@react-navigation/native';
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles, paletteFor, SERIF } from '../theme';
import { DEVICE_GREY } from '../utils/deviceCalendar';
import {
  todayKey, niceDate, greetingLabel, repeatOccursOn, reminderOccursOn,
  eventOccursOn, currentStreak,
} from '../utils/dates';
import { getNotices } from '../utils/noticer';
import ScreenHeader from '../components/ScreenHeader';
import CompanionCard from '../components/CompanionCard';
import ProgressRing from '../components/ProgressRing';
import TodoRow from '../components/TodoRow';
import ModalShell from '../components/ModalShell';
import FullPage from '../components/FullPage';
import Rise from '../components/Rise';

const DISMISSED_KEY = '@organize_dismissed_notices';

const PROMPTS = [
  'What gave you energy today?',
  'What is one thing you did well today?',
  'What would make tomorrow feel lighter?',
  'What are you grateful for right now?',
  'What did today teach you?',
];

// The mini 2×2 mark that switches sides — drawn in the destination
// side's colours so it reads as a doorway, not decoration.
function SwitchMark({ target, onPress }) {
  const c = paletteFor(target);
  const sq = (filled) => ({
    width: 9, height: 9, borderRadius: 2.5,
    borderWidth: 1.3, borderColor: c.espresso,
    backgroundColor: filled ? c.espresso : 'transparent',
  });
  return (
    <TouchableOpacity
      onPress={onPress}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={{
        width: 38, height: 38, borderRadius: 11,
        backgroundColor: c.bg, borderWidth: 1, borderColor: c.lineStrong,
        alignItems: 'center', justifyContent: 'center',
      }}
    >
      <View style={{ flexDirection: 'row', gap: 3, marginBottom: 3 }}>
        <View style={sq(true)} /><View style={sq(false)} />
      </View>
      <View style={{ flexDirection: 'row', gap: 3 }}>
        <View style={sq(false)} /><View style={sq(false)} />
      </View>
    </TouchableOpacity>
  );
}

export default function HomeScreen({
  name, mode, habits, todos, events, deviceEvents, reminders, journal, toggleTodo,
  onSeedJournal, onUpdateName, onResetAll, onSwitchMode,
  notifyOn, onToggleNotify,
  rundown, onSaveMorning, onSaveEvening, launchFlow, onFlowConsumed,
  allHabits, allTodos, allEvents, allReminders, toggleHabitById, toggleTodoById,
}) {
  const { COLORS, styles } = useThemedStyles(makeStyles);
  const navigation = useNavigation();
  const today = todayKey();
  const [dismissed, setDismissed] = useState([]);
  const [showSettings, setShowSettings] = useState(false);
  const [showSwitch, setShowSwitch] = useState(false);
  const [nameDraft, setNameDraft] = useState('');

  // --- Morning rundown / evening recap ---
  const [flow, setFlow] = useState(null);            // 'morning' | 'evening' | null
  const [intentionDraft, setIntentionDraft] = useState('');
  const [focusDraft, setFocusDraft] = useState([]);  // starred to-do ids
  const [achievedDraft, setAchievedDraft] = useState(null); // 'yes'|'partly'|'no'
  const [reflectionDraft, setReflectionDraft] = useState('');

  const otherMode = mode === 'life' ? 'work' : 'life';

  function openSettings() {
    setNameDraft(name || '');
    setShowSettings(true);
  }

  function saveName() {
    onUpdateName(nameDraft.trim());
    setShowSettings(false);
  }

  // Erasing everything deserves a double take.
  function confirmReset() {
    Alert.alert(
      'Reset all data?',
      'Every to-do, habit, journal entry, goal, event and reminder on this phone — Life and Work — will be erased. This cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Erase everything', style: 'destructive',
          onPress: () => Alert.alert(
            'Absolutely sure?',
            'Last chance — this wipes the app back to a fresh start.',
            [
              { text: 'Keep my data', style: 'cancel' },
              {
                text: 'Yes, erase it all', style: 'destructive',
                onPress: () => { setShowSettings(false); onResetAll(); },
              },
            ]
          ),
        },
      ]
    );
  }

  // --- Companion (dismissals are remembered per side) ---
  const dismissKey = mode === 'work' ? `${DISMISSED_KEY}_work` : DISMISSED_KEY;
  useEffect(() => {
    AsyncStorage.getItem(dismissKey)
      .then((v) => { setDismissed(v ? JSON.parse(v) : []); })
      .catch(() => {});
  }, [dismissKey]);
  const notices = getNotices({ habits, todos, journal, today });
  const notice = notices.find((n) => !dismissed.includes(n.id));
  function dismissNotice(n) {
    const next = [...dismissed, n.id].filter((id) => id.endsWith(today));
    setDismissed(next);
    AsyncStorage.setItem(dismissKey, JSON.stringify(next)).catch(() => {});
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
  // Calendar entries are shared stores: show ours, plus anything the
  // other side shared across. Foreign entries keep their side's colours.
  const visible = (x) => x.owner === mode || x.shared;
  const dayEvents = [
    ...events.filter((e) => visible(e) && eventOccursOn(e, today)),
    ...deviceEvents.filter((e) => eventOccursOn(e, today)), // the phone's own, in grey
  ].sort((a, b) => ((a.time || '') < (b.time || '') ? -1 : 1));
  const dayReminders = reminders.filter((r) => visible(r) && reminderOccursOn(r, today));
  const overdueTodos = todos.filter((t) => !t.repeat && !t.done && t.deadline && t.deadline < today);
  const dueTodos = todos.filter((t) =>
    t.repeat
      ? (t.completedOn === today ||
         (t.repeat.type === 'rolling' ? t.nextDue <= today : repeatOccursOn(t.repeat, today)))
      : t.deadline === today
  );
  const scheduleEmpty =
    !dayEvents.length && !dayReminders.length && !dueTodos.length && !overdueTodos.length;

  const isTodoDone = (t) => (t.repeat ? t.completedOn === today : t.done);

  // Dot colours: our own entries use the accent; the other side's use
  // its signature surface so they're unmistakable at a glance.
  const eventDot = (e) =>
    e.device ? DEVICE_GREY
      : e.owner === mode ? COLORS.espresso : paletteFor(e.owner).crema;
  const reminderDot = (r) =>
    r.owner === mode ? COLORS.gold : paletteFor(r.owner).crema;

  // --- Journal card ---
  const todayEntry = journal[today];
  const jStreak = currentStreak(new Set(Object.keys(journal)));
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  // If the companion is already nudging about journalling, a second
  // journal prompt right underneath just looks naggy — hide the card
  // until it has an actual entry to show.
  const JOURNAL_KINDS = new Set([
    'journal_gap', 'journal_streak', 'mood_dip', 'mood_up', 'recurring_topic',
  ]);
  const hideJournalCard = !!notice && JOURNAL_KINDS.has(notice.kind) && !todayEntry;

  // --- Rundown timing ---
  // The morning rundown owns the day until 5pm (or until you complete
  // it); the evening recap takes over at 5pm. Whichever is "current"
  // shows large while it's still open, and collapses to a strip once
  // done (or before its day-part gets going).
  const hour = new Date().getHours();
  const rd = (rundown || {})[today] || {};
  const current = hour >= 17 ? 'evening' : 'morning';
  const bigNow = current === 'morning'
    ? (hour >= 6 && !rd.morningDone)
    : !rd.eveningDone;

  // The rundown spans your WHOLE day — Life + Work together — so it
  // builds its own cross-side picture (the other Home cards stay
  // per-side).
  const rdDayEvents = [
    ...(allEvents || []).filter((e) => eventOccursOn(e, today)),
    ...deviceEvents.filter((e) => eventOccursOn(e, today)),
  ].sort((a, b) => ((a.time || '') < (b.time || '') ? -1 : 1));
  const rdDayReminders = (allReminders || []).filter((r) => reminderOccursOn(r, today));
  const rdOverdue = (allTodos || []).filter((t) => !t.repeat && !t.done && t.deadline && t.deadline < today);
  const rdDue = (allTodos || []).filter((t) =>
    t.repeat
      ? (t.completedOn === today ||
         (t.repeat.type === 'rolling' ? t.nextDue <= today : repeatOccursOn(t.repeat, today)))
      : t.deadline === today
  );
  const rdActionable = [...rdOverdue, ...rdDue.filter((t) => !isTodoDone(t))];
  const rdEveningTodos = [...rdOverdue, ...rdDue];
  const rdOpenHabits = (allHabits || []).filter((h) => h.lastDone !== today).length;
  const focusTodos = rdActionable; // starred in the morning
  const sideTag = (s) => (s && s !== mode ? (s === 'work' ? 'Work' : 'Life') : null);

  function openMorning() {
    setIntentionDraft(rd.intention || '');
    setFocusDraft(rd.focusIds || []);
    setFlow('morning');
  }
  function openEvening() {
    setAchievedDraft(rd.achieved || null);
    setReflectionDraft(rd.reflection || '');
    setFlow('evening');
  }
  function toggleFocus(id) {
    setFocusDraft((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id)
        : prev.length >= 3 ? prev : [...prev, id]
    );
  }
  function saveMorning() {
    onSaveMorning(today, { intention: intentionDraft.trim(), focusIds: focusDraft });
    setFlow(null);
  }
  function saveEvening() {
    onSaveEvening(today, { achieved: achievedDraft, reflection: reflectionDraft.trim() });
    setFlow(null);
  }

  // A tapped 7am/7pm notification opens straight into its flow.
  useEffect(() => {
    if (launchFlow === 'morning') { openMorning(); onFlowConsumed(); }
    else if (launchFlow === 'evening') { openEvening(); onFlowConsumed(); }
  }, [launchFlow]);

  const ACHIEVED = [
    { id: 'yes', label: 'Yes', emoji: '🎯' },
    { id: 'partly', label: 'Partly', emoji: '🌤️' },
    { id: 'no', label: 'Not really', emoji: '🌱' },
  ];
  const achievedLabel = (a) => (ACHIEVED.find((x) => x.id === a) || {}).label;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* switch mark top left · greeting · settings cog top right */}
      <View style={styles.headerRow}>
        <View style={styles.switchWrap}>
          <SwitchMark target={otherMode} onPress={() => setShowSwitch(true)} />
        </View>
        <View style={{ flex: 1 }}>
          <ScreenHeader
            title={name ? `${greetingLabel()}, ${name}` : 'Organize'}
            subtitle={niceDate()}
          />
        </View>
        <TouchableOpacity
          style={styles.cog}
          onPress={openSettings}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={22} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* --- Morning rundown / evening recap --- */}
        {bigNow && current === 'morning' ? (
          <TouchableOpacity style={styles.runBig} onPress={openMorning} activeOpacity={0.9}>
            <Text style={styles.runEyebrow}>☀️  MORNING RUNDOWN</Text>
            {rd.morningDone ? (
              <View>
                <Text style={styles.runTitle}>You're set for today.</Text>
                {!!rd.intention && <Text style={styles.runIntention}>“{rd.intention}”</Text>}
                <Text style={styles.runAction}>Review or edit ›</Text>
              </View>
            ) : (
              <View>
                <Text style={styles.runTitle}>Plan your day, {name || 'friend'}.</Text>
                <Text style={styles.runMeta}>
                  {rdActionable.length} to-do{rdActionable.length === 1 ? '' : 's'} · {rdDayEvents.length} event{rdDayEvents.length === 1 ? '' : 's'} today
                </Text>
                <View style={styles.runBtn}><Text style={styles.runBtnText}>Start rundown</Text></View>
              </View>
            )}
          </TouchableOpacity>
        ) : bigNow && current === 'evening' ? (
          <TouchableOpacity style={styles.runBig} onPress={openEvening} activeOpacity={0.9}>
            <Text style={styles.runEyebrow}>🌙  EVENING RECAP</Text>
            {rd.eveningDone ? (
              <View>
                <Text style={styles.runTitle}>Day wrapped.</Text>
                {rd.achieved && <Text style={styles.runIntention}>Went how you hoped? {achievedLabel(rd.achieved)}.</Text>}
                <Text style={styles.runAction}>Review or edit ›</Text>
              </View>
            ) : (
              <View>
                <Text style={styles.runTitle}>How did today go?</Text>
                <Text style={styles.runMeta}>
                  {rdOpenHabits} habit{rdOpenHabits === 1 ? '' : 's'} · {rdActionable.length} to-do{rdActionable.length === 1 ? '' : 's'} still open
                </Text>
                <View style={styles.runBtn}><Text style={styles.runBtnText}>Start recap</Text></View>
              </View>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={styles.runStrip}
            onPress={() => (current === 'morning' ? openMorning() : openEvening())}
            activeOpacity={0.8}
          >
            <Text style={styles.runStripText}>
              {current === 'morning' ? '☀️  Morning rundown' : '🌙  Evening recap'}
            </Text>
            <Text style={styles.runStripRight}>
              {(current === 'morning' ? rd.morningDone : rd.eveningDone) ? '✓ done' : 'tap to open ›'}
            </Text>
          </TouchableOpacity>
        )}

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
                <View style={[styles.lineDot, { backgroundColor: eventDot(e) }]} />
                <Text style={styles.lineText} numberOfLines={1}>{e.title}</Text>
                <Text style={styles.lineMeta}>{e.time || 'all day'}</Text>
              </View>
            ))}
            {dayReminders.map((r) => (
              <View key={r.id} style={styles.lineRow}>
                <View style={[styles.lineDot, { backgroundColor: reminderDot(r) }]} />
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
        {!hideJournalCard && (
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
        )}
      </ScrollView>

      {/* ================= Switch sides ================= */}
      <ModalShell
        visible={showSwitch}
        onClose={() => setShowSwitch(false)}
        title={
          <Text>
            Switch to Organize<Text style={styles.switchItalic}> {otherMode === 'work' ? 'Work' : 'Life'}</Text>?
          </Text>
        }
      >
        <View>
          <Text style={styles.switchBlurb}>
            {otherMode === 'work'
              ? 'Same place, sharper suit — your work to-dos, habits, goals and journal live separately over there.'
              : 'Back to the coffee side — everything personal, kept apart from work.'}
          </Text>
          <TouchableOpacity
            style={styles.switchBtn}
            onPress={() => { setShowSwitch(false); onSwitchMode(); }}
            activeOpacity={0.85}
          >
            <Text style={styles.switchBtnText}>Switch</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.switchGhost} onPress={() => setShowSwitch(false)}>
            <Text style={styles.switchGhostText}>Not now</Text>
          </TouchableOpacity>
        </View>
      </ModalShell>

      {/* ================= Settings ================= */}
      <ModalShell
        visible={showSettings}
        onClose={() => setShowSettings(false)}
        title="Settings"
      >
        <View>
          <Text style={styles.settingsLabel}>Your name</Text>
          <View style={styles.nameRow}>
            <TextInput
              style={styles.nameInput}
              placeholder="Your name"
              placeholderTextColor={COLORS.muted2}
              value={nameDraft}
              onChangeText={setNameDraft}
              onSubmitEditing={saveName}
              returnKeyType="done"
            />
            <TouchableOpacity style={styles.saveBtn} onPress={saveName}>
              <Text style={styles.saveBtnText}>Save</Text>
            </TouchableOpacity>
          </View>

          <Text style={[styles.settingsLabel, { marginTop: 20 }]}>Extras</Text>
          <TouchableOpacity style={styles.prefRow} onPress={onToggleNotify} activeOpacity={0.75}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Rundown reminders</Text>
              <Text style={styles.prefHint}>A nudge at 7am to plan your day and 7pm to recap it.</Text>
            </View>
            <View style={[styles.toggle, notifyOn && styles.toggleOn]}>
              <View style={[styles.knob, notifyOn && styles.knobOn]} />
            </View>
          </TouchableOpacity>

          <View style={styles.dangerZone}>
            <Text style={styles.dangerLabel}>Danger zone</Text>
            <TouchableOpacity style={styles.dangerBtn} onPress={confirmReset}>
              <Text style={styles.dangerBtnText}>Reset all data</Text>
            </TouchableOpacity>
            <Text style={styles.dangerHint}>
              Erases everything on this phone and starts the app fresh.
            </Text>
          </View>
        </View>
      </ModalShell>

      {/* ================= Morning rundown (full screen) ================= */}
      <Modal visible={flow === 'morning'} animationType="slide" onRequestClose={() => setFlow(null)}>
        <FullPage>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.flowHead}>
              <TouchableOpacity onPress={() => setFlow(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.flowClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.flowTitle}>Morning rundown</Text>
              <TouchableOpacity onPress={saveMorning} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.flowSave}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.flowWrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.flowGreeting}>{greetingLabel()}{name ? `, ${name}` : ''}.</Text>
              <Text style={styles.flowDate}>{niceDate()}</Text>

              <Text style={styles.flowSection}>How do you want today to go?</Text>
              <TextInput
                style={styles.flowInput}
                placeholder="A calm, focused day…"
                placeholderTextColor={COLORS.muted2}
                value={intentionDraft}
                onChangeText={setIntentionDraft}
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.flowSection}>Today's to-dos</Text>
              <Text style={styles.flowHint}>Tap the star to set up to 3 as your focus.</Text>
              {focusTodos.length === 0 ? (
                <Text style={styles.flowQuiet}>Nothing due today — a clear run.</Text>
              ) : focusTodos.map((t) => (
                <View key={t.id} style={styles.focusRow}>
                  <TouchableOpacity onPress={() => toggleFocus(t.id)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                    <Ionicons
                      name={focusDraft.includes(t.id) ? 'star' : 'star-outline'}
                      size={22}
                      color={focusDraft.includes(t.id) ? COLORS.gold : COLORS.muted2}
                    />
                  </TouchableOpacity>
                  <Text style={styles.focusText} numberOfLines={2}>{t.title}</Text>
                  {sideTag(t.side) && <Text style={styles.sideTag}>{sideTag(t.side)}</Text>}
                </View>
              ))}

              <Text style={styles.flowSection}>On today</Text>
              {rdDayEvents.length === 0 && rdDayReminders.length === 0 ? (
                <Text style={styles.flowQuiet}>Nothing scheduled.</Text>
              ) : (
                <View>
                  {rdDayEvents.map((e) => (
                    <View key={e.id} style={styles.lineRow}>
                      <View style={[styles.lineDot, { backgroundColor: eventDot(e) }]} />
                      <Text style={styles.lineText} numberOfLines={1}>{e.title}</Text>
                      <Text style={styles.lineMeta}>{e.time || 'all day'}</Text>
                    </View>
                  ))}
                  {rdDayReminders.map((r) => (
                    <View key={r.id} style={styles.lineRow}>
                      <View style={[styles.lineDot, { backgroundColor: reminderDot(r) }]} />
                      <Text style={styles.lineText} numberOfLines={1}>{r.title}</Text>
                    </View>
                  ))}
                </View>
              )}

              <TouchableOpacity style={styles.flowBtn} onPress={saveMorning} activeOpacity={0.85}>
                <Text style={styles.flowBtnText}>Start the day</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </FullPage>
      </Modal>

      {/* ================= Evening recap (full screen) ================= */}
      <Modal visible={flow === 'evening'} animationType="slide" onRequestClose={() => setFlow(null)}>
        <FullPage>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.flowHead}>
              <TouchableOpacity onPress={() => setFlow(null)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.flowClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.flowTitle}>Evening recap</Text>
              <TouchableOpacity onPress={saveEvening} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.flowSave}>Done</Text>
              </TouchableOpacity>
            </View>

            <ScrollView contentContainerStyle={styles.flowWrap} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={styles.flowGreeting}>How did today go?</Text>

              <Text style={styles.flowSection}>Tick off your habits</Text>
              {(allHabits || []).length === 0 ? (
                <Text style={styles.flowQuiet}>No habits yet.</Text>
              ) : (allHabits || []).map((h) => {
                const done = h.lastDone === today;
                return (
                  <TouchableOpacity key={h.id} style={styles.tickRow} onPress={() => toggleHabitById(h.id)} activeOpacity={0.7}>
                    <View style={[styles.tickBox, done && styles.tickBoxOn]}>
                      {done && <Text style={styles.tickMark}>✓</Text>}
                    </View>
                    <Text style={[styles.tickText, done && styles.tickTextDone]} numberOfLines={1}>{h.name}</Text>
                    {sideTag(h.side) && <Text style={styles.sideTag}>{sideTag(h.side)}</Text>}
                  </TouchableOpacity>
                );
              })}

              <Text style={styles.flowSection}>Tick off your to-dos</Text>
              {rdEveningTodos.length === 0 ? (
                <Text style={styles.flowQuiet}>Nothing was due today.</Text>
              ) : rdEveningTodos.map((t) => (
                <TodoRow
                  key={t.id}
                  title={t.title}
                  done={isTodoDone(t)}
                  meta={
                    (focusDraft.includes(t.id) || (rd.focusIds || []).includes(t.id)) ? '★ focus'
                      : sideTag(t.side)
                  }
                  onToggle={() => toggleTodoById(t.id)}
                />
              ))}

              <Text style={styles.flowSection}>This morning you wanted:</Text>
              <Text style={styles.flowIntentionBack}>
                {rd.intention ? `“${rd.intention}”` : 'No intention set this morning.'}
              </Text>

              <Text style={styles.flowSection}>Did the day go how you hoped?</Text>
              <View style={styles.achievedRow}>
                {ACHIEVED.map((a) => (
                  <TouchableOpacity
                    key={a.id}
                    style={[styles.achievedChip, achievedDraft === a.id && styles.achievedChipOn]}
                    onPress={() => setAchievedDraft(a.id)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.achievedEmoji}>{a.emoji}</Text>
                    <Text style={[styles.achievedLabel, achievedDraft === a.id && styles.achievedLabelOn]}>{a.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput
                style={[styles.flowInput, { marginTop: 14 }]}
                placeholder="Anything you want to note about today… (optional)"
                placeholderTextColor={COLORS.muted2}
                value={reflectionDraft}
                onChangeText={setReflectionDraft}
                multiline
                textAlignVertical="top"
              />

              <TouchableOpacity style={styles.flowBtn} onPress={saveEvening} activeOpacity={0.85}>
                <Text style={styles.flowBtnText}>Wrap up the day</Text>
              </TouchableOpacity>
            </ScrollView>
          </KeyboardAvoidingView>
        </FullPage>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  // --- rundown card (large) + collapsed strip ---
  runBig: {
    backgroundColor: COLORS.espresso, borderRadius: 18,
    padding: 20, marginBottom: 14,
  },
  runEyebrow: { color: COLORS.crema, fontSize: 11.5, fontWeight: '800', letterSpacing: 1.5, marginBottom: 10 },
  runTitle: { color: COLORS.bg, fontSize: 22, fontWeight: '600', fontFamily: SERIF, lineHeight: 28 },
  runMeta: { color: COLORS.crema, fontSize: 14, marginTop: 6 },
  runIntention: { color: COLORS.crema, fontSize: 15, fontStyle: 'italic', fontFamily: SERIF, marginTop: 8, lineHeight: 22 },
  runBtn: {
    backgroundColor: COLORS.bg, borderRadius: 12, marginTop: 16,
    paddingVertical: 12, alignItems: 'center',
  },
  runBtnText: { color: COLORS.espresso, fontSize: 15.5, fontWeight: '800' },
  runAction: { color: COLORS.bg, fontSize: 13.5, fontWeight: '700', marginTop: 12, opacity: 0.85 },
  runStrip: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingVertical: 12, paddingHorizontal: 16, marginBottom: 14,
  },
  runStripText: { color: COLORS.ink, fontSize: 14.5, fontWeight: '700' },
  runStripRight: { color: COLORS.espressoLight, fontSize: 13, fontWeight: '700' },

  // --- full-screen flow ---
  flowHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  flowClose: { color: COLORS.muted, fontSize: 17, fontWeight: '600' },
  flowTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  flowSave: { color: COLORS.espresso, fontSize: 16, fontWeight: '700' },
  flowWrap: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 36 },
  flowGreeting: { color: COLORS.ink, fontSize: 25, fontWeight: '600', fontFamily: SERIF },
  flowDate: { color: COLORS.muted, fontSize: 14.5, marginTop: 3 },
  flowSection: { color: COLORS.ink, fontSize: 16.5, fontWeight: '700', fontFamily: SERIF, marginTop: 24, marginBottom: 6 },
  flowHint: { color: COLORS.muted2, fontSize: 12.5, marginBottom: 8 },
  flowQuiet: { color: COLORS.muted, fontSize: 14, marginTop: 2 },
  flowInput: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13,
    color: COLORS.ink, fontSize: 16, lineHeight: 23, minHeight: 76, marginTop: 6,
  },
  focusRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    paddingVertical: 9,
  },
  focusText: { color: COLORS.ink, fontSize: 15.5, flex: 1 },
  sideTag: {
    color: COLORS.muted2, fontSize: 11, fontWeight: '700',
    fontStyle: 'italic', fontFamily: SERIF, marginLeft: 8,
  },
  tickRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 9 },
  tickBox: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2,
    borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center',
  },
  tickBoxOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  tickMark: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },
  tickText: { color: COLORS.ink, fontSize: 15.5, flex: 1 },
  tickTextDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  flowIntentionBack: {
    color: COLORS.espressoLight, fontSize: 15.5, fontStyle: 'italic',
    fontFamily: SERIF, lineHeight: 23, marginTop: 2,
  },
  achievedRow: { flexDirection: 'row', gap: 8, marginTop: 6 },
  achievedChip: {
    flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 14,
    borderWidth: 1, borderColor: COLORS.lineStrong, backgroundColor: COLORS.panel,
  },
  achievedChipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  achievedEmoji: { fontSize: 20 },
  achievedLabel: { color: COLORS.muted, fontSize: 13, fontWeight: '700', marginTop: 4 },
  achievedLabelOn: { color: COLORS.bg },
  flowBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 28,
  },
  flowBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: '700' },

  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  switchWrap: { paddingTop: 16, marginRight: 12 },
  cog: { paddingTop: 18, paddingLeft: 10 },

  switchItalic: { fontStyle: 'italic', color: COLORS.espressoLight },
  switchBlurb: { color: COLORS.muted, fontSize: 14.5, lineHeight: 21, marginBottom: 16 },
  switchBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center',
  },
  switchBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: '700' },
  switchGhost: { alignItems: 'center', paddingVertical: 13 },
  switchGhostText: { color: COLORS.muted2, fontSize: 14.5, fontWeight: '600' },

  settingsLabel: { color: COLORS.ink, fontSize: 14.5, fontWeight: '700', marginBottom: 8 },
  nameRow: { flexDirection: 'row', gap: 8 },
  nameInput: {
    flex: 1, backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12,
    color: COLORS.ink, fontSize: 15.5,
  },
  saveBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingHorizontal: 18, justifyContent: 'center',
  },
  saveBtnText: { color: COLORS.bg, fontSize: 14.5, fontWeight: '700' },

  prefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 10,
  },
  prefTitle: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
  prefHint: { color: COLORS.muted2, fontSize: 12, marginTop: 2 },
  toggle: {
    width: 46, height: 28, borderRadius: 14, padding: 3,
    backgroundColor: COLORS.mode === 'work' ? 'rgba(201,205,214,0.15)' : 'rgba(59,44,30,0.15)',
  },
  toggleOn: { backgroundColor: COLORS.espresso },
  knob: { width: 22, height: 22, borderRadius: 11, backgroundColor: COLORS.panel },
  knobOn: { marginLeft: 18 },

  dangerZone: {
    marginTop: 22, paddingTop: 16,
    borderTopWidth: 1, borderTopColor: COLORS.line,
  },
  dangerLabel: {
    color: COLORS.danger, fontSize: 11.5, fontWeight: '800',
    letterSpacing: 1.4, textTransform: 'uppercase', marginBottom: 10,
  },
  dangerBtn: {
    borderWidth: 1.5, borderColor: COLORS.danger, borderRadius: 14,
    paddingVertical: 13, alignItems: 'center',
  },
  dangerBtnText: { color: COLORS.danger, fontSize: 15, fontWeight: '700' },
  dangerHint: { color: COLORS.muted2, fontSize: 12.5, marginTop: 9, textAlign: 'center' },

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
    borderColor: COLORS.lineStrong, borderRadius: 16,
    padding: 16, marginBottom: 14,
  },
  journalText: {
    color: COLORS.mode === 'work' ? '#d6d9e0' : '#4b3d2c',
    fontSize: 14.5, lineHeight: 21,
  },
  journalPrompt: {
    color: COLORS.mode === 'work' ? '#d6d9e0' : '#4b3d2c',
    fontSize: 15, fontStyle: 'italic', fontFamily: SERIF, lineHeight: 22,
  },
  streakTag: {
    color: COLORS.espressoLight, fontSize: 12, fontWeight: '700',
    borderWidth: 1, borderColor: COLORS.lineStrong,
    paddingHorizontal: 9, paddingVertical: 2, borderRadius: 999,
  },
});
