// ============================================================
// streaks.js — Streak calculation engine
// ============================================================

import { getCompletions, getHabitById, today, dateStr, isHabitScheduledForDate } from './data.js';

/**
 * Calculate current and best streak for a single habit.
 */
export function calculateHabitStreak(habitId) {
  const allCompletions = getCompletions()
    .filter(c => c.habitId === habitId)
    .map(c => c.date)
    .sort();

  const total = allCompletions.length;
  if (!total) return { current: 0, best: 0, total: 0 };

  const completionSet = new Set(allCompletions);
  const todayStr = today();
  const yesterdayStr = dateStr(new Date(Date.now() - 86400000));

  const mostRecent = allCompletions[allCompletions.length - 1];
  const hasActiveStart = mostRecent === todayStr || mostRecent === yesterdayStr;

  // Current streak
  let current = 0;
  if (hasActiveStart) {
    let checkDate = mostRecent === todayStr ? new Date() : new Date(Date.now() - 86400000);
    while (true) {
      const ds = dateStr(checkDate);
      if (completionSet.has(ds)) {
        current++;
        checkDate = new Date(checkDate.getTime() - 86400000);
      } else break;
    }
  }

  // Best streak
  let best = current;
  let run = 1;
  for (let i = 1; i < allCompletions.length; i++) {
    const prev = new Date(allCompletions[i - 1] + 'T00:00:00');
    const curr = new Date(allCompletions[i] + 'T00:00:00');
    const diff = Math.round((curr - prev) / 86400000);
    if (diff === 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }

  return { current, best, total };
}

/**
 * Calculate best global streak (any habit completed each day).
 */
export function calculateGlobalStreak(activeHabits) {
  if (!activeHabits.length) return { current: 0, best: 0 };

  const completions = getCompletions();
  let current = 0, best = 0, activeRun = true;

  for (let i = 0; i < 365; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = dateStr(d);
    const scheduled = activeHabits.filter(h => isHabitScheduledForDate(h, ds));
    if (!scheduled.length) continue;

    const completedIds = completions.filter(c => c.date === ds).map(c => c.habitId);
    const allDone = scheduled.every(h => completedIds.includes(h.id));

    if (allDone) {
      if (activeRun) { current++; best = Math.max(best, current); }
      else best = Math.max(best, 1);
    } else {
      if (i === 0) {
        // Today isn't finished yet — don't break streak
        continue;
      }
      activeRun = false;
      if (i > 0 && current > 0) break;
    }
  }

  return { current, best };
}

/**
 * Streak milestones config.
 */
export const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

export const MILESTONE_DATA = {
  3:   { emoji: '🌱', title: '3 Days!',   msg: "Nice start. The habit is forming." },
  7:   { emoji: '🔥', title: '7 Days!',   msg: "One week! You're building momentum." },
  14:  { emoji: '💪', title: '14 Days!',  msg: "Two weeks of pure discipline." },
  21:  { emoji: '⚡', title: '21 Days!',  msg: "Three weeks in — this is becoming automatic." },
  30:  { emoji: '🏆', title: '30 Days!',  msg: "One full month. Absolutely incredible." },
  50:  { emoji: '👑', title: '50 Days!',  msg: "Consistency unlocked. You're unstoppable." },
  75:  { emoji: '🌟', title: '75 Days!',  msg: "75 days of showing up. Legendary." },
  100: { emoji: '🦋', title: '100 Days!', msg: "100 days. You've transformed yourself." },
  150: { emoji: '🚀', title: '150 Days!', msg: "150 days. You are the system." },
  200: { emoji: '💎', title: '200 Days!', msg: "200 days. This is mastery." },
  365: { emoji: '🌈', title: '365 Days!', msg: "A full year. You are Discipline itself." }
};

export function checkMilestone(streak) {
  return MILESTONES.includes(streak) ? MILESTONE_DATA[streak] : null;
}

/**
 * Build flame chain string (e.g. "🔥🔥🔥" × streak count).
 */
export function buildChain(streak, max = 30) {
  const count = Math.min(streak, max);
  return '🔥'.repeat(count);
}

/**
 * Get sorted habits by current streak (desc).
 */
export function getHabitsByStreak(activeHabits) {
  return activeHabits
    .map(h => ({ ...h, streak: calculateHabitStreak(h.id) }))
    .sort((a, b) => b.streak.current - a.streak.current);
}
