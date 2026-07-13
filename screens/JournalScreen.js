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
import { Ionicons } from '@expo/vector-icons';
import { useThemedStyles, SERIF } from '../theme';
import { todayKey, niceDate, addDays, currentStreak } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import CalendarPager from '../components/CalendarPager';
import ModalShell from '../components/ModalShell';
import FullPage from '../components/FullPage';
import FAB from '../components/FAB';

// tone drives the "3× this week" reflection: good moods get encouraged,
// bad ones get nudged toward a fix. (The original five keep their ids
// so older entries still resolve.)
export const MOODS = [
  { id: 'driven', label: 'Driven', emoji: '🔥', tone: 'good' },
  { id: 'happy', label: 'Happy', emoji: '😄', tone: 'good' },
  { id: 'grateful', label: 'Grateful', emoji: '🙏', tone: 'good' },
  { id: 'excited', label: 'Excited', emoji: '✨', tone: 'good' },
  { id: 'proud', label: 'Proud', emoji: '🏅', tone: 'good' },
  { id: 'calm', label: 'Calm', emoji: '🌿', tone: 'good' },
  { id: 'loved', label: 'Loved', emoji: '🥰', tone: 'good' },
  { id: 'focused', label: 'Focused', emoji: '🎯', tone: 'good' },
  { id: 'steady', label: 'Steady', emoji: '☀️', tone: 'good' },
  { id: 'meh', label: 'Meh', emoji: '😐', tone: 'bad' },
  { id: 'tired', label: 'Tired', emoji: '😴', tone: 'bad' },
  { id: 'stressed', label: 'Stressed', emoji: '😖', tone: 'bad' },
  { id: 'anxious', label: 'Anxious', emoji: '😬', tone: 'bad' },
  { id: 'overwhelmed', label: 'Overwhelmed', emoji: '🌊', tone: 'bad' },
  { id: 'sad', label: 'Sad', emoji: '🌧️', tone: 'bad' },
  { id: 'angry', label: 'Angry', emoji: '😤', tone: 'bad' },
  { id: 'low', label: 'Low', emoji: '🌫️', tone: 'bad' },
];

const moodById = (id) => MOODS.find((m) => m.id === id);
const moodIdsOf = (entry) =>
  (entry && (entry.moods || (entry.mood ? [entry.mood] : []))) || [];

// A gentle nudge for the blank page (rotates by day of month).
const PROMPTS = [
  'What gave you energy today?',
  'What is one thing you did well today?',
  'What would make tomorrow feel lighter?',
  'What are you grateful for right now?',
  'What did today teach you?',
];

const STEP_PROMPT = 'One step at a time — what step did you take today?';

// The guided-journal format, editable in the tab's settings cog. The
// titles are laid onto the page as headings — one open page, so the
// finished entry reads as a single piece.
export const DEFAULT_GUIDED_SECTIONS = [
  { id: 'gratitude', title: 'Gratitude — five things from today' },
  { id: 'well', title: 'What went well today?' },
  { id: 'improve', title: 'What could be improved?' },
  { id: 'action', title: 'How will you go about that improvement?' },
  { id: 'free', title: 'Free thoughts' },
];

