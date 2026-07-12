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

// Only calendars the user actually writes to. Apple pre-loads phones
// with subscribed feeds (US Holidays…), an auto Birthdays calendar and
// Siri suggestions — all flagged read-only or by type, so they're easy
// to leave out.
function isUsersOwnCalendar(cal) {
  if (!cal.allowsModifications) return false;
  const type = String(cal.type || '').toLowerCase();
  return type !== 'subscribed' && type !== 'birthdays';
}

// The phone's calendars, for the picker in Settings. `suggested` marks
// the ones our heuristic would mirror by default.
export async function listDeviceCalendars() {
  try {
    const all = await DeviceCalendar.getCalendarsAsync(DeviceCalendar.EntityTypes.EVENT);
    return all
      .map((c) => ({
        id: c.id,
        title: c.title || 'Untitled',
        color: c.color || DEVICE_GREY,
        suggested: isUsersOwnCalendar(c),
      }))
      .sort((a, b) =>
        a.suggested === b.suggested
          ? a.title.localeCompare(b.title)
          : a.suggested ? -1 : 1
      );
  } catch (e) {
    return [];
  }
}

// Every event on the chosen calendars (or, with no explicit choice,
// the user's own calendars), normalised to Organize's shape. Recurring
// events arrive pre-expanded (one entry per occurrence), so the date
// joins the id to keep keys unique.
export async function fetchDeviceEvents(selectedIds = null, backDays = 60, aheadDays = 365) {
  try {
    const all = await DeviceCalendar.getCalendarsAsync(DeviceCalendar.EntityTypes.EVENT);
    const cals = selectedIds
      ? all.filter((c) => selectedIds.includes(c.id))
      : all.filter(isUsersOwnCalendar);
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
