// ============================================================
// streaks.js — High-precision Streak & Consistency Engine
// ============================================================

import { getCompletions, getHabitById, today, dateStr, isHabitScheduledForDate, isCompleted } from './data.js?v=6.0';

/**
 * Calculate current, best streak, 7-day sparkline trajectory, and 30-day consistency for a single habit.
 */
export function calculateHabitStreak(habitId) {
  const allCompletions = getCompletions()
    .filter(c => c.habitId === habitId)
    .map(c => c.date)
    .sort();

  const total = allCompletions.length;
  const habit = getHabitById(habitId);
  const todayStr = today();

  // 7-day sparkline trajectory (past 6 days + today)
  const last7Days = [];
  const dayNames = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = dateStr(d);
    const scheduled = habit ? isHabitScheduledForDate(habit, ds) : true;
    const done = allCompletions.includes(ds);
    last7Days.push({
      date: ds,
      completed: done,
      scheduled,
      isToday: ds === todayStr,
      dayLetter: dayNames[d.getDay()]
    });
  }

  // 30-day consistency rate
  let scheduled30d = 0;
  let completed30d = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = dateStr(d);
    const scheduled = habit ? isHabitScheduledForDate(habit, ds) : true;
    if (scheduled) {
      scheduled30d++;
      if (allCompletions.includes(ds)) completed30d++;
    }
  }
  const consistency30d = scheduled30d > 0 ? Math.round((completed30d / scheduled30d) * 100) : (total > 0 ? 100 : 0);

  if (!total) {
    return { current: 0, best: 0, total: 0, last7Days, consistency30d: 0 };
  }

  const completionSet = new Set(allCompletions);
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

  return { current, best: Math.max(best, current), total, last7Days, consistency30d };
}

/**
 * Calculate executive global streak & consistency index across all habits.
 */
export function calculateGlobalStreak(activeHabits) {
  if (!activeHabits || !activeHabits.length) {
    return { current: 0, best: 0, totalHabits: 0, habitsOnTrack: 0, consistency30d: 0 };
  }

  const completions = getCompletions();
  const todayStr = today();
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

  // Count habits on track today
  const todayDoneIds = completions.filter(c => c.date === todayStr).map(c => c.habitId);
  const habitsOnTrack = activeHabits.filter(h => {
    const isDoneToday = todayDoneIds.includes(h.id);
    const s = calculateHabitStreak(h.id);
    return isDoneToday || s.current > 0;
  }).length;

  // 30-day global consistency index
  let totalScheduled = 0;
  let totalCompleted = 0;
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = dateStr(d);
    const scheduled = activeHabits.filter(h => isHabitScheduledForDate(h, ds));
    totalScheduled += scheduled.length;
    const completedCount = completions.filter(c => c.date === ds).length;
    totalCompleted += Math.min(completedCount, scheduled.length);
  }
  const consistency30d = totalScheduled > 0 ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  return {
    current,
    best: Math.max(best, current),
    totalHabits: activeHabits.length,
    habitsOnTrack,
    consistency30d
  };
}

/**
 * Annual Activity Heatmap Engine (GitHub-Style 52-Week Matrix).
 * Computes 53 columns of 7-day cells starting on Monday and ending on Sunday.
 */
