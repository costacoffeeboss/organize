// =====================================================================
//  GoalQuiz — a short scenario quiz that sparks goal ideas.
//  No "do you want to learn guitar?" box-ticking: each question is a
//  situation, and the answer you're drawn to quietly scores a few
//  interest areas. The last question asks what usually stops you, so
//  the results page can hand back one honest tip alongside the ideas.
//
//  Props:
//    visible, onClose
//    onPick(idea)   — idea = { title, milestones: [text] } → prefill editor
//    onStartBlank() — none of these; open the blank goal flow
// =====================================================================

import React, { useState, useRef } from 'react';
import {
  View, Text, TouchableOpacity, ScrollView, Modal, Animated, Easing, StyleSheet,
} from 'react-native';
import FullPage from './FullPage';
import { COLORS, SERIF } from '../theme';
import Rise from './Rise';

const QUESTIONS = [
  {
    q: 'Your friend is hosting a get-together. Secretly, you hope it turns into…',
    options: [
      { t: 'A jam session — someone finds a guitar', cats: ['music'] },
      { t: 'A book-club argument about the ending', cats: ['mind'] },
      { t: 'Five-a-side in the park afterwards', cats: ['sport', 'fitness'] },
      { t: 'A cook-off in the kitchen', cats: ['craft'] },
    ],
  },
  {
    q: 'A free Saturday morning appears from nowhere. Where does it actually go?',
    options: [
      { t: 'Moving — a run, the gym, a long walk', cats: ['fitness'] },
      { t: 'Making or fixing something with my hands', cats: ['craft'] },
      { t: 'Photos, sketches, words — capturing something', cats: ['creative'] },
      { t: 'Daydreaming about trips I haven’t booked', cats: ['language'] },
    ],
  },
  {
    q: 'Which compliment would secretly delight you the most?',
    options: [
      { t: '“Wait — you MADE this?”', cats: ['craft', 'creative'] },
      { t: '“You know so much about this.”', cats: ['mind'] },
      { t: '“I didn’t know you could play!”', cats: ['music'] },
      { t: '“You’re in great shape.”', cats: ['fitness', 'sport'] },
    ],
  },
  {
    q: 'Five years from now — which scene makes you smile the most?',
    options: [
      { t: 'Ordering dinner abroad, in their language', cats: ['language'] },
      { t: 'Playing a song at a friend’s wedding', cats: ['music'] },
      { t: 'Crossing a finish line, arms up', cats: ['fitness', 'sport'] },
      { t: 'A shelf full of things you created', cats: ['creative', 'craft'] },
    ],
  },
  {
    q: 'What kind of progress feels most satisfying?',
    options: [
      { t: 'Numbers climbing — faster, stronger, further', cats: ['fitness', 'sport'] },
      { t: 'Gibberish slowly turning into meaning', cats: ['language', 'mind'] },
      { t: 'Hands learning to move on their own', cats: ['music', 'craft'] },
      { t: 'Finishing something I can show people', cats: ['creative'] },
    ],
  },
  {
    q: 'Last one — honestly, what usually stops you?',
    options: [
      { t: 'I start too big and burn out', tip: 'keep milestone one laughably small — five minutes counts.' },
      { t: 'I lose interest after week two', tip: 'pick the goal that still sounds fun on a bad day, not the most impressive one.' },
      { t: 'I never know where to start', tip: 'your first milestone can just be “find out how people start” — that’s allowed.' },
      { t: 'Life gets in the way', tip: 'tie it to a time you already protect — “right after coffee” beats “when I’m free”.' },
    ],
  },
];

