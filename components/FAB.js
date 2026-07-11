// =====================================================================
//  FAB — the round floating ＋ button that opens each tab's "add" pop-up.
// =====================================================================

import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useThemedStyles } from '../theme';

export default function FAB({ onPress }) {
  const { COLORS, styles } = useThemedStyles(makeStyles);
  return (
    <TouchableOpacity style={styles.fab} onPress={onPress} activeOpacity={0.85}>
      <Text style={styles.plus}>＋</Text>
    </TouchableOpacity>
  );
}

const makeStyles = (COLORS) => StyleSheet.create({
  fab: {
    position: 'absolute', right: 22, bottom: 26,
    width: 58, height: 58, borderRadius: 29,
    backgroundColor: COLORS.espresso,
    alignItems: 'center', justifyContent: 'center',
    // A soft shadow so it floats above the list.
    shadowColor: COLORS.ink, shadowOpacity: 0.3,
    shadowRadius: 10, shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  plus: { color: COLORS.bg, fontSize: 30, fontWeight: '600', marginTop: -2 },
});
