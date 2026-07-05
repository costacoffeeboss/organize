// =====================================================================
//  Goals tab
//  First visit: a short introduction to SMART goals. After that: your
//  goals as cards — progress bar from milestones, days-to-target —
//  with a guided creator that walks each letter of SMART:
//    S  what exactly will you achieve      → "specific"
//    M  how you'll measure it              → tickable milestones
//    A+R why it's realistic and matters    → "why"
//    T  when it's due                      → target date
// =====================================================================

import React, { useState, useEffect, useRef } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, ScrollView, Modal, Animated, Easing,
  KeyboardAvoidingView, Platform, Alert, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS, SERIF } from '../theme';
import { todayKey, shortDate, diffDays } from '../utils/dates';
import ScreenHeader from '../components/ScreenHeader';
import ModalShell from '../components/ModalShell';
import CalendarPager from '../components/CalendarPager';
import Rise from '../components/Rise';
import FAB from '../components/FAB';

const INTRO_KEY = '@organize_goals_intro_seen';

const SMART = [
  { letter: 'S', word: 'Specific', line: 'Name exactly what you will achieve — "run a 10k", not "get fitter".' },
  { letter: 'M', word: 'Measurable', line: 'Break it into milestones you can tick — progress you can see.' },
  { letter: 'A', word: 'Achievable', line: 'Stretch, but within reach. A goal you believe in gets worked on.' },
  { letter: 'R', word: 'Relevant', line: 'Know why it matters to you — that is what carries you on flat days.' },
  { letter: 'T', word: 'Time-bound', line: 'Give it a date. A goal without a deadline is a wish.' },
];

// ---------------------------------------------------------------------
//  The SMART explainer (first visit, and revisitable any time)
// ---------------------------------------------------------------------
function SmartIntro({ onStart }) {
  return (
    <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
      <Rise delay={0}>
        <Text style={styles.introHead}>
          Dream big.{'\n'}<Text style={styles.introAccent}>Plan small.</Text>
        </Text>
      </Rise>
      <Rise delay={150}>
        <Text style={styles.introSub}>
          Good goals aren't vague hopes — they're SMART. Five letters that turn
          "someday" into a plan:
        </Text>
      </Rise>
      {SMART.map((s, i) => (
        <Rise key={s.letter} delay={280 + i * 120}>
          <View style={styles.smartRow}>
            <View style={styles.smartBadge}>
              <Text style={styles.smartLetter}>{s.letter}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.smartWord}>{s.word}</Text>
              <Text style={styles.smartLine}>{s.line}</Text>
            </View>
          </View>
        </Rise>
      ))}
      <Rise delay={280 + SMART.length * 120 + 100}>
        <TouchableOpacity style={styles.primaryBtn} onPress={onStart} activeOpacity={0.85}>
          <Text style={styles.primaryBtnText}>Set your first goal</Text>
        </TouchableOpacity>
      </Rise>
    </ScrollView>
  );
}

// ---------------------------------------------------------------------

