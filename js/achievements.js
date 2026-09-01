// ============================================================
// achievements.js — Achievement definitions and unlock logic
// ============================================================

import { getCompletions, getHabits, getUser, unlockAchievement, isAchievementUnlocked, getUnlockedAchievements, today, isHabitScheduledForDate } from './data.js';
import { calculateHabitStreak } from './streaks.js';

export const ACHIEVEMENTS = [
  { id: 'first_step',       name: 'First Step',       icon: '🌱', rarity: 'common',    desc: 'Complete your very first habit.' },
  { id: 'habit_builder',    name: 'Habit Builder',     icon: '🏗️', rarity: 'common',    desc: 'Create 5 or more habits.' },
  { id: 'early_bird',       name: 'Early Bird',        icon: '🌅', rarity: 'common',    desc: 'Complete 5 habits before noon.' },
  { id: 'comeback_kid',     name: 'Comeback Kid',      icon: '🔄', rarity: 'common',    desc: 'Complete a habit after a 3-day break.' },
  { id: 'week_warrior',     name: 'Week Warrior',      icon: '⚔️', rarity: 'rare',      desc: 'Maintain a 7-day streak on any habit.' },
  { id: 'perfect_day',      name: 'Perfect Day',       icon: '🎯', rarity: 'rare',      desc: 'Complete every scheduled habit in a single day.' },
  { id: 'consistency',      name: 'Consistency',       icon: '⚡', rarity: 'rare',      desc: 'Complete the same habit 50 times.' },
  { id: 'xp_hunter',        name: 'XP Hunter',         icon: '⭐', rarity: 'rare',      desc: 'Earn 1,000 total XP.' },
  { id: 'century',          name: 'Century',           icon: '💯', rarity: 'epic',      desc: 'Reach 100 total habit completions.' },
  { id: 'monthly_master',   name: 'Monthly Master',    icon: '📅', rarity: 'epic',      desc: 'Maintain a 30-day streak on any habit.' },
  { id: 'xp_master',        name: 'XP Master',         icon: '💎', rarity: 'epic',      desc: 'Earn 5,000 total XP.' },
  { id: 'fire_starter',     name: 'Fire Starter',      icon: '🔥', rarity: 'legendary', desc: 'Reach a 100-day streak on any habit.' },
  { id: 'discipline_master',name: 'Discipline Master', icon: '👑', rarity: 'legendary', desc: 'Reach Level 10.' },
];

export function getAchievementById(id) {
  return ACHIEVEMENTS.find(a => a.id === id) || null;
}

/**
 * Check all achievements and unlock any newly earned ones.
 * Returns array of newly unlocked achievement objects.
 */
export function checkAndUnlockAchievements() {
  const newlyUnlocked = [];
  const completions = getCompletions();
  const allHabits   = getHabits();
  const habits      = allHabits.filter(h => !h.archivedAt);
  const user        = getUser();
  const todayStr    = today();
  const nowHour     = new Date().getHours();
  const todayCompleted = completions.filter(c => c.date === todayStr);

  function tryUnlock(id) {
    if (!isAchievementUnlocked(id)) {
      const success = unlockAchievement(id);
      if (success) newlyUnlocked.push(getAchievementById(id));
    }
  }

  // first_step — any completion exists
  if (completions.length >= 1) tryUnlock('first_step');

  // habit_builder — 5+ active habits
  if (habits.length >= 5) tryUnlock('habit_builder');

  // century — 100 total completions
  if (completions.length >= 100) tryUnlock('century');

  // xp_hunter — 1000 XP
  if (user.totalXP >= 1000) tryUnlock('xp_hunter');

  // xp_master — 5000 XP
  if (user.totalXP >= 5000) tryUnlock('xp_master');

  // discipline_master — level 10
  if (user.level >= 10) tryUnlock('discipline_master');

  // week_warrior — 7-day streak on any habit
  if (habits.some(h => calculateHabitStreak(h.id).current >= 7)) tryUnlock('week_warrior');

  // monthly_master — 30-day streak on any habit
  if (habits.some(h => calculateHabitStreak(h.id).current >= 30)) tryUnlock('monthly_master');

  // fire_starter — 100-day streak on any habit
  if (habits.some(h => calculateHabitStreak(h.id).best >= 100)) tryUnlock('fire_starter');

  // consistency — same habit 50 times
  if (habits.some(h => completions.filter(c => c.habitId === h.id).length >= 50)) tryUnlock('consistency');

  // perfect_day — all scheduled habits done today
  const todayScheduled = habits.filter(h => isHabitScheduledForDate(h, todayStr));
  if (todayScheduled.length > 0 && todayScheduled.every(h => todayCompleted.some(c => c.habitId === h.id))) {
    tryUnlock('perfect_day');
  }

  // early_bird — 5 completions before noon today (simple: 5 completions exist and hour < 12)
  if (nowHour < 12 && todayCompleted.length >= 5) tryUnlock('early_bird');

  // comeback_kid — completed a habit after a 3-day gap
  if (!isAchievementUnlocked('comeback_kid')) {
    const { dateStr: ds, today: td } = (() => {
      // inline helper
      const dateStr2 = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
      return { dateStr: dateStr2, today: dateStr2(new Date()) };
    })();
    outer: for (const h of habits) {
      const hCompletions = completions
        .filter(c => c.habitId === h.id)
        .map(c => c.date)
        .sort();
      if (hCompletions.length < 2) continue;
      for (let i = 1; i < hCompletions.length; i++) {
        const prev = new Date(hCompletions[i-1] + 'T00:00:00');
        const curr = new Date(hCompletions[i] + 'T00:00:00');
        const gap  = Math.round((curr - prev) / 86400000);
        if (gap >= 3) { tryUnlock('comeback_kid'); break outer; }
      }
    }
  }

  return newlyUnlocked;
}

