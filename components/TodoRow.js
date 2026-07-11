// =====================================================================
//  TodoRow — one to-do in a list. Shared by the To-dos tab and the
//  Calendar tab so ticks look and behave identically everywhere.
//
//  Ticking gives a small spring "pop" on the checkbox — the tiny
//  reward that makes finishing things feel finished.
//
//  Props:
//    title       — the text
//    done        — is it ticked?
//    meta        — small right-hand label ("Thu 4 Jul", "daily", "🔥 3")
//    metaColor   — optional colour for that label (e.g. red when overdue)
//    onToggle    — tap  = tick / untick
//    onLongPress — hold = delete
// =====================================================================

import React, { useRef, useEffect } from 'react';
import { Text, TouchableOpacity, Animated, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme';

export default function TodoRow({ title, done, meta, metaColor, onToggle, onLongPress }) {
  const { COLORS, styles } = useThemedStyles(makeStyles);
  const pop = useRef(new Animated.Value(1)).current;
  const wasDone = useRef(done);

  useEffect(() => {
    if (done && !wasDone.current) {
      // Just ticked: overshoot then settle.
      pop.setValue(0.4);
      Animated.spring(pop, {
        toValue: 1, friction: 4, tension: 220, useNativeDriver: true,
      }).start();
    }
    wasDone.current = done;
  }, [done]);

  return (
    <TouchableOpacity style={styles.row} onPress={onToggle} onLongPress={onLongPress}>
      <Animated.View style={[
        styles.check, done && styles.checkOn,
        { transform: [{ scale: pop }] },
      ]}>
        {done && <Text style={styles.checkMark}>✓</Text>}
      </Animated.View>
      <Text style={[styles.title, done && styles.titleDone]} numberOfLines={2}>
        {title}
      </Text>
      {meta ? (
        <Text style={[styles.meta, metaColor && { color: metaColor }]}>{meta}</Text>
      ) : null}
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.panel,
    borderWidth: 1,
    borderColor: COLORS.line,
    borderRadius: 14,
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  check: {
    width: 24, height: 24, borderRadius: 8, borderWidth: 2,
    borderColor: COLORS.muted, alignItems: 'center', justifyContent: 'center',
    marginRight: 14,
  },
  checkOn: { backgroundColor: COLORS.espresso, borderColor: COLORS.espresso },
  checkMark: { color: COLORS.bg, fontSize: 14, fontWeight: '700' },
  title: { color: COLORS.ink, fontSize: 16, flex: 1 },
  titleDone: { color: COLORS.muted, textDecorationLine: 'line-through' },
  meta: { color: COLORS.espressoLight, fontSize: 12.5, fontWeight: '600', marginLeft: 10 },
});
