// =====================================================================
//  CompanionCard — the "Organize noticed…" chat bubble in the Journal
//  tab (the landing page's AI companion, step 1: on-device rules).
//
//  Props:
//    notice    — { text, question } from utils/noticer
//    onWrite   — open the journal composer seeded with the question
//    onDismiss — hide this notice for the rest of the day
// =====================================================================

import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, Animated, Easing, StyleSheet } from 'react-native';
import { useThemedStyles, SERIF } from '../theme';

export default function CompanionCard({ notice, onWrite, onDismiss }) {
  const { COLORS, styles } = useThemedStyles(makeStyles);
  // Arrive gently — a companion shouldn't pounce.
  const inAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(inAnim, {
      toValue: 1, duration: 500, delay: 150,
      easing: Easing.out(Easing.cubic), useNativeDriver: true,
    }).start();
  }, []);

  return (
    <Animated.View style={[styles.card, {
      opacity: inAnim,
      transform: [{ translateY: inAnim.interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
    }]}>
      <View style={styles.head}>
        <View style={styles.dot} />
        <Text style={styles.label}>Organize noticed</Text>
        <TouchableOpacity
          onPress={onDismiss}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          style={{ marginLeft: 'auto' }}
        >
          <Text style={styles.close}>✕</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.text}>{notice.text}</Text>
      <Text style={styles.question}>{notice.question}</Text>

      <TouchableOpacity onPress={onWrite}>
        <Text style={styles.action}>Write about it ›</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  card: {
    backgroundColor: COLORS.panel,
    borderWidth: 1, borderColor: 'rgba(75,54,38,0.22)',
    borderRadius: 16, padding: 16, marginBottom: 14,
  },
  head: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  dot: { width: 16, height: 16, borderRadius: 8, backgroundColor: COLORS.espresso, marginRight: 8 },
  label: {
    color: COLORS.espressoLight, fontSize: 10.5, fontWeight: '700',
    letterSpacing: 1.6, textTransform: 'uppercase',
  },
  close: { color: COLORS.muted2, fontSize: 14, fontWeight: '600' },

  text: { color: COLORS.ink, fontSize: 14.5, lineHeight: 21 },
  question: {
    color: '#4b3d2c', fontSize: 15.5, lineHeight: 22,
    fontFamily: SERIF, fontStyle: 'italic', marginTop: 8,
  },
  action: { color: COLORS.espresso, fontSize: 13.5, fontWeight: '700', marginTop: 12 },
});
