// =====================================================================
//  ModalShell — the shared dressing for every pop-up in the app:
//  dim backdrop, cream card, serif title, and a keyboard-avoiding
//  wrapper so text inputs never hide behind the keyboard.
//
//  Props:
//    visible, onClose — the usual Modal pair (tapping the backdrop closes)
//    title            — serif heading at the top of the card
//    children         — the card contents
// =====================================================================

import React from 'react';
import {
  Modal, View, Text, TouchableOpacity, TouchableWithoutFeedback,
  KeyboardAvoidingView, Platform, StyleSheet,
} from 'react-native';
import { COLORS, SERIF } from '../theme';

export default function ModalShell({ visible, onClose, title, children }) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.backdrop}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Tapping the dim area closes the modal… */}
        <TouchableWithoutFeedback onPress={onClose}>
          <View style={StyleSheet.absoluteFill} />
        </TouchableWithoutFeedback>

        {/* …but taps inside the card do not. */}
        <View style={styles.card}>
          <View style={styles.head}>
            <Text style={styles.title}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={styles.close}>✕</Text>
            </TouchableOpacity>
          </View>
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(42,33,24,0.45)',
    justifyContent: 'center', padding: 22,
  },
  card: {
    backgroundColor: COLORS.panel, borderRadius: 18, padding: 18,
    borderWidth: 1, borderColor: COLORS.line,
  },
  head: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', marginBottom: 14,
  },
  title: { color: COLORS.ink, fontSize: 20, fontWeight: '600', fontFamily: SERIF },
  close: { color: COLORS.muted, fontSize: 16, fontWeight: '600', padding: 2 },
});