const IDEAS = {
  music: [
    { title: 'Learn 3 songs on an instrument', milestones: ['Pick the instrument and the first song', 'Practise 15 minutes, 4× a week', 'Play one song start to finish', 'Record all three — badly is fine'] },
    { title: 'Play one song for someone else', milestones: ['Choose a crowd-pleaser', 'Learn it section by section', 'Play it alone without stopping', 'Play it for one person'] },
    { title: 'Practise 15 minutes a day for 30 days', milestones: ['Pick the instrument and a slot in your day', 'First seven days unbroken', 'Day 15: play something recognisable', 'Day 30: record a before-and-after'] },
  ],
  language: [
    { title: 'Hold a 5-minute conversation in a new language', milestones: ['Pick the language and one app or course', 'Ten minutes a day for two weeks', 'Learn your 50 survival phrases', 'Have the conversation — stumbles allowed'] },
    { title: 'Order a whole meal in the local language', milestones: ['Learn food and politeness words', 'Practise the restaurant script out loud', 'Do a mock order with a friend', 'Do it for real'] },
    { title: 'Finish a beginner course, start to end', milestones: ['Choose one course — only one', 'Three lessons a week', 'Halfway checkpoint: test yourself', 'Final lesson, then celebrate in the language'] },
  ],
  fitness: [
    { title: 'Run a 5k without stopping', milestones: ['Run-walk three times a week', 'Run 2k without stopping', 'Run 4k without stopping', 'Race day: the full 5k'] },
    { title: 'Twenty proper push-ups in a row', milestones: ['Find your honest max', 'Three practice sets every other day', 'Hit 12 in a row', 'Twenty — filmed for proof'] },
    { title: 'Move every single day for a month', milestones: ['Define what counts (20+ minutes)', 'One perfect week', 'Survive one zero-motivation day', 'Day 30: review and level up'] },
  ],
  sport: [
    { title: 'Join a local team or class for a season', milestones: ['Shortlist two clubs nearby', 'Show up to one taster session', 'Commit to a month', 'See out the season'] },
    { title: 'Learn a sport from zero', milestones: ['Pick it and watch the basics', 'Get the minimum kit', 'Four beginner sessions', 'Play one real game'] },
    { title: 'Get good enough to genuinely enjoy a game', milestones: ['Book three beginner lessons', 'Drill the basics weekly', 'Play with a patient friend', 'The first session that flies by'] },
  ],
  mind: [
    { title: 'Read 6 books in 3 months', milestones: ['Pick the first two', '20 minutes before bed most nights', 'Three down', 'All six — one line of notes each'] },
    { title: 'Go deep on one topic that fascinates you', milestones: ['Choose the topic and one great book', 'One documentary or lecture a week', 'Explain it to a friend for ten minutes', 'Write up what you now believe'] },
    { title: 'Learn the basics of a big subject in 30 days', milestones: ['Pick the subject and one intro resource', '15 minutes daily', 'Explain the core idea in plain words', 'Write your ten takeaways'] },
  ],
  craft: [
    { title: 'Cook 10 new dishes from scratch', milestones: ['List ten you’d love to make', 'Two a week — no takeaway backup', 'Re-cook the best three from memory', 'Host someone for your best one'] },
    { title: 'Build or fix something real', milestones: ['Pick the project', 'Learn the technique from one video', 'Do the rough version', 'Finish it properly'] },
    { title: 'Learn one quietly impressive skill', milestones: ['Choose it — card trick, latte art, proper knots…', 'Learn the method properly', 'Practise until it looks effortless', 'Perform it once, casually'] },
  ],
  creative: [
    { title: 'Fill a sketchbook cover to cover', milestones: ['Buy the book — cheap on purpose', 'One page a day, quality irrelevant', 'Halfway: pick your three favourites', 'Last page done'] },
    { title: 'Make and share 5 finished pieces', milestones: ['Choose your medium', 'Finish one, however rough', 'Three done', 'Share all five somewhere'] },
    { title: 'A 30-day tiny-creations streak', milestones: ['Pick the tiny daily format', 'First week done', 'Share one you actually like', 'Day 30: choose your top three'] },
  ],
};

// How the results are ranked: best-match category shows the most ideas.
const RANK_LABELS = ['Best match', 'Strong match', 'Good match', 'Wildcard'];
const RANK_COUNTS = [3, 2, 2, 1];

