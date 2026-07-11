// =====================================================================
//  Organize — shared brand themes
//  Two palettes with identical keys:
//    LIFE — the original coffee-shop warmth (cream + espresso + gold)
//    WORK — "Organize Work": black + metallic silver
//  Screens read the active palette through ThemeContext so the whole
//  app re-skins when the user switches sides. Use the useThemedStyles
//  hook in every component:
//
//    const { COLORS, styles } = useThemedStyles(makeStyles);
//    ...
//    const makeStyles = (COLORS) => StyleSheet.create({ ... });
//
//  The static `COLORS` export stays equal to LIFE for the few places
//  that never re-theme (the welcome flow runs before any switch).
// =====================================================================

import React, { createContext, useContext, useMemo } from 'react';
import { Platform } from 'react-native';

export const LIFE = {
  mode: 'life',
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
  gold: '#b8874b',        // reminders (birthdays etc.) on the calendar
  danger: '#b3423a',      // overdue / delete
};

// Same roles, re-cast in black and metallic silver. "espresso" stays
// the name of the primary accent so every screen works unchanged —
// here it's polished silver on near-black.
export const WORK = {
  mode: 'work',
  bg: '#0c0c0e',          // near-black
  panel: '#17171b',       // graphite card
  panelDeep: '#1e1e23',   // slightly raised surface
  line: 'rgba(214,218,228,0.14)',
  lineStrong: 'rgba(214,218,228,0.30)',
  ink: '#eceef2',         // bright silver-white text
  muted: '#9a9eab',
  muted2: '#6f7480',
  espresso: '#c9cdd6',    // metallic silver accent (buttons, ticks, fills)
  espressoLight: '#aeb3c0',
  crema: '#26262d',       // cool highlight surface
  gold: '#8e97a8',        // steel accent (reminders, goal chips)
  danger: '#e0655f',
};

export const COLORS = LIFE;

// Phones don't ship the landing page's Fraunces font, so we echo it
// with the built-in system serif for the wordmark and screen titles.
export const SERIF = Platform.OS === 'ios' ? 'Georgia' : 'serif';

export const ThemeContext = createContext(LIFE);

// The active palette (LIFE or WORK).
export function useTheme() {
  return useContext(ThemeContext);
}

// Palette + memoised themed styles in one call. `make` must be a
// stable module-level function: (COLORS) => StyleSheet.create({...}).
export function useThemedStyles(make) {
  const palette = useContext(ThemeContext);
  const styles = useMemo(() => make(palette), [palette, make]);
  return { COLORS: palette, styles };
}

// The palette an item belongs to by origin — calendar entries keep
// their home side's colours wherever they appear.
export function paletteFor(owner) {
  return owner === 'work' ? WORK : LIFE;
}
