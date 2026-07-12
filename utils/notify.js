// =====================================================================
//  Morning digests — one local notification at 8:00 on any day that
//  has Organize events, listing them all. No server involved: iOS
//  fires them itself. The whole schedule is replanned from scratch
//  whenever events change; a per-day digest keeps us far under iOS's
//  64-pending-notification cap.
//
//  Phone-calendar events are left out on purpose — the phone's own
//  calendar already handles alerts for those.
// =====================================================================

import * as Notifications from 'expo-notifications';
import { todayKey, addDays } from './dates';

export const DIGEST_HOUR = 8;

// Show digests even if the app happens to be open at 8am.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function ensureNotifyPermission() {
  try {
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted
      || asked.ios?.status === Notifications.IosAuthorizationStatus.PROVISIONAL;
  } catch (e) {
    return false;
  }
}

export async function rescheduleMorningDigests(events, enabled) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;

    const today = todayKey();
    const now = new Date();
    const morningGone =
      now.getHours() > DIGEST_HOUR ||
      (now.getHours() === DIGEST_HOUR && now.getMinutes() > 0);

    // Group upcoming events by day (today only if 8am hasn't passed).
    // Multi-day events appear in every morning of their span.
    const byDay = {};
    events.forEach((e) => {
      const end = e.endDate && e.endDate > e.date ? e.endDate : e.date;
      let guard = 0;
      for (let d = e.date; d <= end && guard < 90; d = addDays(d, 1), guard++) {
        if (d < today) continue;
        if (d === today && morningGone) continue;
        (byDay[d] = byDay[d] || []).push(e);
      }
    });

    // Nearest 50 days with events — replanned on every change, so the
    // horizon rolls forward by itself.
    const days = Object.keys(byDay).sort().slice(0, 50);
    for (const day of days) {
      const lines = byDay[day]
        .sort((a, b) => ((a.time || '') < (b.time || '') ? -1 : 1))
        .map((e) => (e.time ? `${e.title} · ${e.time}` : e.title));
      const [y, m, d] = day.split('-').map(Number);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: lines.length === 1 ? 'On today' : `On today (${lines.length})`,
          body: lines.join('\n'),
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: new Date(y, m - 1, d, DIGEST_HOUR, 0, 0),
        },
      });
    }
  } catch (e) {}
}
