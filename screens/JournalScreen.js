// =====================================================================
//  Journal tab
//  One entry per day, with an optional one-tap mood. The calendar
//  shows a dot on every day you wrote; tap a day to read or edit it.
//  The ＋ at the bottom opens today's entry.
// =====================================================================

import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, SERIF } from '../theme';
import { todayKey, niceDate, currentStreak } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import ModalShell from '../components/ModalShell';
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

export default function JournalScreen({ journal, saveEntry, deleteEntry }) {
  const today = todayKey();
  const [editingKey, setEditingKey] = useState(null); // day being written/read
  const [draft, setDraft] = useState('');
  const [mood, setMood] = useState(null);

  const entryDays = new Set(Object.keys(journal));
  const streak = currentStreak(entryDays);
  const todayEntry = journal[today];
  const prompt = PROMPTS[new Date().getDate() % PROMPTS.length];

  function openDay(key) {
    if (key > today) return; // can't journal the future
    const existing = journal[key];
    setDraft(existing ? existing.text : '');
    setMood(existing ? existing.mood : null);
    setEditingKey(key);
  }

  function onSave() {
    const text = draft.trim();
    if (!text) { setEditingKey(null); return; }
    saveEntry(editingKey, { text, mood });
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

  // Dot on every day that has an entry.
  const dots = {};
  entryDays.forEach((k) => { dots[k] = [COLORS.espressoLight]; });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader
        title="Journal"
        subtitle={streak > 1 ? `${streak}-day streak — keep it going` : 'A few honest lines a day'}
      />

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

      <FAB onPress={() => openDay(today)} />

      {/* ================= Write / read pop-up ================= */}
      <ModalShell
        visible={!!editingKey}
        onClose={() => setEditingKey(null)}
        title={editingKey === today ? 'Today' : editingKey ? niceDate(editingKey) : ''}
      >
        <View>
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

          <TextInput
            style={styles.entryInput}
            placeholder={prompt}
            placeholderTextColor={COLORS.muted2}
            value={draft}
            onChangeText={setDraft}
            multiline
            textAlignVertical="top"
            autoFocus
          />

          <View style={styles.btnRow}>
            {journal[editingKey] ? (
              <TouchableOpacity onPress={onDelete}>
                <Text style={styles.deleteBtn}>Delete</Text>
              </TouchableOpacity>
            ) : <View />}
            <TouchableOpacity
              style={[styles.primaryBtn, !draft.trim() && { opacity: 0.4 }]}
              onPress={onSave}
              disabled={!draft.trim()}
            >
              <Text style={styles.primaryBtnText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ModalShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  todayCard: {
    backgroundColor: COLORS.crema, borderWidth: 1,
    borderColor: 'rgba(75,54,38,0.2)', borderRadius: 16,
    padding: 18, marginBottom: 14,
  },
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

  // --- pop-up ---
  moodRow: { flexDirection: 'row', gap: 7, marginBottom: 12, flexWrap: 'wrap' },
  moodChip: {
    alignItems: 'center', borderWidth: 1, borderColor: COLORS.lineStrong,
    borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10,
    backgroundColor: COLORS.panel, flexDirection: 'row', gap: 5,
  },
  moodChipOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  moodEmoji: { fontSize: 14 },
  moodLabel: { color: COLORS.muted, fontSize: 12.5, fontWeight: '600' },
  moodLabelOn: { color: COLORS.bg },

  entryInput: {
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, padding: 14, minHeight: 140, maxHeight: 260,
    color: COLORS.ink, fontSize: 15.5, lineHeight: 22, marginBottom: 14,
  },

  btnRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  deleteBtn: { color: COLORS.danger, fontSize: 15, fontWeight: '600' },
  primaryBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 12, paddingHorizontal: 28, alignItems: 'center',
  },
  primaryBtnText: { color: COLORS.bg, fontSize: 15.5, fontWeight: '700' },
});
