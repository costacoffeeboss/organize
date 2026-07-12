// =====================================================================
//  Device calendar — a read-only mirror of the phone's own calendars
//  (Apple, Google, Outlook… whatever is synced to iOS). Nothing is
//  copied or stored: when the feature is on we fetch the events fresh
//  and show them in neutral grey alongside Organize's own entries.
//  Editing/deleting happens in the phone's calendar app, not here.
// =====================================================================

import * as DeviceCalendar from 'expo-calendar';
import { dateKey } from './dates';

// Neutral grey used everywhere a phone event appears — deliberately
// outside both the Life and Work palettes.
export const DEVICE_GREY = '#98989e';

export async function ensureCalendarPermission() {
  try {
    const current = await DeviceCalendar.getCalendarPermissionsAsync();
    if (current.status === 'granted') return true;
    if (!current.canAskAgain) return false;
    const asked = await DeviceCalendar.requestCalendarPermissionsAsync();
    return asked.status === 'granted';
  } catch (e) {
    return false;
  }
}

// Every event on every calendar the phone knows about, normalised to
// Organize's shape. Recurring events arrive pre-expanded (one entry
// per occurrence), so the date joins the id to keep keys unique.
export async function fetchDeviceEvents(backDays = 60, aheadDays = 365) {
  try {
    const cals = await DeviceCalendar.getCalendarsAsync(DeviceCalendar.EntityTypes.EVENT);
    if (!cals.length) return [];
    const start = new Date(); start.setDate(start.getDate() - backDays);
    const end = new Date(); end.setDate(end.getDate() + aheadDays);
    const raw = await DeviceCalendar.getEventsAsync(cals.map((c) => c.id), start, end);
    return raw.map((e) => {
      const d = new Date(e.startDate);
      const key = dateKey(d);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      return {
        id: `dev-${e.id}-${key}`,
        title: e.title || 'Untitled',
        date: key,
        time: e.allDay ? null : `${hh}:${mm}`,
        device: true,
      };
    });
  } catch (e) {
    return [];
  }
}