export default function GoalQuiz({ visible, onClose, onPick, onStartBlank }) {
  const [step, setStep] = useState(0);
  const [scores, setScores] = useState({});
  const [tip, setTip] = useState(null);
  const fade = useRef(new Animated.Value(1)).current;

  const finished = step >= QUESTIONS.length;

  function reset() {
    setStep(0); setScores({}); setTip(null); fade.setValue(1);
  }

  function choose(option) {
    Animated.timing(fade, {
      toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => {
      if (option.cats) {
        setScores((prev) => {
          const next = { ...prev };
          option.cats.forEach((c, i) => { next[c] = (next[c] || 0) + (i === 0 ? 2 : 1); });
          return next;
        });
      }
      if (option.tip) setTip(option.tip);
      setStep((s) => s + 1);
      fade.setValue(1);
    });
  }

  // Rank every scored interest area; the better the match, the more
  // ideas it contributes (3 / 2 / 2 / 1 → up to eight suggestions).
  const ranked = Object.entries(scores)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([c]) => c);
  const suggestions = ranked.slice(0, 4).flatMap((c, rank) =>
    (IDEAS[c] || []).slice(0, RANK_COUNTS[rank]).map((idea) => ({ ...idea, rank }))
  );

  function close() { reset(); onClose(); }

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={close}>
      <FullPage>
        {/* header */}
        <View style={styles.head}>
          <TouchableOpacity onPress={close} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Text style={styles.close}>✕</Text>
          </TouchableOpacity>
          <Text style={styles.headTitle}>{finished ? 'Your sparks' : 'A little inspiration'}</Text>
          <View style={{ width: 20 }} />
        </View>

        {!finished ? (
          <Animated.View style={{ flex: 1, opacity: fade }}>
            <ScrollView
              contentContainerStyle={styles.body}
              showsVerticalScrollIndicator={false}
            >
              <Text style={styles.count}>{step + 1} of {QUESTIONS.length}</Text>
              <Text style={styles.question}>{QUESTIONS[step].q}</Text>
              <View style={{ marginTop: 22 }}>
                {QUESTIONS[step].options.map((o, i) => (
                  <Rise key={o.t} delay={120 + i * 90}>
                    <TouchableOpacity style={styles.option} onPress={() => choose(o)} activeOpacity={0.8}>
                      <Text style={styles.optionText}>{o.t}</Text>
                    </TouchableOpacity>
                  </Rise>
                ))}
              </View>
            </ScrollView>
            {/* progress dots */}
            <View style={styles.dots}>
              {QUESTIONS.map((_, i) => (
                <View key={i} style={[styles.dot, i === step && styles.dotOn, i < step && styles.dotDone]} />
              ))}
            </View>
          </Animated.View>
        ) : (
          <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
            <Rise delay={0}>
              <Text style={styles.question}>
                Where your answers <Text style={styles.accent}>point.</Text>
              </Text>
            </Rise>
            {tip && (
              <Rise delay={140}>
                <Text style={styles.tip}>And since you know what stops you: {tip}</Text>
              </Rise>
            )}
            <View style={{ marginTop: 20 }}>
              {suggestions.map((idea, i) => (
                <Rise key={idea.title} delay={220 + i * 80}>
                  <TouchableOpacity
                    style={[styles.idea, idea.rank === 0 && styles.ideaTop]}
                    onPress={() => { reset(); onPick(idea); }}
                    activeOpacity={0.85}
                  >
                    <View style={[styles.rankBadge, idea.rank === 0 && styles.rankBadgeTop]}>
                      <Text style={[styles.rankText, idea.rank === 0 && styles.rankTextTop]}>
                        {RANK_LABELS[idea.rank]}
                      </Text>
                    </View>
                    <Text style={styles.ideaTitle}>{idea.title}</Text>
                    <Text style={styles.ideaMeta}>
                      {idea.milestones.length} starter milestones · tap to shape it
                    </Text>
                  </TouchableOpacity>
                </Rise>
              ))}
            </View>
            <Rise delay={260 + suggestions.length * 110 + 100}>
              <TouchableOpacity onPress={() => { reset(); onStartBlank(); }} style={styles.blankLink}>
                <Text style={styles.blankText}>None of these — start blank ›</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={reset} style={styles.retake}>
                <Text style={styles.retakeText}>Retake the quiz</Text>
              </TouchableOpacity>
            </Rise>
          </ScrollView>
        )}
      </FullPage>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: COLORS.bg },
  head: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: COLORS.line,
  },
  close: { color: COLORS.muted, fontSize: 17, fontWeight: '600' },
  headTitle: { color: COLORS.ink, fontSize: 16.5, fontWeight: '600', fontFamily: SERIF },

  body: { padding: 26, paddingBottom: 40, flexGrow: 1 },
  count: {
    color: COLORS.espressoLight, fontSize: 11.5, fontWeight: '700',
    letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12,
  },
  question: {
    color: COLORS.ink, fontSize: 26, lineHeight: 33, fontWeight: '600',
    fontFamily: SERIF, letterSpacing: -0.3,
  },
  accent: { fontStyle: 'italic', color: COLORS.espressoLight },

  option: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.lineStrong,
    borderRadius: 16, paddingVertical: 16, paddingHorizontal: 18, marginBottom: 11,
  },
  optionText: { color: COLORS.ink, fontSize: 15.5, lineHeight: 21 },

  dots: { flexDirection: 'row', justifyContent: 'center', gap: 7, paddingBottom: 18 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(59,44,30,0.15)' },
  dotOn: { width: 20, backgroundColor: COLORS.espresso },
  dotDone: { backgroundColor: COLORS.espressoLight },

  tip: { color: COLORS.muted, fontSize: 14.5, lineHeight: 21, marginTop: 14, fontStyle: 'italic' },
  idea: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.lineStrong,
    borderRadius: 16, padding: 17, marginBottom: 11,
  },
  ideaTop: { borderColor: 'rgba(184,135,75,0.65)', borderWidth: 1.5 },
  rankBadge: {
    alignSelf: 'flex-start', borderRadius: 999,
    paddingHorizontal: 9, paddingVertical: 2.5, marginBottom: 8,
    backgroundColor: 'rgba(59,44,30,0.07)',
  },
  rankBadgeTop: { backgroundColor: COLORS.gold },
  rankText: {
    color: COLORS.muted, fontSize: 10, fontWeight: '800',
    letterSpacing: 1, textTransform: 'uppercase',
  },
  rankTextTop: { color: COLORS.bg },
  ideaTitle: { color: COLORS.ink, fontSize: 16.5, fontWeight: '600', fontFamily: SERIF },
  ideaMeta: { color: COLORS.gold, fontSize: 12.5, fontWeight: '700', marginTop: 6 },
  blankLink: { alignItems: 'center', marginTop: 16 },
  blankText: { color: COLORS.espresso, fontSize: 14.5, fontWeight: '700' },
  retake: { alignItems: 'center', marginTop: 12 },
  retakeText: { color: COLORS.muted2, fontSize: 13, fontWeight: '600' },
});
