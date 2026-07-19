// =====================================================================
//  Daily rundown reminders — two local notifications a day, fired by
//  iOS itself (no server): 7am to start the morning rundown, 7pm for
//  the evening recap. Each carries a `flow` payload so tapping it can
//  open straight into that flow. Repeating daily triggers, so there's
//  nothing to top up and we stay far under iOS's pending-notification
//  cap.
// =====================================================================

import * as Notifications from 'expo-notifications';

export const MORNING_HOUR = 7;
export const EVENING_HOUR = 19;

// Show reminders even if the app happens to be open at the time.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
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

export async function rescheduleReminders(enabled) {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!enabled) return;
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Good morning ☀️',
        body: 'Take a minute to plan your day.',
        data: { flow: 'morning' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: MORNING_HOUR, minute: 0,
      },
    });
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Evening recap 🌙',
        body: 'How did today go? Tick off what you did.',
        data: { flow: 'evening' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: EVENING_HOUR, minute: 0,
      },
    });
  } catch (e) {}
}
