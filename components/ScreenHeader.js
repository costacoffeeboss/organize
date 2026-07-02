// =====================================================================
//  ScreenHeader — the serif title block every tab shares.
// =====================================================================

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS, SERIF } from '../theme';

export default function ScreenHeader({ title, subtitle }) {
  return (
    <View style={styles.header}>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { marginTop: 12, marginBottom: 18 },
  title: {
    color: COLORS.ink, fontSize: 30, fontWeight: '600',
    letterSpacing: -0.5, fontFamily: SERIF,
  },
  subtitle: { color: COLORS.muted, fontSize: 14, marginTop: 2 },
});
