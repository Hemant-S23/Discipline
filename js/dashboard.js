// ============================================================
// dashboard.js — Dashboard page rendering
// ============================================================

import {
  getUser, getActiveHabits, getCompletions, getCompletionsForDate,
  today, dateStr, isHabitScheduledForDate, isCompleted, getDailyStats
} from './data.js';
import { getLevelInfo, getCurrentLevelInfo } from './xp.js';
import { calculateHabitStreak, calculateGlobalStreak } from './streaks.js';
import { renderTodayHabits } from './habits.js';
import { getGreeting, getDailyQuote, getTodayLong, pctBar, formatNumber } from './ui.js';

let chartDaily = null;
let chartWeekly = null;

/**
 * Main dashboard render — called on page load and after habit toggles.
 */
export function renderDashboard() {
  renderHeader();
  renderScoreCard();
  renderProgressCard();
  renderStreakCard();
  renderXPCard();
  renderTodayHabits('today-habits-list');
  renderMiniCharts();
}

// ── Header ────────────────────────────────────────────────────
function renderHeader() {
  const user = getUser();
  const greeting = getGreeting();
  const quote    = getDailyQuote();
  const todayLong = getTodayLong();

  const dateEl   = document.getElementById('dash-date');
  const greetEl  = document.getElementById('dash-greeting');
  const quoteEl  = document.getElementById('dash-quote');

  if (dateEl)  dateEl.textContent  = todayLong;
  if (greetEl) greetEl.textContent = `${greeting}, ${user.name} 👋`;
  if (quoteEl) quoteEl.textContent = `"${quote}"`;

  // Sidebar user info
  const nameEl  = document.getElementById('sidebar-user-name');
  const levelEl = document.getElementById('sidebar-user-level');
  const avatarEl = document.getElementById('sidebar-avatar');

  if (nameEl)   nameEl.textContent  = user.name;
  if (levelEl) {
    const info = getCurrentLevelInfo();
    levelEl.textContent = `Lv.${info.level} · ${info.name}`;
  }
  if (avatarEl) avatarEl.textContent = (user.name || 'F')[0].toUpperCase();
}

// ── Discipline Score ──────────────────────────────────────────
function renderScoreCard() {
  const score   = calculateDisciplineScore();
  const numEl   = document.getElementById('dash-score-number');
  const ringEl  = document.getElementById('score-ring');

  if (numEl) numEl.textContent = score;

  if (ringEl) {
    const circumference = 2 * Math.PI * 45; // r=45
    const offset = circumference - (score / 100) * circumference;
    ringEl.style.strokeDasharray  = circumference;
    ringEl.style.strokeDashoffset = offset;
  }
}

function calculateDisciplineScore() {
  const habits  = getActiveHabits();
  if (!habits.length) return 0;

  const completions = getCompletions();
  const todayStr    = today();

  // 1. Daily completion (40%)
  const todayScheduled = habits.filter(h => isHabitScheduledForDate(h, todayStr));
  const todayCompleted = todayScheduled.filter(h => isCompleted(h.id, todayStr));
  const dailyScore = todayScheduled.length
    ? (todayCompleted.length / todayScheduled.length) * 40
    : 20; // partial credit if no habits today

  // 2. Habit consistency 30-day (25%)
  let totalConsistency = 0;
  habits.forEach(h => {
    let sched = 0, done = 0;
    for (let i = 0; i < 30; i++) {
      const d = dateStr(new Date(Date.now() - i * 86400000));
      if (isHabitScheduledForDate(h, d)) {
        sched++;
        if (completions.some(c => c.habitId === h.id && c.date === d)) done++;
      }
    }
    totalConsistency += sched ? done / sched : 0;
  });
  const consistencyScore = (totalConsistency / habits.length) * 25;

  // 3. Streak performance (20%)
  const maxStreak    = habits.reduce((m, h) => Math.max(m, calculateHabitStreak(h.id).current), 0);
  const streakScore  = Math.min(maxStreak / 30, 1) * 20;

  // 4. Weekly consistency (15%)
  let daysActive = 0;
  for (let i = 1; i <= 7; i++) {
    const d = dateStr(new Date(Date.now() - i * 86400000));
    if (completions.some(c => c.date === d)) daysActive++;
  }
  const weeklyScore = (daysActive / 7) * 15;

  return Math.min(100, Math.round(dailyScore + consistencyScore + streakScore + weeklyScore));
}

// ── Progress Card ─────────────────────────────────────────────
function renderProgressCard() {
  const habits       = getActiveHabits();
  const todayStr     = today();
  const scheduled    = habits.filter(h => isHabitScheduledForDate(h, todayStr));
  const completed    = scheduled.filter(h => isCompleted(h.id, todayStr));
  const total        = scheduled.length;
  const done         = completed.length;
  const pct          = total ? Math.round((done / total) * 100) : 0;
  const remaining    = total - done;

  const fracEl       = document.getElementById('dash-progress-fraction');
  const pctEl        = document.getElementById('dash-progress-pct');
  const remEl        = document.getElementById('dash-progress-remaining');
  const barEl        = document.getElementById('dash-progress-bar');

  if (fracEl) fracEl.innerHTML = `${done} <span class="total">/ ${total}</span>`;
  if (pctEl)  pctEl.textContent  = `${pct}%`;
  if (remEl)  remEl.textContent  = remaining === 0
    ? '🎉 All done for today!'
    : `${remaining} habit${remaining === 1 ? '' : 's'} remaining`;
  if (barEl) {
    barEl.style.width = `${pct}%`;
    barEl.classList.toggle('full', pct === 100);
  }
}