export default function JournalScreen({
  journal, saveEntry, deleteEntry,
  steps, saveStep, deleteStep, goals,
  journalSeed, onSeedConsumed,
  guidedOn, onToggleGuided, guidedSections, onSetGuidedSections,
}) {
  const { COLORS, styles } = useThemedStyles(makeStyles);
  const today = todayKey();
  const [part, setPart] = useState('today'); // 'today' | 'goals'
  const [editingKey, setEditingKey] = useState(null); // day being written/read
  const [draft, setDraft] = useState('');
  const [draftMoods, setDraftMoods] = useState([]); // multi-select
  const [seedPrompt, setSeedPrompt] = useState(null); // companion question → composer

  // The guided flow: moods → (mood reflections) → one page per section
  // → the final page where it all ties together. null = plain page.
  const [flowSteps, setFlowSteps] = useState(null);
  const [stepIdx, setStepIdx] = useState(0);
  const [stepText, setStepText] = useState('');
  const [blocks, setBlocks] = useState([]);     // answered {title, text}, in order
  const [pageBaseline, setPageBaseline] = useState('');
  const [stepKey, setStepKey] = useState(null); // day whose step is open
  const [stepDraft, setStepDraft] = useState('');

  // --- Guided journaling ---
  const [showPrefs, setShowPrefs] = useState(false);
  const [newSection, setNewSection] = useState('');

  // --- The guided flow's moving parts ---

  // How often has each currently-selected mood come up in the last
  // week? (Today's selection counts as one.)
  function moodWeekCounts() {
    const counts = {};
    draftMoods.forEach((id) => { counts[id] = 1; });
    for (let i = 1; i <= 6; i++) {
      const e = journal[addDays(today, -i)];
      moodIdsOf(e).forEach((id) => { if (counts[id] != null) counts[id] += 1; });
    }
    return counts;
  }

  const reflectHeading = (m) =>
    m.tone === 'good'
      ? `What's been making you feel ${m.label.toLowerCase()}?`
      : `What's behind feeling ${m.label.toLowerCase()}?`;

  function stepNext() {
    const cur = flowSteps[stepIdx];
    let steps = flowSteps;
    let newBlocks = blocks;

    if (cur.kind === 'moods') {
      // A mood that's come up 3+ times this week earns its own moment.
      const counts = moodWeekCounts();
      const reflects = draftMoods
        .filter((id) => counts[id] >= 3)
        .slice(0, 2)
        .map((id) => ({ kind: 'reflect', mood: moodById(id), count: counts[id] }));
      steps = [...flowSteps];
      steps.splice(stepIdx + 1, 0, ...reflects);
      setFlowSteps(steps);
    } else if (stepText.trim()) {
      const title = cur.kind === 'reflect' ? reflectHeading(cur.mood) : cur.section.title;
      newBlocks = [...blocks, { title, text: stepText.trim() }];
      setBlocks(newBlocks);
    }

    const ni = stepIdx + 1;
    if (steps[ni].kind === 'page') {
      // Tie it all together: everything answered, as one open page,
      // with the final section's heading waiting at the bottom.
      const lastTitle = guidedSections.length
        ? guidedSections[guidedSections.length - 1].title
        : 'Free thoughts';
      const body = newBlocks.map((b) => `${b.title}\n${b.text}`).join('\n\n');
      const text = (body ? `${body}\n\n` : '') + `${lastTitle}\n\n`;
      setDraft(text);
      setPageBaseline(text);
    }
    setStepText('');
    setStepIdx(ni);
  }

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
    setDraftMoods(moodIdsOf(existing));
    setSeedPrompt(seed);
    setBlocks([]);
    setStepText('');
    setPageBaseline('');
    if (!existing && guidedOn && !seed) {
      // Fresh guided entry → the step-by-step flow.
      const sectionSteps = guidedSections.slice(0, -1).map((s) => ({ kind: 'section', section: s }));
      setFlowSteps([{ kind: 'moods' }, ...sectionSteps, { kind: 'page' }]);
      setStepIdx(0);
      setDraft('');
    } else {
      // Existing entries (and companion questions) open as one page.
      setFlowSteps(null);
      setDraft(existing ? existing.text : '');
    }
    setEditingKey(key);
  }

  const currentStep = flowSteps ? flowSteps[stepIdx] : null;
  const onStepScreens = !!currentStep && currentStep.kind !== 'page';

  // A sheet nobody wrote on isn't an entry yet.
  const squash = (t) => (t || '').replace(/\s+/g, ' ').trim();
  const canSave = !onStepScreens && !!draft.trim() &&
    (!flowSteps || blocks.length > 0 || squash(draft) !== squash(pageBaseline));

  // Style the section titles as real headings while writing: any line
  // that IS one of the guided titles renders bold-italic serif, a
  // touch larger. The text itself stays plain — this is display only.
  // Mood-reflection headings from this session count too.
  const headingSet = new Set([
    ...guidedSections.map((s) => s.title.trim()),
    ...blocks.map((b) => b.title.trim()),
  ]);
  function styledDraft() {
    const lines = draft.split('\n');
    return lines.map((line, i) => {
      const text = i < lines.length - 1 ? `${line}\n` : line;
      return headingSet.has(line.trim()) && line.trim()
        ? <Text key={i} style={styles.pageHeading}>{text}</Text>
        : <Text key={i}>{text}</Text>;
    });
  }

  function onSave() {
    const text = draft.trim();
    if (text) {
      saveEntry(editingKey, { text, mood: draftMoods[0] || null, moods: draftMoods });
    }
    setEditingKey(null);
  }

  function toggleMood(id) {
    setDraftMoods((prev) =>
      prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id]
    );
  }

  // --- Guided-format editing (the settings cog) ---
  function removeSection(id) {
    onSetGuidedSections(guidedSections.filter((s) => s.id !== id));
  }
  function addSection() {
    const t = newSection.trim();
    if (!t) return;
    onSetGuidedSections([...guidedSections, { id: `custom-${Date.now()}`, title: t, prompt: '' }]);
    setNewSection('');
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

  const moodsOf = (key) => moodIdsOf(journal[key]).map(moodById).filter(Boolean);

  // Dot on every day that has an entry (espresso) / a step (gold).
  const dots = {};
  entryDays.forEach((k) => { dots[k] = [COLORS.espressoLight]; });
  const stepDots = {};
  stepDays.forEach((k) => { stepDots[k] = [COLORS.gold]; });

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.headerRow}>
        <View style={{ flex: 1 }}>
          <ScreenHeader
            title="Journal"
            subtitle={streak > 1 ? `${streak}-day streak — keep it going` : 'A few honest lines a day'}
          />
        </View>
        <TouchableOpacity
          style={styles.cog}
          onPress={() => setShowPrefs(true)}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="settings-outline" size={22} color={COLORS.muted} />
        </TouchableOpacity>
      </View>

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
              {todayEntry && moodsOf(today).length > 0 && (
                <Text style={styles.moodTag}>
                  {moodsOf(today).map((m) => m.emoji).join(' ')}
                  {moodsOf(today).length === 1 ? ` ${moodsOf(today)[0].label}` : ''}
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

      {/* ============ Journal settings (the cog) ============ */}
      <ModalShell
        visible={showPrefs}
        onClose={() => setShowPrefs(false)}
        title="Journal settings"
      >
        <View>
          <TouchableOpacity style={styles.prefRow} onPress={onToggleGuided} activeOpacity={0.75}>
            <View style={{ flex: 1 }}>
              <Text style={styles.prefTitle}>Guided journaling</Text>
              <Text style={styles.prefHint}>
                New entries start with your section headings laid on the page.
              </Text>
            </View>
            <View style={[styles.toggle, guidedOn && styles.toggleOn]}>
              <View style={[styles.knob, guidedOn && styles.knobOn]} />
            </View>
          </TouchableOpacity>

          {guidedOn && (
            <View>
              <Text style={styles.secLabel}>Sections</Text>
              <ScrollView style={styles.secList} showsVerticalScrollIndicator={false}>
                {guidedSections.map((s) => (
                  <View key={s.id} style={styles.secRow}>
                    <Text style={styles.secTitle} numberOfLines={1}>{s.title}</Text>
                    <TouchableOpacity
                      onPress={() => removeSection(s.id)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.secRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
              <View style={styles.addRow}>
                <TextInput
                  style={styles.addInput}
                  placeholder="Add a section…"
                  placeholderTextColor={COLORS.muted2}
                  value={newSection}
                  onChangeText={setNewSection}
                  onSubmitEditing={addSection}
                  returnKeyType="done"
                />
                <TouchableOpacity style={styles.addBtn} onPress={addSection}>
                  <Text style={styles.addBtnText}>Add</Text>
                </TouchableOpacity>
              </View>
              <TouchableOpacity onPress={() => onSetGuidedSections(DEFAULT_GUIDED_SECTIONS)}>
                <Text style={styles.resetLink}>Restore default sections</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </ModalShell>

      {/* ============ Full-page write / read ============ */}
      <Modal
        visible={!!editingKey}
        animationType="slide"
        onRequestClose={() => setEditingKey(null)}
      >
        <FullPage>
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
              {onStepScreens ? (
                <Text style={styles.stepCount}>{stepIdx + 1} / {flowSteps.length}</Text>
              ) : (
                <TouchableOpacity
                  onPress={onSave}
                  disabled={!canSave}
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                >
                  <Text style={[styles.pageSave, !canSave && { opacity: 0.35 }]}>Save</Text>
                </TouchableOpacity>
              )}
            </View>

            {onStepScreens ? (
              /* ---- the guided flow, one step at a time ---- */
              <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={styles.stepWrap}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                {currentStep.kind === 'moods' && (
                  <View>
                    <Text style={styles.stepTitle}>How are you feeling?</Text>
                    <Text style={styles.stepSub}>Pick as many as fit today.</Text>
                    <View style={styles.moodsGrid}>
                      {MOODS.map((m) => (
                        <TouchableOpacity
                          key={m.id}
                          style={[styles.moodChip, draftMoods.includes(m.id) && styles.moodChipOn]}
                          onPress={() => toggleMood(m.id)}
                        >
                          <Text style={styles.moodEmoji}>{m.emoji}</Text>
                          <Text style={[styles.moodLabel, draftMoods.includes(m.id) && styles.moodLabelOn]}>
                            {m.label}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}

                {currentStep.kind === 'reflect' && (
                  <View>
                    <Text style={styles.stepBadge}>
                      {currentStep.mood.emoji} {currentStep.count}× this week
                    </Text>
                    <Text style={styles.stepTitle}>{reflectHeading(currentStep.mood)}</Text>
                    <Text style={styles.stepSub}>
                      {currentStep.mood.tone === 'good'
                        ? `Feeling ${currentStep.mood.label.toLowerCase()} keeps showing up — that's worth noticing. Name what's behind it so you can keep it coming.`
                        : `It's come up ${currentStep.count} times in seven days. What do you think is causing it — and what's one small thing you could try to shift it?`}
                    </Text>
                    <TextInput
                      style={styles.stepInput}
                      placeholder="Write a few honest lines…"
                      placeholderTextColor={COLORS.muted2}
                      value={stepText}
                      onChangeText={setStepText}
                      multiline
                      textAlignVertical="top"
                      autoFocus
                    />
                  </View>
                )}

                {currentStep.kind === 'section' && (
                  <View>
                    <Text style={styles.stepTitle}>{currentStep.section.title}</Text>
                    <TextInput
                      style={styles.stepInput}
                      placeholder="Write freely — or skip."
                      placeholderTextColor={COLORS.muted2}
                      value={stepText}
                      onChangeText={setStepText}
                      multiline
                      textAlignVertical="top"
                      autoFocus
                    />
                  </View>
                )}

                <TouchableOpacity style={styles.stepBtn} onPress={stepNext} activeOpacity={0.85}>
                  <Text style={styles.stepBtnText}>
                    {currentStep.kind === 'moods' || stepText.trim() ? 'Next' : 'Skip'}
                  </Text>
                </TouchableOpacity>
              </ScrollView>
            ) : (
              /* ---- the open page ---- */
              <View style={{ flex: 1 }}>
                {/* Mood chips — pick as many as apply */}
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.moodScroller}
                  contentContainerStyle={styles.moodRow}
                >
                  {MOODS.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      style={[styles.moodChip, draftMoods.includes(m.id) && styles.moodChipOn]}
                      onPress={() => toggleMood(m.id)}
                    >
                      <Text style={styles.moodEmoji}>{m.emoji}</Text>
                      <Text style={[styles.moodLabel, draftMoods.includes(m.id) && styles.moodLabelOn]}>
                        {m.label}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                {/* One open sheet — with guided headings styled in place.
                    If the companion asked something, its question is the prompt. */}
                <TextInput
                  style={styles.page}
                  placeholder={seedPrompt || prompt}
                  placeholderTextColor={COLORS.muted2}
                  onChangeText={setDraft}
                  multiline
                  textAlignVertical="top"
                  autoFocus
                  scrollEnabled
                >
                  {draft ? <Text style={styles.pageBase}>{styledDraft()}</Text> : null}
                </TextInput>

                {/* Delete lives quietly at the foot of existing entries */}
                {journal[editingKey] && (
                  <TouchableOpacity onPress={onDelete} style={styles.deleteRow}>
                    <Text style={styles.deleteBtn}>Delete entry</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </KeyboardAvoidingView>
        </FullPage>
      </Modal>

      {/* ============ Full-page step composer (goals side) ============ */}
      <Modal
        visible={!!stepKey}
        animationType="slide"
        onRequestClose={() => setStepKey(null)}
      >
        <FullPage>
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
        </FullPage>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start' },
  cog: { paddingTop: 18, paddingLeft: 10 },

  // --- settings (the cog) ---
  prefRow: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12, marginBottom: 12,
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
  secLabel: {
    color: COLORS.muted2, fontSize: 11, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 8,
  },
  secList: {
    maxHeight: 190, backgroundColor: COLORS.panelDeep,
    borderWidth: 1, borderColor: COLORS.line, borderRadius: 14,
    paddingHorizontal: 14, paddingVertical: 4, marginBottom: 10,
  },
  secRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10,
  },
  secTitle: { color: COLORS.ink, fontSize: 14.5, flex: 1 },
  secRemove: { color: COLORS.muted2, fontSize: 14, fontWeight: '600' },
  addRow: { flexDirection: 'row', gap: 8 },
  addInput: {
    flex: 1, backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 14, paddingVertical: 11,
    color: COLORS.ink, fontSize: 14.5,
  },
  addBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingHorizontal: 16, justifyContent: 'center',
  },
  addBtnText: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },
  resetLink: {
    color: COLORS.espressoLight, fontSize: 13, fontWeight: '600',
    textAlign: 'center', paddingVertical: 12,
  },


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

  moodScroller: { flexGrow: 0, marginTop: 12, marginBottom: 4 },
  moodRow: { flexDirection: 'row', gap: 7, paddingHorizontal: 20, alignItems: 'center' },

  // --- the guided flow's step screens ---
  stepWrap: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 30 },
  stepCount: { color: COLORS.muted2, fontSize: 13.5, fontWeight: '700' },
  stepBadge: {
    alignSelf: 'flex-start', color: COLORS.espressoLight,
    fontSize: 12.5, fontWeight: '800', letterSpacing: 0.3,
    borderWidth: 1, borderColor: COLORS.lineStrong, borderRadius: 999,
    paddingHorizontal: 11, paddingVertical: 4, marginBottom: 12,
    backgroundColor: COLORS.panel,
  },
  stepTitle: {
    color: COLORS.ink, fontSize: 23, lineHeight: 30, fontWeight: '600',
    fontFamily: SERIF,
  },
  stepSub: { color: COLORS.muted, fontSize: 14.5, lineHeight: 21, marginTop: 8 },
  moodsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 18 },
  stepInput: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 16, paddingHorizontal: 16, paddingVertical: 13,
    color: COLORS.ink, fontSize: 16, lineHeight: 24, minHeight: 170,
    marginTop: 16,
  },
  stepBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 15, alignItems: 'center', marginTop: 22,
  },
  stepBtnText: { color: COLORS.bg, fontSize: 16, fontWeight: '700' },
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
  pageBase: { color: COLORS.ink, fontSize: 16.5, lineHeight: 25 },
  pageHeading: {
    color: COLORS.ink, fontSize: 19, lineHeight: 28,
    fontWeight: '700', fontStyle: 'italic', fontFamily: SERIF,
  },

  deleteRow: { alignItems: 'center', paddingVertical: 12 },
  deleteBtn: { color: COLORS.danger, fontSize: 14.5, fontWeight: '600' },
});
