// =====================================================================
//  Welcome — the first-launch moment, echoing the landing page hero.
//  Three quiet steps:
//    1. The brand: stacked-squares mark, "Everything in its place."
//    2. What's inside: the four tabs, introduced one by one.
//    3. "What should we call you?" — so mornings start with your name.
//
//  All motion uses the built-in Animated API (no extra dependencies):
//  springs for the mark, staggered rise-and-fade for text, a soft halo
//  breathing in behind everything, and a whole-screen fade on "Begin".
// =====================================================================

import React, { useState, useRef, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, Animated, Easing,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { COLORS, SERIF } from '../theme';

// ---------------------------------------------------------------------
//  Small animation helpers
// ---------------------------------------------------------------------

// Fade in and rise gently, after `delay` ms.
function Rise({ delay = 0, children, style }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(v, {
      toValue: 1, duration: 600, delay,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[style, {
      opacity: v,
      transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [18, 0] }) }],
    }]}>
      {children}
    </Animated.View>
  );
}

// One square of the brand mark, springing into place.
function MarkSquare({ delay, filled, size }) {
  const s = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.spring(s, {
      toValue: 1, delay, friction: 5, tension: 140, useNativeDriver: true,
    }).start();
  }, []);
  return (
    <Animated.View style={[
      {
        width: size, height: size, borderRadius: size * 0.28,
        borderWidth: 2, borderColor: COLORS.espresso,
        backgroundColor: filled ? COLORS.espresso : 'transparent',
      },
      { transform: [{ scale: s }] },
    ]} />
  );
}

// The 2×2 stacked-squares mark from the landing page.
function Mark({ size = 26, gap = 7, baseDelay = 200 }) {
  return (
    <View style={{ width: size * 2 + gap, height: size * 2 + gap }}>
      <View style={{ flexDirection: 'row', gap, marginBottom: gap }}>
        <MarkSquare delay={baseDelay} filled size={size} />
        <MarkSquare delay={baseDelay + 110} size={size} />
      </View>
      <View style={{ flexDirection: 'row', gap }}>
        <MarkSquare delay={baseDelay + 220} size={size} />
        <MarkSquare delay={baseDelay + 330} size={size} />
      </View>
    </View>
  );
}

// ---------------------------------------------------------------------

const FEATURES = [
  { icon: 'checkbox-outline', title: 'To-dos', blurb: 'Capture everything — tasks, deadlines, repeats.' },
  { icon: 'calendar-outline', title: 'Calendar', blurb: 'Events, reminders and due dates at a glance.' },
  { icon: 'flame-outline', title: 'Habits', blurb: 'Small things, done daily. Streaks that stick.' },
  { icon: 'book-outline', title: 'Journal', blurb: 'A few honest lines a day — Organize notices.' },
];

