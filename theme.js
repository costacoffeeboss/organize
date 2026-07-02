// =====================================================================
//  Organize — shared brand theme
//  One place for colours so every screen stays in sync with the
//  landing page. Import { COLORS, SERIF } wherever you build UI.
// =====================================================================

import { Platform } from 'react-native';

export const COLORS = {
  bg: '#ecdfc8',          // light latte background
  panel: '#f8f1e1',       // milk-foam card
  panelDeep: '#f3ead6',   // slightly deeper card (nested surfaces)
  line: 'rgba(59,44,30,0.13)',
  lineStrong: 'rgba(59,44,30,0.22)',
  ink: '#2a2118',         // espresso-black text
  muted: '#6f6152',
  muted2: '#9a8b74',
  espresso: '#4b3626',    // deep accent (buttons, ticks, fills)
  espressoLight: '#5f4632',
  crema: '#e3d3b2',       // warm highlight surface
  danger: '#b3423a',      // overdue / delete
};

// Phones don't ship the landing page's Fraunces font, so we echo it
// with the built-in system serif for the wordmark and screen titles.
export const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';
