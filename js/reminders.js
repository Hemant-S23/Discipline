// ============================================================
// reminders.js — Cross-platform Daily Habit Reminders
// Supports Native Android (LocalNotifications) + Web Notifications
// ============================================================

import { getActiveHabits, getHabits, isCompleted, today } from './data.js?v=6.0';
import { calculateHabitStreak } from './streaks.js?v=6.0';
import { showToast } from './ui.js?v=6.0';

/**
 * Generate a deterministic positive 32-bit integer from a habit string ID.
 * Required by Capacitor LocalNotifications (ID must be a 32-bit int).
 */
export function getNotificationId(habitId) {
  let hash = 0;
  const str = String(habitId);
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash) % 2147483647;
}

/**
 * Request notification permissions across Native (Capacitor) and Web.
 */
export async function requestNotificationPermission() {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
    if (LocalNotifications) {
      try {
        const check = await LocalNotifications.checkPermissions();
        if (check.display === 'granted') return true;
        const req = await LocalNotifications.requestPermissions();
        return req.display === 'granted';
      } catch (err) {
        console.warn('[Reminders] Native permission request notice:', err);
      }
    }
    return false;
  }

  // Web Browser
  if ('Notification' in window) {
    if (Notification.permission === 'granted') return true;
    if (Notification.permission !== 'denied') {
      try {
        const perm = await Notification.requestPermission();
        return perm === 'granted';
      } catch (err) {
        console.warn('[Reminders] Web notification permission notice:', err);
      }
    }
  }
  return false;
}

/**
 * Schedule a daily recurring reminder for a specific habit.
 */
export async function scheduleHabitReminder(habit) {
  if (!habit || !habit.id) return;

  // If reminder is cleared or not set, cancel any existing reminder
  if (!habit.reminderTime) {
    await cancelHabitReminder(habit.id);
    return;
  }

  const parts = habit.reminderTime.split(':');
  if (parts.length < 2) return;
  const hour = parseInt(parts[0], 10);
  const minute = parseInt(parts[1], 10);
  if (isNaN(hour) || isNaN(minute)) return;

  const notifId = getNotificationId(habit.id);
  const streak = calculateHabitStreak(habit.id);
  const streakMsg = streak.current > 0 ? ` (${streak.current} day streak! 🔥)` : '';
  const title = `Time to ${habit.name}!`;
  const body = `Stay disciplined today${streakMsg}. Tap to complete.`;

  // 1. Android Native (Capacitor LocalNotifications)
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
    if (LocalNotifications) {
      try {
        await requestNotificationPermission();
        // Cancel previous notification if any
        try {
          await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
        } catch (e) {}

        await LocalNotifications.schedule({
          notifications: [{
            id: notifId,
            title: title,
            body: body,
            schedule: {
              on: { hour: hour, minute: minute },
              repeats: true,
              allowWhileIdle: true
            },
            extra: { habitId: habit.id }
          }]
        });
        console.log(`[Reminders] Native reminder scheduled for "${habit.name}" at ${hour}:${String(minute).padStart(2, '0')} (ID: ${notifId})`);
      } catch (err) {
        console.warn('[Reminders] Error scheduling native reminder:', err);
      }
    }
    return;
  }

  // 2. Web Browser
  if ('Notification' in window) {
    await requestNotificationPermission();
  }
}

/**
 * Cancel the scheduled reminder for a specific habit.
 */
export async function cancelHabitReminder(habitId) {
  if (!habitId) return;
  const notifId = getNotificationId(habitId);

  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
    if (LocalNotifications) {
      try {
        await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
        console.log(`[Reminders] Cancelled native reminder for habit ID ${habitId} (Notif ID: ${notifId})`);
      } catch (err) {
        console.warn('[Reminders] Error cancelling native reminder:', err);
      }
    }
  }
}

/**
 * Synchronize all reminders for active habits.
 * Runs on app initialization and after data changes.
 */
export async function syncAllHabitReminders() {
  try {
    const activeHabits = getActiveHabits();
    const allHabits = getHabits();
    const activeIds = new Set(activeHabits.map(h => h.id));

    // Schedule active habits with reminders
    for (const h of activeHabits) {
      if (h.reminderTime) {
        await scheduleHabitReminder(h);
      } else {
        await cancelHabitReminder(h.id);
      }
    }

    // Cancel reminders for archived or deleted habits
    for (const h of allHabits) {
      if (!activeIds.has(h.id) || h.archivedAt) {
        await cancelHabitReminder(h.id);
      }
    }
  } catch (err) {
    console.warn('[Reminders] syncAllHabitReminders error:', err);
  }
}

/**
 * In-browser Web Reminder ticker.
 * Checks every 30 seconds if any uncompleted habit has reached its reminder time.
 */
let _lastFiredWebMinute = '';
function _startWebReminderChecker() {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    // On native mobile, LocalNotifications handles background delivery
    return;
  }

  setInterval(() => {
    try {
      const now = new Date();
      const currentMinuteStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

      if (currentMinuteStr === _lastFiredWebMinute) return;
      _lastFiredWebMinute = currentMinuteStr;

      const todayStr = today();
      const habits = getActiveHabits();

      for (const h of habits) {
        if (!h.reminderTime || h.reminderTime !== currentMinuteStr) continue;
        if (isCompleted(h.id, todayStr)) continue;

        // Fire web notification if permitted
        if ('Notification' in window && Notification.permission === 'granted') {
          const streak = calculateHabitStreak(h.id);
          const streakMsg = streak.current > 0 ? ` (${streak.current} day streak! 🔥)` : '';
          new Notification(`Time to ${h.name}!`, {
            body: `Stay disciplined today${streakMsg}. Tap to mark as complete.`,
            icon: './favicon.svg'
          });
        } else {
          showToast(`⏰ Reminder: Time for ${h.name}!`, 'info', 6000);
        }
      }
    } catch (e) {}
  }, 30000);
}

/**
 * Initialize reminder listeners and notification click handlers.
 */
export function initReminders() {
  // Listen for native notification clicks
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
    if (LocalNotifications && LocalNotifications.addListener) {
      try {
        LocalNotifications.addListener('localNotificationActionPerformed', (notificationAction) => {
          console.log('[Reminders] Notification tapped:', notificationAction);
          location.hash = '#habits';
        });
      } catch (e) {}
    }
  }

  // Start in-browser periodic checker
  _startWebReminderChecker();

  // Sync scheduled alarms on startup
  setTimeout(() => {
    syncAllHabitReminders();
  }, 2000);
}
