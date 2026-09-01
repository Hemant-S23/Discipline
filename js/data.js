// ============================================================
// data.js — LocalStorage data layer for Discipline
// ============================================================

const KEYS = {
  USER: 'discipline_user',
  HABITS: 'discipline_habits',
  COMPLETIONS: 'discipline_completions',
  CHECKINS: 'discipline_checkins',
  ACHIEVEMENTS: 'discipline_achievements',
  XP_LOG: 'discipline_xp_log'
};

// ── Helpers ──────────────────────────────────────────────────
function load(key, fallback = null) {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}
function save(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) { console.warn('Storage error', e); }
}
export function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function dateStr(date) {
  return `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
}
export function genId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// ── User ─────────────────────────────────────────────────────
const DEFAULT_USER = {
  name: 'Friend',
  theme: 'light',
  totalXP: 0,
  level: 1,
  avatarColor: '#7C6FF7',
  createdAt: new Date().toISOString(),
  onboardingDone: false
};
export function getUser() { return { ...DEFAULT_USER, ...load(KEYS.USER, {}) }; }
export function saveUser(user) { save(KEYS.USER, user); }
export function updateUser(updates) { saveUser({ ...getUser(), ...updates }); }

// ── Habits ───────────────────────────────────────────────────
export function getHabits() { return load(KEYS.HABITS, []); }
export function saveHabits(habits) { save(KEYS.HABITS, habits); }
export function getActiveHabits() { return getHabits().filter(h => !h.archivedAt); }
export function getArchivedHabits() { return getHabits().filter(h => !!h.archivedAt); }

export function addHabit(data) {
  const habits = getHabits();
  const habit = {
    id: genId(),
    name: data.name || 'New Habit',
    icon: data.icon || '⭐',
    category: data.category || 'personal',
    frequency: data.frequency || 'daily',
    customDays: data.customDays || [],
    difficulty: data.difficulty || 'medium',
    xpReward: data.xpReward || 20,
    reminderTime: data.reminderTime || '',
    color: data.color || '#7C6FF7',
    createdAt: new Date().toISOString(),
    archivedAt: null
  };
  habits.push(habit);
  saveHabits(habits);
  return habit;
}

export function updateHabit(id, updates) {
  const habits = getHabits();
  const idx = habits.findIndex(h => h.id === id);
  if (idx !== -1) {
    habits[idx] = { ...habits[idx], ...updates };
    saveHabits(habits);
    return habits[idx];
  }
  return null;
}

export function archiveHabit(id) {
  return updateHabit(id, { archivedAt: new Date().toISOString() });
}
export function restoreHabit(id) {
  return updateHabit(id, { archivedAt: null });
}
export function deleteHabitPermanently(id) {
  const habits = getHabits().filter(h => h.id !== id);
  saveHabits(habits);
}
export function getHabitById(id) {
  return getHabits().find(h => h.id === id) || null;
}

// ── Completions ───────────────────────────────────────────────
export function getCompletions() { return load(KEYS.COMPLETIONS, []); }
export function saveCompletions(c) { save(KEYS.COMPLETIONS, c); }

export function isCompleted(habitId, date) {
  return getCompletions().some(c => c.habitId === habitId && c.date === date);
}

export function toggleCompletion(habitId, date) {
  const completions = getCompletions();
  const idx = completions.findIndex(c => c.habitId === habitId && c.date === date);
  if (idx !== -1) {
    completions.splice(idx, 1);
    saveCompletions(completions);
    return false; // uncompleted
  } else {
    completions.push({ id: genId(), habitId, date, completedAt: new Date().toISOString() });
    saveCompletions(completions);
    return true; // completed
  }
}

export function markComplete(habitId, date) {
  if (!isCompleted(habitId, date)) {
    const completions = getCompletions();
    completions.push({ id: genId(), habitId, date, completedAt: new Date().toISOString() });
    saveCompletions(completions);
    return true;
  }
  return false;
}

export function getCompletionsForDate(date) {
  return getCompletions().filter(c => c.date === date);
}

export function getCompletionsForHabit(habitId) {
  return getCompletions().filter(c => c.habitId === habitId);
}

// ── Check-ins ─────────────────────────────────────────────────
export function getCheckins() { return load(KEYS.CHECKINS, []); }
export function saveCheckin(checkin) {
  const checkins = getCheckins();
  const idx = checkins.findIndex(c => c.date === checkin.date);
  if (idx !== -1) checkins[idx] = checkin;
  else checkins.push(checkin);
  save(KEYS.CHECKINS, checkins);
}
export function getCheckinForDate(date) {
  return getCheckins().find(c => c.date === date) || null;
}

// ── Achievements ──────────────────────────────────────────────
export function getUnlockedAchievements() { return load(KEYS.ACHIEVEMENTS, []); }
export function isAchievementUnlocked(id) {
  return getUnlockedAchievements().some(a => a.id === id);
}
export function unlockAchievement(id) {
  if (isAchievementUnlocked(id)) return false;
  const unlocked = getUnlockedAchievements();
  unlocked.push({ id, unlockedAt: new Date().toISOString() });
  save(KEYS.ACHIEVEMENTS, unlocked);
  return true;
}

// ── XP Log ────────────────────────────────────────────────────
export function getXPLog() { return load(KEYS.XP_LOG, []); }
export function addXPEntry(amount, source) {
  const log = getXPLog();
  log.push({ amount, source, date: today(), timestamp: Date.now() });
  save(KEYS.XP_LOG, log);
}
export function hasAwardedXpToday(source) {
  const log = getXPLog();
  const todayStr = today();
  return log.some(entry => entry.source === source && entry.date === todayStr);
}

// ── Analytics helpers ─────────────────────────────────────────
export function getDailyStats(daysBack = 7) {
  const completions = getCompletions();
  const habits = getActiveHabits();
  const results = [];

  for (let i = daysBack - 1; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = dateStr(d);
    const scheduled = habits.filter(h => isHabitScheduledForDate(h, ds));
    const completed = scheduled.filter(h => isCompleted(h.id, ds));
    results.push({
      date: ds,
      label: d.toLocaleDateString('en-US', { weekday: 'short' }),
      scheduled: scheduled.length,
      completed: completed.length,
      pct: scheduled.length ? Math.round((completed.length / scheduled.length) * 100) : 0
    });
  }
  return results;
}

export function isHabitScheduledForDate(habit, dateString) {
  const d = new Date(dateString + 'T00:00:00');
  const day = d.getDay(); // 0=Sun, 6=Sat
  switch (habit.frequency) {
    case 'daily': return true;
    case 'weekdays': return day >= 1 && day <= 5;
    case 'weekends': return day === 0 || day === 6;
    case 'custom': return (habit.customDays || []).includes(day);
    default: return true;
  }
}

export function getHabitConsistency(habitId, days = 30) {
  const completions = getCompletions().filter(c => c.habitId === habitId);
  const habit = getHabitById(habitId);
  if (!habit) return 0;

  let scheduled = 0, completed = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(Date.now() - i * 86400000);
    const ds = dateStr(d);
    if (isHabitScheduledForDate(habit, ds)) {
      scheduled++;
      if (completions.some(c => c.date === ds)) completed++;
    }
  }
  return scheduled ? Math.round((completed / scheduled) * 100) : 0;
}

// ── Reset (for settings) ──────────────────────────────────────
export function resetAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

export function exportData() {
  return {
    user: getUser(),
    habits: getHabits(),
    completions: getCompletions(),
    checkins: getCheckins(),
    achievements: getUnlockedAchievements(),
    xpLog: getXPLog(),
    exportedAt: new Date().toISOString()
  };
}