export function calculateAnnualActivity(activeHabits) {
  const completions = getCompletions();
  const completionsByDate = new Map();
  completions.forEach(c => {
    completionsByDate.set(c.date, (completionsByDate.get(c.date) || 0) + 1);
  });

  const todayObj = new Date();
  const todayStr = today();
  const dayOfWeekToday = (todayObj.getDay() + 6) % 7; // Monday = 0, Sunday = 6

  // 52 full weeks back from the start of the current week
  const totalDaysBack = 52 * 7 + dayOfWeekToday;
  const startDate = new Date(todayObj.getTime() - totalDaysBack * 86400000);

  const weeks = [];
  let currentWeek = [];
  let totalCompletionsLastYear = 0;
  let activeDaysCount = 0;
  let maxDaily = 0;

  const monthLabels = [];
  let lastMonth = -1;
  let lastYear = -1;
  let colIndex = 0;

  const cursor = new Date(startDate);
  // End on the Sunday of the current week
  const endDate = new Date(todayObj.getTime() + (6 - dayOfWeekToday) * 86400000);

  while (cursor <= endDate) {
    const ds = dateStr(cursor);
    const isFuture = ds > todayStr;
    const count = isFuture ? 0 : (completionsByDate.get(ds) || 0);

    if (!isFuture && count > 0) {
      totalCompletionsLastYear += count;
      activeDaysCount++;
      if (count > maxDaily) maxDaily = count;
    }

    // Intensity Level: 0 to 4
    let level = 0;
    if (!isFuture) {
      if (count >= 5) level = 4;
      else if (count >= 3) level = 3;
      else if (count >= 2) level = 2;
      else if (count >= 1) level = 1;
    }

    const dayItem = {
      date: ds,
      count,
      level,
      isToday: ds === todayStr,
      isFuture,
      dayOfWeek: (cursor.getDay() + 6) % 7, // 0 = Mon, 6 = Sun
      month: cursor.getMonth(),
      year: cursor.getFullYear()
    };

    currentWeek.push(dayItem);

    if (currentWeek.length === 7) {
      // Check if a new month starts in this week
      const firstDay = currentWeek[0];
      if (firstDay.month !== lastMonth) {
        const monthShort = new Date(firstDay.year, firstDay.month, 1).toLocaleDateString('en-US', { month: 'short' });
        const isYearChange = lastYear === -1 || firstDay.year !== lastYear;
        const yearShort = `'${String(firstDay.year).slice(2)}`;
        
        monthLabels.push({
          colIndex,
          label: monthShort,
          year: firstDay.year,
          yearShort,
          isYearChange
        });
        lastMonth = firstDay.month;
        lastYear = firstDay.year;
      }
      weeks.push(currentWeek);
      currentWeek = [];
      colIndex++;
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  if (currentWeek.length) {
    weeks.push(currentWeek);
  }

  const startMonthStr = new Date(startDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const endMonthStr = todayObj.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  const timelineRange = `${startMonthStr} – ${endMonthStr}`;

  return {
    weeks,
    monthLabels,
    timelineRange,
    totalCompletionsLastYear,
    activeDaysCount,
    maxDaily
  };
}

/**
 * Streak milestones configuration.
 */
export const MILESTONES = [3, 7, 14, 21, 30, 50, 75, 100, 150, 200, 365];

export const MILESTONE_DATA = {
  3:   { key: 'sprout',   title: '3 Days',   name: 'Spark',       msg: 'Initial discipline momentum established.' },
  7:   { key: 'flame',    title: '7 Days',   name: 'Momentum',    msg: 'One unbroken week of continuous focus.' },
  14:  { key: 'activity', title: '14 Days',  name: 'Habituation', msg: 'Two weeks of consistent execution.' },
  21:  { key: 'zap',      title: '21 Days',  name: 'Automatic',   msg: 'Neuro-pathway habits beginning to lock in.' },
  30:  { key: 'trophy',   title: '30 Days',  name: 'Rewired',     msg: 'One full month of unyielding discipline.' },
  50:  { key: 'crown',    title: '50 Days',  name: 'Iron Will',   msg: 'High-performance consistency standard.' },
  75:  { key: 'star',     title: '75 Days',  name: 'Relentless',  msg: '75 days of showing up without fail.' },
  100: { key: 'award',    title: '100 Days', name: 'Centurion',   msg: 'Triple-digit elite consistency club.' },
  150: { key: 'target',   title: '150 Days', name: 'Mastery',     msg: '150 consecutive days of execution.' },
  200: { key: 'diamond',  title: '200 Days', name: 'Sovereign',   msg: 'Unbreakable life habituation.' },
  365: { key: 'shield',   title: '365 Days', name: 'Legend',      msg: 'One full year of unbroken discipline.' }
};

export function checkMilestone(streak) {
  return MILESTONES.includes(streak) ? MILESTONE_DATA[streak] : null;
}

export function getNextMilestone(streak) {
  const next = MILESTONES.find(m => m > streak) || 365;
  const prev = [...MILESTONES].reverse().find(m => m <= streak) || 0;
  const remaining = Math.max(0, next - streak);
  const totalSpan = next - prev;
  const currentSpan = streak - prev;
  const progressPct = totalSpan > 0 ? Math.min(100, Math.round((currentSpan / totalSpan) * 100)) : 100;

  return {
    nextMilestone: next,
    data: MILESTONE_DATA[next] || MILESTONE_DATA[365],
    remaining,
    progressPct
  };
}

/**
 * Build flame chain (standard fire emoji chain as requested by user).
 */
export function buildChain(streak, max = 28) {
  const count = Math.min(streak, max);
  if (count <= 0) {
    return '🔥';
  }
  return '🔥'.repeat(count);
}

/**
 * Get sorted habits by current streak (desc).
 */
export function getHabitsByStreak(activeHabits) {
  return activeHabits
    .map(h => ({ ...h, streak: calculateHabitStreak(h.id) }))
    .sort((a, b) => b.streak.current - a.streak.current || b.streak.best - a.streak.best);
}
