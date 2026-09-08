// ============================================================
// streaks.js — Streak calculation engine
// ============================================================

import { getCompletions, getHabitById, today, dateStr, isHabitScheduledForDate } from './data.js?v=5.0';

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
  3:   { key: 'sprout', title: '3 Days',   msg: "Initial habit momentum established." },
  7:   { key: 'flame',  title: '7 Days',   msg: "One full week of continuous discipline." },
  14:  { key: 'activity', title: '14 Days', msg: "Two weeks of consistent execution." },
  21:  { key: 'zap',    title: '21 Days',  msg: "Three weeks in — habit is becoming automatic." },
  30:  { key: 'trophy', title: '30 Days',  msg: "One month of unbroken consistency." },
  50:  { key: 'crown',  title: '50 Days',  msg: "High consistency unlocked." },
  75:  { key: 'star',   title: '75 Days',  msg: "75 days of showing up without fail." },
  100: { key: 'award',  title: '100 Days', msg: "100-day milestone reached." },
  150: { key: 'target', title: '150 Days', msg: "150 days of peak discipline." },
  200: { key: 'diamond', title: '200 Days', msg: "Mastery level achieved." },
  365: { key: 'shield', title: '365 Days', msg: "One full year of unbreakable discipline." }
};

export function checkMilestone(streak) {
  return MILESTONES.includes(streak) ? MILESTONE_DATA[streak] : null;
}

/**
 * Build vector flame chain nodes.
 */
export function buildChain(streak, max = 28) {
  const count = Math.min(streak, max);
  if (count === 0) {
    return `<span style="font-size:13px;color:var(--text-3);font-weight:600">Start your streak today</span>`;
  }
  let html = '';
  for (let i = 0; i < count; i++) {
    html += `<span class="chain-node active" title="Day ${i + 1}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></span>`;
  }
  return html;
}

/**
 * Get sorted habits by current streak (desc).
 */
export function getHabitsByStreak(activeHabits) {
  return activeHabits
    .map(h => ({ ...h, streak: calculateHabitStreak(h.id) }))
    .sort((a, b) => b.streak.current - a.streak.current);
}