/**
 * Get progress info for an achievement (for progress bar in card).
 */
export function getAchievementProgress(id) {
  const completions = getCompletions();
  const habits      = getHabits().filter(h => !h.archivedAt);
  const user        = getUser();

  switch (id) {
    case 'first_step':    return { current: Math.min(completions.length, 1), total: 1 };
    case 'habit_builder': return { current: Math.min(habits.length, 5), total: 5 };
    case 'century':       return { current: Math.min(completions.length, 100), total: 100 };
    case 'xp_hunter':     return { current: Math.min(user.totalXP, 1000), total: 1000 };
    case 'xp_master':     return { current: Math.min(user.totalXP, 5000), total: 5000 };
    case 'discipline_master': return { current: Math.min(user.level, 10), total: 10 };
    case 'week_warrior': {
      const best = habits.reduce((m, h) => Math.max(m, calculateHabitStreak(h.id).current), 0);
      return { current: Math.min(best, 7), total: 7 };
    }
    case 'monthly_master': {
      const best = habits.reduce((m, h) => Math.max(m, calculateHabitStreak(h.id).current), 0);
      return { current: Math.min(best, 30), total: 30 };
    }
    case 'consistency': {
      const best = habits.reduce((m, h) => Math.max(m, getCompletions().filter(c => c.habitId === h.id).length), 0);
      return { current: Math.min(best, 50), total: 50 };
    }
    default: return null;
  }
}

export function renderAchievementsPage() {
  const container = document.getElementById('achievements-grid');
  if (!container) return;

  const unlockedIds = getUnlockedAchievements().map(a => a.id);

  container.innerHTML = ACHIEVEMENTS.map(a => {
    const isUnlocked = unlockedIds.includes(a.id);
    const prog = getAchievementProgress(a.id);
    const progPct = prog ? Math.round((prog.current / prog.total) * 100) : 0;
    const unlocked = getUnlockedAchievements().find(u => u.id === a.id);
    const unlockedDate = unlocked ? new Date(unlocked.unlockedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '';

    return `
      <div class="achievement-card ${isUnlocked ? '' : 'locked'} slide-in-up">
        <div class="achievement-icon">${a.icon}</div>
        <span class="rarity-badge rarity-${a.rarity}">${a.rarity}</span>
        <div class="achievement-name">${a.name}</div>
        <div class="achievement-desc">${a.desc}</div>
        ${isUnlocked
          ? `<div class="achievement-unlocked-label">✓ Unlocked ${unlockedDate}</div>`
          : prog
            ? `<div class="achievement-progress"><div class="achievement-progress-bar" style="width:${progPct}%"></div></div>
               <div style="font-size:11px;color:var(--text-3)">${prog.current} / ${prog.total}</div>`
            : '<div style="font-size:11px;color:var(--text-3)">Keep going!</div>'
        }
      </div>
    `;
  }).join('');
}
