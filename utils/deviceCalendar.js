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

// Every event on the user's own calendars (home, work, email accounts —
// wherever they actually type events), normalised to Organize's shape.
// `includeAll` is the binary override that also mirrors the preloaded
// feeds. Recurring events arrive pre-expanded (one entry per
// occurrence), so the date joins the id to keep keys unique.
export async function fetchDeviceEvents(includeAll = false, backDays = 60, aheadDays = 365) {
  try {
    const all = await DeviceCalendar.getCalendarsAsync(DeviceCalendar.EntityTypes.EVENT);
    const cals = includeAll ? all : all.filter(isUsersOwnCalendar);
    if (!cals.length) return [];
    const start = new Date(); start.setDate(start.getDate() - backDays);
    const end = new Date(); end.setDate(end.getDate() + aheadDays);
    const raw = await DeviceCalendar.getEventsAsync(cals.map((c) => c.id), start, end);
    return raw.map((e) => {
      const d = new Date(e.startDate);
      const key = dateKey(d);
      const hh = String(d.getHours()).padStart(2, '0');
      const mm = String(d.getMinutes()).padStart(2, '0');
      // Multi-day spans keep their end day. All-day events end at the
      // NEXT midnight in EventKit, so step back a minute first.
      let last = e.endDate ? new Date(e.endDate) : null;
      if (last && e.allDay) last = new Date(last.getTime() - 60000);
      const endKey = last ? dateKey(last) : null;
      return {
        id: `dev-${e.id}-${key}`,
        title: e.title || 'Untitled',
        date: key,
        endDate: endKey && endKey > key ? endKey : null,
        time: e.allDay ? null : `${hh}:${mm}`,
        device: true,
      };
    });
  } catch (e) {
    return [];
  }
}
