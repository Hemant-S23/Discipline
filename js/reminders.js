// ============================================================
// reminders.js — Cross-platform Daily Habit Reminders
// Supports Native Android (LocalNotifications) + Web Notifications
// Features: Notification Channels, Exact Alarms, PNG Icons & Motivational Quotes
// ============================================================

import { getActiveHabits, getHabits, isCompleted, today } from './data.js?v=6.0';
import { calculateHabitStreak } from './streaks.js?v=6.0';
import { showToast } from './ui.js?v=6.0';

export const CHANNEL_ID = 'discipline_reminders';

/**
 * Curated motivational quotes focusing on discipline, habit, and obsession.
 */
export const MOTIVATIONAL_QUOTES = [
  "Discipline is choosing between what you want now and what you want most.",
  "Obsession is what lazy people call dedication.",
  "We don't rise to our expectations; we fall to the level of our training.",
  "Consistency is the DNA of mastery.",
  "Action cures anxiety; relentless discipline builds freedom.",
  "The pain of discipline is far lighter than the pain of regret.",
  "Small disciplined habits compounded daily create unstoppable results.",
  "You don't need fleeting motivation. You need unbroken discipline.",
  "Win the morning, conquer the day. Show up now.",
  "Greatness is forged in the silence of daily repetition.",
  "Be obsessed with becoming the highest version of yourself.",
  "The only bad habit session is the one you skipped.",
  "Self-discipline is the master key to personal freedom.",
  "Repetition creates conviction; conviction creates destiny."
];

export function getRandomMotivationalQuote() {
  const idx = Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length);
  return MOTIVATIONAL_QUOTES[idx];
}

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
 * Calculate the next upcoming Date for a given hour and minute.
 * If the time has already passed today, schedules for tomorrow.
 */
export function getNextScheduledDate(hour, minute) {
  const now = new Date();
  const target = new Date();
  target.setHours(hour, minute, 0, 0);
  if (target.getTime() <= now.getTime()) {
    target.setDate(target.getDate() + 1);
  }
  return target;
}

/**
 * Ensure Android 8.0+ Notification Channel exists with high priority.
 * Modern Android drops notifications if no channel is specified!
 */
export async function ensureNotificationChannel() {
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
    if (LocalNotifications && LocalNotifications.createChannel) {
      try {
        await LocalNotifications.createChannel({
          id: CHANNEL_ID,
          name: 'Habit & Discipline Reminders',
          description: 'Daily habit reminders with motivational quotes',
          importance: 5, // High priority: pops heads-up banner & plays sound
          visibility: 1, // Visible on lockscreen
          vibration: true,
          lights: true,
          lightColor: '#7C6FF7'
        });
        console.log('[Reminders] Android notification channel ensured:', CHANNEL_ID);
      } catch (err) {
        console.warn('[Reminders] Error creating notification channel:', err);
      }
    }
  }
}

/**
 * Request notification permissions across Native (Capacitor) and Web.
 */
export async function requestNotificationPermission() {
  // 1. Native Android / iOS via Capacitor
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
    if (LocalNotifications) {
      try {
        await ensureNotificationChannel();
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

  // 2. Web Browser
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
  const streakMsg = streak.current > 0 ? ` (${streak.current}d streak 🔥)` : '';
  const quote = getRandomMotivationalQuote();
  const title = `Time to ${habit.name}!${streakMsg}`;
  const body = `"${quote}" · Tap to mark complete.`;

  // 1. Android Native (Capacitor LocalNotifications)
  if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
    const LocalNotifications = window.Capacitor.Plugins?.LocalNotifications;
    if (LocalNotifications) {
      try {
        await requestNotificationPermission();
        await ensureNotificationChannel();

        // Cancel previous notification if any
        try {
          await LocalNotifications.cancel({ notifications: [{ id: notifId }] });
        } catch (e) {}

        const nextDate = getNextScheduledDate(hour, minute);

        await LocalNotifications.schedule({
          notifications: [{
            id: notifId,
            title: title,
            body: body,
            channelId: CHANNEL_ID,
            smallIcon: 'ic_launcher',
            iconColor: '#7C6FF7',
            schedule: {
              at: nextDate,
              every: 'day',
              allowWhileIdle: true
            },
            extra: { habitId: habit.id }
          }]
        });
        console.log(`[Reminders] Native reminder scheduled for "${habit.name}" at ${nextDate.toISOString()} (every: 'day', ID: ${notifId}, channel: ${CHANNEL_ID})`);
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
    await ensureNotificationChannel();

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

        const streak = calculateHabitStreak(h.id);
        const streakMsg = streak.current > 0 ? ` (${streak.current}d streak 🔥)` : '';
        const quote = getRandomMotivationalQuote();
        const title = `Time to ${h.name}!${streakMsg}`;
        const body = `"${quote}" · Tap to complete.`;

        // Fire web notification if permitted (using high-res PNG for Android Chrome compatibility)
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification(title, {
            body: body,
            icon: './icons/icon-192.png',
            badge: './icons/icon-192.png'
          });
        } else {
          showToast(`⏰ ${title} — ${quote}`, 'info', 6000);
        }
      }
    } catch (e) {}
  }, 30000);
}

/**
 * Initialize reminder listeners and notification click handlers.
 */
export function initReminders() {
  // Ensure Android notification channel is registered on startup
  ensureNotificationChannel();

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