export default function GoalsScreen({
  goals, addGoal, toggleMilestone, markGoalAchieved, deleteGoal,
}) {
  const today = todayKey();
  const [introSeen, setIntroSeen] = useState(true); // assume seen until storage answers
  const [showIntroModal, setShowIntroModal] = useState(false);
  const [openId, setOpenId] = useState(null);

  // --- Creator state ---
  const [showCreate, setShowCreate] = useState(false);
  const [page, setPage] = useState('form'); // 'form' | 'date'
  const [title, setTitle] = useState('');
  const [specific, setSpecific] = useState('');
  const [why, setWhy] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [milestoneDraft, setMilestoneDraft] = useState('');
  const [targetDate, setTargetDate] = useState(null);

  useEffect(() => {
    AsyncStorage.getItem(INTRO_KEY)
      .then((v) => setIntroSeen(v === '1'))
      .catch(() => {});
  }, []);

  function startFirstGoal() {
    setIntroSeen(true);
    AsyncStorage.setItem(INTRO_KEY, '1').catch(() => {});
    openCreate();
  }

  function openCreate() {
    setPage('form'); setTitle(''); setSpecific(''); setWhy('');
    setMilestones([]); setMilestoneDraft(''); setTargetDate(null);
    setShowIntroModal(false); setShowCreate(true);
  }

  function addMilestoneDraft() {
    const t = milestoneDraft.trim();
    if (!t) return;
    setMilestones((prev) => [...prev, t]);
    setMilestoneDraft('');
  }

  const canSave = title.trim() && (milestones.length > 0 || milestoneDraft.trim()) && targetDate;

  function onCreate() {
    if (!canSave) return;
    const all = milestoneDraft.trim() ? [...milestones, milestoneDraft.trim()] : milestones;
    addGoal({ title: title.trim(), specific: specific.trim(), why: why.trim(), milestones: all, targetDate });
    setShowCreate(false);
  }

  function onLongPress(goal) {
    Alert.alert('Delete goal?', 'Its milestones go with it.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => deleteGoal(goal.id) },
    ]);
  }

  const active = goals.filter((g) => !g.achievedOn);
  const achieved = goals.filter((g) => g.achievedOn);
  const open = goals.find((g) => g.id === openId);
  const openDone = open ? open.milestones.filter((m) => m.done).length : 0;

  function daysLeftLabel(g) {
    if (g.achievedOn) return 'achieved ✓';
    if (!g.targetDate) return null;
    const d = diffDays(today, g.targetDate);
    if (d < 0) return `${-d}d over`;
    if (d === 0) return 'due today';
    return `${d}d left`;
  }

  function GoalCard({ goal }) {
    const done = goal.milestones.filter((m) => m.done).length;
    const total = goal.milestones.length;
    const pct = total === 0 ? 0 : Math.round((done / total) * 100);
    const overdue = !goal.achievedOn && goal.targetDate && goal.targetDate < today;
    const next = goal.milestones.find((m) => !m.done);
    return (
      <TouchableOpacity
        style={[styles.card, goal.achievedOn && styles.cardAchieved]}
        onPress={() => setOpenId(goal.id)}
        onLongPress={() => onLongPress(goal)}
        activeOpacity={0.85}
      >
        <View style={styles.cardHead}>
          <Text style={styles.cardTitle} numberOfLines={2}>{goal.title}</Text>
          <Text style={[styles.daysLeft, overdue && { color: COLORS.danger },
            goal.achievedOn && { color: COLORS.espresso }]}>
            {daysLeftLabel(goal)}
          </Text>
        </View>
        <View style={styles.barTrack}>
          <View style={[styles.barFill, { width: `${goal.achievedOn ? 100 : pct}%` }]} />
        </View>
        <Text style={styles.cardMeta}>
          {goal.achievedOn
            ? `Achieved ${shortDate(goal.achievedOn)}`
            : `${done} of ${total} milestones${next ? ` · next: ${next.text}` : ''}`}
        </Text>
      </TouchableOpacity>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScreenHeader title="Goals" subtitle="Dream big, plan small" />

      {!introSeen ? (
        <SmartIntro onStart={startFirstGoal} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
          {goals.length === 0 && (
            <Text style={styles.empty}>
              No goals yet. Tap ＋ to set one —{'\n'}five SMART questions and it's real.
            </Text>
          )}
          {active.map((g) => <GoalCard key={g.id} goal={g} />)}
          {achieved.length > 0 && (
            <View>
              <Text style={styles.sectionTitle}>Achieved</Text>
              {achieved.map((g) => <GoalCard key={g.id} goal={g} />)}
            </View>
          )}
          <TouchableOpacity onPress={() => setShowIntroModal(true)} style={styles.introLink}>
            <Text style={styles.introLinkText}>What makes a good goal? ›</Text>
          </TouchableOpacity>
        </ScrollView>
      )}

      {introSeen && <FAB onPress={openCreate} />}

      {/* ============ SMART refresher pop-up ============ */}
      <ModalShell
        visible={showIntroModal}
        onClose={() => setShowIntroModal(false)}
        title="SMART goals"
      >
        <View>
          {SMART.map((s) => (
            <View key={s.letter} style={[styles.smartRow, { marginBottom: 12 }]}>
              <View style={styles.smartBadge}>
                <Text style={styles.smartLetter}>{s.letter}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.smartWord}>{s.word}</Text>
                <Text style={styles.smartLine}>{s.line}</Text>
              </View>
            </View>
          ))}
        </View>
      </ModalShell>

      {/* ============ Full-page goal creator ============ */}
      <Modal visible={showCreate} animationType="slide" onRequestClose={() => setShowCreate(false)}>
        <SafeAreaView style={styles.pageSafe} edges={['top', 'bottom']}>
          <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <View style={styles.pageHead}>
              <TouchableOpacity onPress={() => setShowCreate(false)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={styles.pageClose}>✕</Text>
              </TouchableOpacity>
              <Text style={styles.pageTitle}>{page === 'date' ? 'Target date' : 'New goal'}</Text>
              <TouchableOpacity onPress={onCreate} disabled={!canSave} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
                <Text style={[styles.pageSave, !canSave && { opacity: 0.35 }]}>Save</Text>
              </TouchableOpacity>
            </View>

            {page === 'form' && (
              <ScrollView
                contentContainerStyle={styles.formPad}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
              >
                <Text style={styles.fieldLabel}>The goal</Text>
                <TextInput
                  style={styles.input}
                  placeholder="Run a 10k"
                  placeholderTextColor={COLORS.muted2}
                  value={title}
                  onChangeText={setTitle}
                />

                <View style={styles.letterRow}>
                  <View style={styles.smartBadgeSmall}><Text style={styles.smartLetterSmall}>S</Text></View>
                  <Text style={styles.fieldLabel}>What exactly will you achieve?</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.inputTall]}
                  placeholder="Finish the city 10k in under 65 minutes, running the whole way."
                  placeholderTextColor={COLORS.muted2}
                  value={specific}
                  onChangeText={setSpecific}
                  multiline
                />

                <View style={styles.letterRow}>
                  <View style={styles.smartBadgeSmall}><Text style={styles.smartLetterSmall}>M</Text></View>
                  <Text style={styles.fieldLabel}>Milestones — how you'll measure it</Text>
                </View>
                {milestones.map((m, i) => (
                  <View key={i} style={styles.milestoneRow}>
                    <Text style={styles.milestoneNum}>{i + 1}</Text>
                    <Text style={styles.milestoneText}>{m}</Text>
                    <TouchableOpacity
                      onPress={() => setMilestones((prev) => prev.filter((_, j) => j !== i))}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <Text style={styles.milestoneRemove}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
                <View style={styles.milestoneAdd}>
                  <TextInput
                    style={[styles.input, { flex: 1, marginBottom: 0 }]}
                    placeholder={milestones.length ? 'Another milestone…' : 'Run 3k without stopping'}
                    placeholderTextColor={COLORS.muted2}
                    value={milestoneDraft}
                    onChangeText={setMilestoneDraft}
                    onSubmitEditing={addMilestoneDraft}
                    returnKeyType="done"
                  />
                  <TouchableOpacity style={styles.milestoneBtn} onPress={addMilestoneDraft}>
                    <Text style={styles.milestoneBtnText}>＋</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.letterRow}>
                  <View style={styles.smartBadgeSmall}><Text style={styles.smartLetterSmall}>A·R</Text></View>
                  <Text style={styles.fieldLabel}>Why is it realistic — and why does it matter?</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.inputTall]}
                  placeholder="I already walk 5k daily; I want the energy to keep up with the kids."
                  placeholderTextColor={COLORS.muted2}
                  value={why}
                  onChangeText={setWhy}
                  multiline
                />

                <View style={styles.letterRow}>
                  <View style={styles.smartBadgeSmall}><Text style={styles.smartLetterSmall}>T</Text></View>
                  <Text style={styles.fieldLabel}>When will it be done?</Text>
                </View>
                <TouchableOpacity style={styles.dateRow} onPress={() => setPage('date')}>
                  <Text style={styles.dateLabel}>Target date</Text>
                  <Text style={styles.dateValue}>{targetDate ? `${shortDate(targetDate)} ›` : 'Pick a date ›'}</Text>
                </TouchableOpacity>

                <Text style={styles.formHint}>
                  Save needs a title, at least one milestone and a date — that's what makes it SMART.
                </Text>
              </ScrollView>
            )}

            {page === 'date' && (
              <View style={styles.formPad}>
                <CalendarPager
                  initialKey={targetDate || today}
                  selected={targetDate}
                  onSelect={(k) => { if (k >= today) { setTargetDate(k); setPage('form'); } }}
                />
                <TouchableOpacity onPress={() => setPage('form')} style={{ alignSelf: 'flex-end', marginTop: 12 }}>
                  <Text style={styles.pageSave}>Back</Text>
                </TouchableOpacity>
              </View>
            )}
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>

      {/* ============ Goal detail ============ */}
      <ModalShell visible={!!open} onClose={() => setOpenId(null)} title={open ? open.title : ''}>
        {open && (
          <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
            {!!open.specific && <Text style={styles.detailText}>{open.specific}</Text>}

            <Text style={styles.detailLabel}>Milestones · {openDone}/{open.milestones.length}</Text>
            {open.milestones.map((m) => (
              <TouchableOpacity
                key={m.id}
                style={styles.detailMilestone}
                onPress={() => toggleMilestone(open.id, m.id)}
              >
                <View style={[styles.check, m.done && styles.checkOn]}>
                  {m.done && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.milestoneText, m.done && styles.milestoneDone]}>{m.text}</Text>
              </TouchableOpacity>
            ))}

            {!!open.why && (
              <View>
                <Text style={styles.detailLabel}>Why it matters</Text>
                <Text style={styles.detailText}>{open.why}</Text>
              </View>
            )}

            {open.targetDate && (
              <Text style={[styles.detailLabel, { marginBottom: 2 }]}>
                Target · {shortDate(open.targetDate)} {!open.achievedOn && `(${daysLeftLabel(open)})`}
              </Text>
            )}

            <TouchableOpacity
              style={[styles.primaryBtn, { marginTop: 18 }]}
              onPress={() => { markGoalAchieved(open.id); setOpenId(null); }}
            >
              <Text style={styles.primaryBtnText}>
                {open.achievedOn ? 'Reopen goal' : 'Mark achieved 🎉'}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </ModalShell>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg, paddingHorizontal: 20 },

  // --- intro ---
  introHead: {
    color: COLORS.ink, fontSize: 36, lineHeight: 42, fontWeight: '600',
    fontFamily: SERIF, letterSpacing: -0.5, marginTop: 8,
  },
  introAccent: { fontStyle: 'italic', color: COLORS.espressoLight },
  introSub: { color: COLORS.muted, fontSize: 15.5, lineHeight: 23, marginTop: 14, marginBottom: 20 },
  smartRow: { flexDirection: 'row', gap: 13, marginBottom: 14, alignItems: 'flex-start' },
  smartBadge: {
    width: 40, height: 40, borderRadius: 13, backgroundColor: COLORS.crema,
    borderWidth: 1, borderColor: 'rgba(75,54,38,0.25)',
    alignItems: 'center', justifyContent: 'center',
  },
  smartLetter: { color: COLORS.espresso, fontSize: 18, fontWeight: '700', fontFamily: SERIF },
  smartWord: { color: COLORS.ink, fontSize: 15.5, fontWeight: '700' },
  smartLine: { color: COLORS.muted, fontSize: 13.5, lineHeight: 19, marginTop: 2 },

  // --- list ---
  empty: { color: COLORS.muted, fontSize: 14.5, lineHeight: 21, textAlign: 'center', marginTop: 40 },
  sectionTitle: {
    color: COLORS.muted2, fontSize: 12, fontWeight: '700',
    letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 12, marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 16, padding: 16, marginBottom: 12,
  },
  cardAchieved: { opacity: 0.75 },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF, flex: 1 },
  daysLeft: { color: COLORS.espressoLight, fontSize: 12.5, fontWeight: '700', marginTop: 2 },
  barTrack: {
    height: 7, borderRadius: 7, backgroundColor: 'rgba(59,44,30,0.08)',
    marginTop: 12, overflow: 'hidden',
  },
  barFill: { height: 7, borderRadius: 7, backgroundColor: COLORS.espresso },
  cardMeta: { color: COLORS.muted, fontSize: 13, marginTop: 9 },
  introLink: { alignItems: 'center', marginTop: 14 },
  introLinkText: { color: COLORS.espressoLight, fontSize: 13.5, fontWeight: '700' },

  // --- creator page ---
  pageSafe: { flex: 1, backgroundColor: COLORS.bg },
  pageHead: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  pageClose: { color: COLORS.muted, fontSize: 17, fontWeight: '600' },
  pageTitle: { color: COLORS.ink, fontSize: 17, fontWeight: '600', fontFamily: SERIF },
  pageSave: { color: COLORS.espresso, fontSize: 16, fontWeight: '700' },
  formPad: { padding: 20, paddingBottom: 60 },

  fieldLabel: { color: COLORS.ink, fontSize: 14.5, fontWeight: '700', marginBottom: 8, flex: 1 },
  letterRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: 18, marginBottom: 0 },
  smartBadgeSmall: {
    minWidth: 26, height: 26, borderRadius: 9, paddingHorizontal: 5,
    backgroundColor: COLORS.crema, borderWidth: 1, borderColor: 'rgba(75,54,38,0.25)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 8,
  },
  smartLetterSmall: { color: COLORS.espresso, fontSize: 12, fontWeight: '700', fontFamily: SERIF },

  input: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 15, paddingVertical: 12,
    color: COLORS.ink, fontSize: 15.5, marginBottom: 6,
  },
  inputTall: { minHeight: 74, textAlignVertical: 'top' },

  milestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: COLORS.panelDeep, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 12, paddingVertical: 10, paddingHorizontal: 13, marginBottom: 7,
  },
  milestoneNum: { color: COLORS.espressoLight, fontSize: 13, fontWeight: '700', fontFamily: SERIF },
  milestoneText: { color: COLORS.ink, fontSize: 14.5, flex: 1 },
  milestoneDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  milestoneRemove: { color: COLORS.muted2, fontSize: 13, fontWeight: '600' },
  milestoneAdd: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  milestoneBtn: {
    width: 44, height: 44, borderRadius: 12, backgroundColor: COLORS.espresso,
    alignItems: 'center', justifyContent: 'center',
  },
  milestoneBtnText: { color: COLORS.bg, fontSize: 22, fontWeight: '600', marginTop: -2 },

  dateRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.line,
    borderRadius: 14, paddingHorizontal: 15, paddingVertical: 13,
  },
  dateLabel: { color: COLORS.ink, fontSize: 15, fontWeight: '600' },
  dateValue: { color: COLORS.espressoLight, fontSize: 14, fontWeight: '600' },
  formHint: { color: COLORS.muted2, fontSize: 12.5, lineHeight: 18, marginTop: 18 },

  // --- detail ---
  detailLabel: {
    color: COLORS.muted2, fontSize: 11.5, fontWeight: '700',
    letterSpacing: 1.4, textTransform: 'uppercase', marginTop: 14, marginBottom: 8,
  },
  detailText: { color: COLORS.ink, fontSize: 14.5, lineHeight: 21 },
  detailMilestone: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 7 },
  check: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2,
    borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center',
  },
  checkOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  checkMark: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },

  primaryBtn: {
    backgroundColor: COLORS.espresso, borderRadius: 14,
    paddingVertical: 14, alignItems: 'center', marginTop: 26,
  },
  primaryBtnText: { color: COLORS.bg, fontSize: 15.5, fontWeight: '700' },
});