export default function WelcomeScreen({ onDone }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const stepFade = useRef(new Animated.Value(1)).current;   // between steps
  const screenFade = useRef(new Animated.Value(1)).current; // final exit
  const halo = useRef(new Animated.Value(0)).current;       // background glow

  useEffect(() => {
    Animated.timing(halo, {
      toValue: 1, duration: 1600,
      easing: Easing.out(Easing.quad), useNativeDriver: true,
    }).start();
  }, []);

  function goTo(next) {
    Animated.timing(stepFade, {
      toValue: 0, duration: 160, easing: Easing.in(Easing.quad), useNativeDriver: true,
    }).start(() => {
      setStep(next);
      stepFade.setValue(1); // fresh children animate themselves in
    });
  }

  function finish() {
    Animated.timing(screenFade, {
      toValue: 0, duration: 450, easing: Easing.in(Easing.cubic), useNativeDriver: true,
    }).start(() => onDone(name.trim()));
  }

  return (
    <Animated.View style={[styles.root, { opacity: screenFade }]}>
      {/* soft halo breathing in behind everything */}
      <Animated.View style={[styles.halo, {
        opacity: halo.interpolate({ inputRange: [0, 1], outputRange: [0, 0.5] }),
        transform: [{ scale: halo.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1] }) }],
      }]} />

      <SafeAreaView style={styles.safe}>
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <Animated.View style={[styles.stepWrap, { opacity: stepFade }]}>

            {/* ---------- Step 1: the brand ---------- */}
            {step === 0 && (
              <View style={styles.center}>
                <Mark />
                <Rise delay={550}><Text style={styles.wordmark}>Organize</Text></Rise>
                <Rise delay={750}>
                  <Text style={styles.headline}>
                    Everything{'\n'}<Text style={styles.headlineAccent}>in its place.</Text>
                  </Text>
                </Rise>
                <Rise delay={1000}>
                  <Text style={styles.sub}>
                    Tidy the little things{'\n'}and the big things follow.
                  </Text>
                </Rise>
                <Rise delay={1300} style={{ width: '100%' }}>
                  <TouchableOpacity style={styles.btn} onPress={() => goTo(1)} activeOpacity={0.85}>
                    <Text style={styles.btnText}>Continue</Text>
                  </TouchableOpacity>
                </Rise>
              </View>
            )}

            {/* ---------- Step 2: what's inside ---------- */}
            {step === 1 && (
              <View style={styles.center}>
                <Rise delay={0}>
                  <Text style={styles.eyebrow}>WHAT'S INSIDE</Text>
                </Rise>
                <Rise delay={120}>
                  <Text style={styles.headlineSmall}>
                    Four pieces.{'\n'}<Text style={styles.headlineAccent}>One calm place.</Text>
                  </Text>
                </Rise>
                <View style={styles.features}>
                  {FEATURES.map((f, i) => (
                    <Rise key={f.title} delay={350 + i * 160} style={styles.featureRow}>
                      <View style={styles.featureIcon}>
                        <Ionicons name={f.icon} size={20} color={COLORS.espresso} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.featureTitle}>{f.title}</Text>
                        <Text style={styles.featureBlurb}>{f.blurb}</Text>
                      </View>
                    </Rise>
                  ))}
                </View>
                <Rise delay={350 + FEATURES.length * 160 + 150} style={{ width: '100%' }}>
                  <TouchableOpacity style={styles.btn} onPress={() => goTo(2)} activeOpacity={0.85}>
                    <Text style={styles.btnText}>Continue</Text>
                  </TouchableOpacity>
                </Rise>
              </View>
            )}

            {/* ---------- Step 3: your name ---------- */}
            {step === 2 && (
              <View style={styles.center}>
                <Rise delay={0}>
                  <Text style={styles.headlineSmall}>
                    What should{'\n'}we <Text style={styles.headlineAccent}>call you?</Text>
                  </Text>
                </Rise>
                <Rise delay={200}>
                  <Text style={styles.sub}>So your mornings start with your name.</Text>
                </Rise>
                <Rise delay={380} style={{ width: '100%' }}>
                  <TextInput
                    style={styles.input}
                    placeholder="Your name"
                    placeholderTextColor={COLORS.muted2}
                    value={name}
                    onChangeText={setName}
                    returnKeyType="done"
                    onSubmitEditing={finish}
                  />
                </Rise>
                <Rise delay={520} style={{ width: '100%' }}>
                  <TouchableOpacity style={styles.btn} onPress={finish} activeOpacity={0.85}>
                    <Text style={styles.btnText}>{name.trim() ? `Begin, ${name.trim()}` : 'Begin'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={finish} style={styles.skip}>
                    <Text style={styles.skipText}>Maybe later</Text>
                  </TouchableOpacity>
                </Rise>
              </View>
            )}
          </Animated.View>

          {/* progress dots */}
          <View style={styles.dots}>
            {[0, 1, 2].map((i) => (
              <View key={i} style={[styles.dot, step === i && styles.dotOn]} />
            ))}
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.bg },
  halo: {
    position: 'absolute', alignSelf: 'center', top: '12%',
    width: 420, height: 420, borderRadius: 210,
    backgroundColor: 'rgba(200,169,126,0.45)',
  },
  safe: { flex: 1 },
  body: { flex: 1, paddingHorizontal: 32, justifyContent: 'center' },
  stepWrap: { flex: 1, justifyContent: 'center' },
  center: { alignItems: 'center' },

  wordmark: {
    color: COLORS.ink, fontSize: 21, fontWeight: '600', fontFamily: SERIF,
    letterSpacing: 0.4, marginTop: 26,
  },
  headline: {
    color: COLORS.ink, fontSize: 44, lineHeight: 50, fontWeight: '600',
    fontFamily: SERIF, textAlign: 'center', letterSpacing: -0.8, marginTop: 18,
  },
  headlineSmall: {
    color: COLORS.ink, fontSize: 34, lineHeight: 40, fontWeight: '600',
    fontFamily: SERIF, textAlign: 'center', letterSpacing: -0.5, marginTop: 12,
  },
  headlineAccent: { fontStyle: 'italic', color: COLORS.espressoLight },
  sub: {
    color: COLORS.muted, fontSize: 16, lineHeight: 24,
    textAlign: 'center', marginTop: 18,
  },
  eyebrow: {
    color: COLORS.espressoLight, fontSize: 11, fontWeight: '700',
    letterSpacing: 3, textAlign: 'center',
  },

  features: { width: '100%', marginTop: 30, gap: 16 },
  featureRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  featureIcon: {
    width: 44, height: 44, borderRadius: 14,
    backgroundColor: COLORS.crema, borderWidth: 1, borderColor: 'rgba(75,54,38,0.2)',
    alignItems: 'center', justifyContent: 'center',
  },
  featureTitle: { color: COLORS.ink, fontSize: 16, fontWeight: '700' },
  featureBlurb: { color: COLORS.muted, fontSize: 13.5, marginTop: 1 },

  input: {
    backgroundColor: COLORS.panel, borderWidth: 1, borderColor: COLORS.lineStrong,
    borderRadius: 16, paddingHorizontal: 18, paddingVertical: 15,
    color: COLORS.ink, fontSize: 17, textAlign: 'center', marginTop: 30,
  },

  btn: {
    backgroundColor: COLORS.espresso, borderRadius: 16,
    paddingVertical: 16, alignItems: 'center', marginTop: 34,
    shadowColor: COLORS.ink, shadowOpacity: 0.25, shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 }, elevation: 5,
  },
  btnText: { color: COLORS.bg, fontSize: 16.5, fontWeight: '700' },
  skip: { alignItems: 'center', marginTop: 16 },
  skipText: { color: COLORS.muted2, fontSize: 14, fontWeight: '600' },

  dots: {
    flexDirection: 'row', justifyContent: 'center', gap: 8,
    paddingBottom: 18,
  },
  dot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(59,44,30,0.18)',
  },
  dotOn: { width: 22, backgroundColor: COLORS.espresso },
});
