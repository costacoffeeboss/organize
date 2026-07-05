// =====================================================================
//  Journal tab
//  One entry per day, with an optional one-tap mood. The calendar
//  shows a dot on every day you wrote; tap a day to read or edit it.
//  Writing opens a FULL page — a blank page invites more than a box.
// =====================================================================

import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import { todayKey, niceDate, currentStreak } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import CalendarPager from '../components/CalendarPager';
import FAB from '../components/FAB';

export const MOODS = [
  { id: 'driven', label: 'Driven', emoji: '🔥' },
  { id: 'steady', label: 'Steady', emoji: '☀️' },
  { id: 'calm', label: 'Calm', emoji: '🌿' },
  { id: 'tired', label: 'Tired', emoji: '😴' },
  { id: 'low', label: 'Low', emoji: '🌧️' },
];

// A gentle nudge for the blank page (rotates by day of month).
const PROMPTS = [
  'What gave you energy today?',
  'What is one thing you did well today?',
  'What would make tomorrow feel lighter?',
  'What are you grateful for right now?',
  'What did today teach you?',
];

const STEP_PROMPT = 'One step at a time — what step did you take today?';

export default function JournalScreen({
  journal, saveEntry, deleteEntry,
  steps, saveStep, deleteStep, goals,
  journalSeed, onSeedConsumed,
}) {
  const today = todayKey();
  const [part, setPart] = useState('today'); // 'today' | 'goals'
  const [editingKey, setEditingKey] = useState(null); // day being written/read
  const [draft, setDraft] = useState('');
  const [mood, setMood] = useState(null);
  const [seedPrompt, setSeedPrompt] = useState(null); // companion question → composer
  const [stepKey, setStepKey] = useState(null); // day whose step is open
  const [stepDraft, setStepDraft] = useState('');

  const entryDays = new Set(Object.keys(journal));
  const streak = currentStreak(entryDays);
  const todayEntry = journal[today];
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  const stepDays = new Set(Object.keys(steps || {}));
  const todayStep = (steps || {})[today];
  const activeGoals = (goals || []).filter((g) => !g.achievedOn);

  function openStep(key) {
    if (key > today) return;
    const existing = (steps || {})[key];
    setStepDraft(existing ? existing.text : '');
    setStepKey(key);
  }

  function onSaveStep() {
    const text = stepDraft.trim();
    if (text) saveStep(stepKey, text);
    setStepKey(null);
  }

  function onDeleteStep() {
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => { deleteStep(stepKey); setStepKey(null); } },
    ]);
  }

  // Home's companion card can send us here with its question in hand —
  // open today's page with that question as the prompt.
  useEffect(() => {
    if (journalSeed) {
      setPart('today');
      openDay(today, journalSeed);
      onSeedConsumed();
    }
  }, [journalSeed]);

  function openDay(key, seed = null) {
    if (key > today) return; // can't journal the future
    const existing = journal[key];
    setDraft(existing ? existing.text : '');
    setMood(existing ? existing.mood : null);
    setSeedPrompt(seed);
    setEditingKey(key);
  }

  function onSave() {
    const text = draft.trim();
    if (text) saveEntry(editingKey, { text, mood });
    setEditingKey(null);
  }

  function onDelete() {
    Alert.alert('Delete this entry?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: () => { deleteEntry(editingKey); setEditingKey(null); },
      },
    ]);
  }

  const moodOf = (key) => MOODS.find((m) => m.id === (journal[key] || {}).mood);

  // Dot on every day that has an entry (espresso) / a step (gold).
  const dots = {};
  entryDays.forEach((k) => { dots[k] = [COLORS.espressoLight]; });
  const stepDots = {};
  stepDays.forEach((k) => { stepDots[k] = [COLORS.gold]; });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Journal"
        subtitle={streak > 1 ? `${streak}-day streak — keep it going` : 'A few honest lines a day'}
      />

      {/* Today's reflections | steps toward your goals */}
      <View style={styles.segment}>
        {[['today', 'Today'], ['goals', 'Goals']].map(([id, label]) => (
          <TouchableOpacity
            key={id}
            style={[styles.segmentBtn, part === id && styles.segmentOn]}
            onPress={() => setPart(id)}
          >
            <Text style={[styles.segmentText, part === id && styles.segmentTextOn]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {part === 'today' ? (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Today's card: the entry if written, otherwise a gentle prompt */}
          <TouchableOpacity style={styles.todayCard} onPress={() => openDay(today)} activeOpacity={0.85}>
            <View style={styles.todayHead}>
              <Text style={styles.todayTitle}>Today</Text>
              {todayEntry && moodOf(today) && (
                <Text style={styles.moodTag}>
                  {moodOf(today).emoji} {moodOf(today).label}
                </Text>
              )}
            </View>
            {todayEntry ? (
              <Text style={styles.todayText} numberOfLines={4}>{todayEntry.text}</Text>
            ) : (
              <Text style={styles.promptText}>{prompt}</Text>
            )}
            <Text style={styles.todayAction}>
              {todayEntry ? 'Read or edit ›' : 'Write it down ›'}
            </Text>
          </TouchableOpacity>

          {/* The month of entries */}
          <View style={styles.card}>
            <CalendarPager dots={dots} maxKey={today} onSelect={openDay} />
          </View>
        </ScrollView>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {/* Today's step toward the goals */}
          <TouchableOpacity style={styles.stepCard} onPress={() => openStep(today)} activeOpacity={0.85}>
            <View style={styles.todayHead}>
              <Text style={styles.todayTitle}>Today's step</Text>
            </View>
            {todayStep ? (
              <Text style={styles.todayText} numberOfLines={4}>{todayStep.text}</Text>
            ) : (
              <Text style={styles.promptText}>{STEP_PROMPT}</Text>
            )}
            {activeGoals.length > 0 && (
              <View style={styles.goalChips}>
                {activeGoals.slice(0, 3).map((g) => (
                  <View key={g.id} style={styles.goalChip}>
                    <Text style={styles.goalChipText} numberOfLines={1}>⚑ {g.title}</Text>
                  </View>
                ))}
              </View>
            )}
            <Text style={styles.todayAction}>
              {todayStep ? 'Read or edit ›' : 'Note your step ›'}
            </Text>
          </TouchableOpacity>

          {/* The month of steps */}
          <View style={styles.card}>
            <CalendarPager dots={stepDots} maxKey={today} onSelect={openStep} />
          </View>
        </ScrollView>
      )}

      <FAB onPress={() => (part === 'today' ? openDay(today) : openStep(today))} />

      {/* ============ Full-page write / read ============ */}
      <Modal
        visible={!!editingKey}
        animationType="slide"
        onRequestClose={() => setEditingKey(null)}
      >
        <SafeAreaView style={styles.pageSafe} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            {/* Page header: close · date · save */}
            <View style={styles.pageHead}>
              <TouchableOpacity
                onPress={() => setEditingKey(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.pageClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.pageDate}>
                {editingKey === today ? 'Today' : editingKey ? niceDate(editingKey) : ''}
              </Text>
              <TouchableOpacity
                onPress={onSave}
                disabled={!draft.trim()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.pageSave, !draft.trim() && { opacity: 0.35 }]}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* Mood chips */}
            <View style={styles.moodRow}>
              {MOODS.map((m) => (
                <TouchableOpacity
                  key={m.id}
                  style={[styles.moodChip, mood === m.id && styles.moodChipOn]}
                  onPress={() => setMood(mood === m.id ? null : m.id)}
                >
                  <Text style={styles.moodEmoji}>{m.emoji}</Text>
                  <Text style={[styles.moodLabel, mood === m.id && styles.moodLabelOn]}>
                    {m.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* The page itself — all remaining space is for writing.
                If the companion asked something, its question is the prompt. */}
            <TextInput
              style={styles.page}
              placeholder={seedPrompt || prompt}
              placeholderTextColor={COLORS.muted2}
              value={draft}
              onChangeText={setDraft}
              multiline
              textAlignVertical="top"
              autoFocus
              scrollEnabled
            />

            {/* Delete lives quietly at the foot of existing entries */}
            {journal[editingKey] && (
              <TouchableOpacity onPress={onDelete} style={styles.deleteRow}>
                <Text style={styles.deleteBtn}>Delete entry</Text>
              </TouchableOpacity>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ============ Full-page step composer (goals side) ============ */}
      <Modal
        visible={!!stepKey}
        animationType="slide"
        onRequestClose={() => setStepKey(null)}
      >
        <SafeAreaView style={styles.pageSafe} edges={['top', 'bottom']}>
          <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          >
            <View style={styles.pageHead}>
              <TouchableOpacity
                onPress={() => setStepKey(null)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={styles.pageClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.pageDate}>
                {stepKey === today ? "Today's step" : stepKey ? niceDate(stepKey) : ''}
              </Text>
              <TouchableOpacity
                onPress={onSaveStep}
                disabled={!stepDraft.trim()}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
              >
                <Text style={[styles.pageSave, !stepDraft.trim() && { opacity: 0.35 }]}>Save</Text>
              </TouchableOpacity>
            </View>

            {/* the goals you're stepping toward, for reference */}
            {activeGoals.length > 0 && (
              <View style={[styles.goalChips, { paddingHorizontal: 20, paddingTop: 12 }]}>
                {activeGoals.slice(0, 3).map((g) => (
                  <View key={g.id} style={styles.goalChip}>
                    <Text style={styles.goalChipText} numberOfLines={1}>⚑ {g.title}</Text>
                  </View>
                ))}
              </View>
            )}

            <TextInput
              style={styles.page}
              placeholder={STEP_PROMPT}
              placeholderTextColor={COLORS.muted2}
              value={stepDraft}
              onChangeText={setStepDraft}
              multiline
              textAlignVertical="top"
              autoFocus
              scrollEnabled
            />

            {(steps || {})[stepKey] && (
              <TouchableOpacity onPress={onDeleteStep} style={styles.deleteRow}>
                <Text style={styles.deleteBtn}>Delete entry</Text>
              </TouchableOpacity>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  segment: {
    flexDirection: 'row', backgroundColor: COLORS.panelDeep,
    borderRadius: 12, padding: 4, marginBottom: 14,
    borderWidth: 1, borderColor: COLORS.line,
  },
  segmentBtn: { flex: 1, paddingVertical: 9, borderRadius: 9, alignItems: 'center' },
  segmentOn: { backgroundColor: COLORS.espresso },
  segmentText: { color: COLORS.muted, fontSize: 14, fontWeight: '600' },
  segmentTextOn: { color: COLORS.bg },

  todayCard: {
    backgroundColor: COLORS.crema, borderWidth: 1,
    borderColor: 'rgba(75,54,38,0.2)', borderRadius: 16,
    padding: 18, marginBottom: 14,
  },
  stepCard: {
    backgroundColor: COLORS.panel, borderWidth: 1,
    borderColor: 'rgba(184,135,75,0.45)', borderRadius: 16,
    padding: 18, marginBottom: 14,
  },
  goalChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 },
  goalChip: {
    borderWidth: 1, borderColor: 'rgba(184,135,75,0.5)',
    backgroundColor: 'rgba(184,135,75,0.1)', borderRadius: 999,
    paddingHorizontal: 10, paddingVertical: 4, maxWidth: '100%',
  },
  goalChipText: { color: COLORS.gold, fontSize: 12, fontWeight: '700' },
  todayHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  todayTitle: { color: COLORS.ink, fontSize: 18, fontWeight: '600', fontFamily: SERIF },
  moodTag: {
    color: COLORS.espressoLight, fontSize: 12.5, fontWeight: '700',
    borderWidth: 1, borderColor: 'rgba(75,54,38,0.3)',
    paddingHorizontal: 10, paddingVertical: 3, borderRadius: 999,
  },
  todayText: { color: '#4b3d2c', fontSize: 14.5, lineHeight: 21, marginTop: 10 },
  promptText: { color: '#4b3d2c', fontSize: 15, fontStyle: 'italic', marginTop: 10 },
  todayAction: { color: COLORS.espresso, fontSize: 13.5, fontWeight: '700', marginTop: 12 },

  card: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 16, padding: 14,
  },

  // --- full-page composer ---
  pageSafe: { flex: 1, backgroundColor: COLORS.bg },
  pageHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  pageClose: { color: COLORS.muted, fontSize: 17, fontWeight: '600' },
  pageDate: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  pageSave: { color: COLORS.espresso, fontSize: 16, fontWeight: '700' },

  moodRow: {
    flexDirection: 'row', gap: 7, flexWrap: 'wrap',
    paddingHorizontal: 20, paddingTop: 14, paddingBottom: 6,
  },
  moodChip: {
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.lineStrong,
    borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: COLORS.panel, flexDirection: 'row', gap: 5,
  },
  moodChipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  moodEmoji: { fontSize: 14 },
  moodLabel: { color: COLORS.muted, fontSize: 12.5, fontWeight: '600' },
  moodLabelOn: { color: COLORS.bg },

  page: {
    flex: 1, color: COLORS.ink, fontSize: 16.5, lineHeight: 25,
    paddingHorizontal: 20, paddingTop: 12, paddingBottom: 16,
  },

  deleteRow: { alignItems: 'center', paddingVertical: 12 },
  deleteBtn: { color: COLORS.danger, fontSize: 14.5, fontWeight: '600' },
});
