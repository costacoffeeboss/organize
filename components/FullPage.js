// =====================================================================
//  FullPage — root view for full-screen <Modal> content.
//  SafeAreaView doesn't reliably apply its insets inside RN modals on
//  the new architecture, which is how headers end up underneath the
//  clock and wifi icons. This reads the insets via the hook (measured
//  on the main window — identical for a full-screen modal) and pads
//  manually, which always works.
// =====================================================================

import React from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme';

export default function FullPage({ children, style }) {
  const COLORS = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={[{
      flex: 1,
      backgroundColor: COLORS.bg,
      paddingTop: insets.top + 4,
      paddingBottom: Math.max(insets.bottom, 6),
    }, style]}>
      {children}
    </View>
  );
}