// ── Streak Card ───────────────────────────────────────────────
function renderStreakCard() {
  const habits = getActiveHabits();
  const global = calculateGlobalStreak(habits);

  const numEl  = document.getElementById('dash-streak-number');
  const bestEl = document.getElementById('dash-streak-best');
  const fireEl = document.querySelector('.streak-fire');

  if (numEl)  numEl.textContent  = global.current;
  if (bestEl) bestEl.textContent = `Best: ${global.best} days`;
  if (fireEl && global.current > 0) fireEl.style.filter = `drop-shadow(0 0 ${Math.min(global.current * 2, 20)}px rgba(249,115,22,0.7))`;
}

// ── XP Card ───────────────────────────────────────────────────
function renderXPCard() {
  const user  = getUser();
  const info  = getLevelInfo(user.totalXP);

  const xpEl    = document.getElementById('dash-xp-number');
  const lvlEl   = document.getElementById('dash-level-badge');
  const barEl   = document.getElementById('dash-level-bar');
  const infoEl  = document.getElementById('dash-level-xp-info');

  if (xpEl)   xpEl.textContent = formatNumber(user.totalXP);
  if (lvlEl)  lvlEl.textContent = `⚡ Lv.${info.level} · ${info.name}`;
  if (barEl)  barEl.style.width  = `${info.progress}%`;
  if (infoEl) infoEl.textContent = info.isMaxLevel
    ? '🏆 Max Level!'
    : `${info.xpToNext} XP to Lv.${info.level + 1}`;
}

// ── Mini Charts ───────────────────────────────────────────────
function renderMiniCharts() {
  if (typeof Chart === 'undefined') return;

  const stats = getDailyStats(7);
  const labels = stats.map(s => s.label);
  const data   = stats.map(s => s.pct);

  const ctxDaily = document.getElementById('chart-daily');
  if (ctxDaily) {
    if (chartDaily) chartDaily.destroy();
    chartDaily = new Chart(ctxDaily, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          data,
          backgroundColor: data.map(v => v === 100
            ? 'rgba(34, 197, 94, 0.8)'
            : 'rgba(124, 111, 247, 0.75)'),
          borderRadius: 8,
          borderSkipped: false
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => `${ctx.raw}% completed` }
        }},
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(107,104,128,0.8)', font: { size: 11 } } },
          y: { min: 0, max: 100, grid: { color: 'rgba(124,111,247,0.08)' }, ticks: {
            color: 'rgba(107,104,128,0.8)', font: { size: 10 },
            callback: v => `${v}%`, stepSize: 25
          }}
        }
      }
    });
  }

  // Weekly (last 4 weeks)
  const ctxWeekly = document.getElementById('chart-weekly');
  if (ctxWeekly) {
    if (chartWeekly) chartWeekly.destroy();
    const weekStats = getWeeklyStats();
    chartWeekly = new Chart(ctxWeekly, {
      type: 'line',
      data: {
        labels: weekStats.map(w => w.label),
        datasets: [{
          data: weekStats.map(w => w.pct),
          borderColor: '#7C6FF7',
          backgroundColor: 'rgba(124, 111, 247, 0.12)',
          borderWidth: 3,
          pointBackgroundColor: '#7C6FF7',
          pointRadius: 5,
          pointHoverRadius: 7,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: {
          callbacks: { label: ctx => `${ctx.raw}% completion` }
        }},
        scales: {
          x: { grid: { display: false }, ticks: { color: 'rgba(107,104,128,0.8)', font: { size: 11 } } },
          y: { min: 0, max: 100, grid: { color: 'rgba(124,111,247,0.08)' }, ticks: {
            color: 'rgba(107,104,128,0.8)', font: { size: 10 },
            callback: v => `${v}%`, stepSize: 25
          }}
        }
      }
    });
  }
}

function getWeeklyStats() {
  const completions = getCompletions();
  const habits = getActiveHabits();
  const weeks = [];

  for (let w = 3; w >= 0; w--) {
    let scheduled = 0, completed = 0;
    for (let d = 0; d < 7; d++) {
      const dayOffset = w * 7 + d;
      const ds = dateStr(new Date(Date.now() - dayOffset * 86400000));
      const scheds = habits.filter(h => isHabitScheduledForDate(h, ds));
      const dones  = scheds.filter(h => completions.some(c => c.habitId === h.id && c.date === ds));
      scheduled += scheds.length;
      completed += dones.length;
    }
    weeks.push({
      label: w === 0 ? 'This wk' : `${w}w ago`,
      pct: scheduled ? Math.round((completed / scheduled) * 100) : 0
    });
  }
  return weeks;
}
