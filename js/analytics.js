// ============================================================
// analytics.js — Analytics page: charts, stats, top habits
// ============================================================

import {
  getActiveHabits, getCompletions, getDailyStats, today, dateStr,
  isHabitScheduledForDate, isCompleted, getHabitConsistency
} from './data.js';
import { calculateHabitStreak } from './streaks.js';
import { getUser } from './data.js';
import { CATEGORY_ICONS } from './ui.js';

let chartDailyAnalytics = null;
let chartWeeklyAnalytics = null;

export function renderAnalyticsPage() {
  renderOverviewStats();
  renderTopHabits();
  renderNeedsAttention();
  renderAnalyticsCharts();
}

// ── Overview Stats ────────────────────────────────────────────
function renderOverviewStats() {
  const completions = getCompletions();
  const habits      = getActiveHabits();
  const user        = getUser();
  const todayStr    = today();

  // Total completions (all time)
  const totalCompletions = completions.length;

  // 30-day completion %
  let sched30 = 0, done30 = 0;
  for (let i = 0; i < 30; i++) {
    const d = dateStr(new Date(Date.now() - i * 86400000));
    const s = habits.filter(h => isHabitScheduledForDate(h, d));
    sched30 += s.length;
    done30  += s.filter(h => completions.some(c => c.habitId === h.id && c.date === d)).length;
  }
  const pct30 = sched30 ? Math.round((done30 / sched30) * 100) : 0;

  // Best streak across all habits
  const bestStreak = habits.reduce((m, h) => Math.max(m, calculateHabitStreak(h.id).best), 0);

  const els = {
    'stat-total-completions': totalCompletions,
    'stat-30-pct':            `${pct30}%`,
    'stat-best-streak':       `${bestStreak} 🔥`,
    'stat-total-xp':          `⭐ ${user.totalXP}`
  };

  Object.entries(els).forEach(([id, val]) => {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  });
}

// ── Top Habits ────────────────────────────────────────────────
function renderTopHabits() {
  const container = document.getElementById('top-habits-list');
  if (!container) return;

  const habits = getActiveHabits();
  if (!habits.length) { container.innerHTML = '<p style="color:var(--text-3)">No habits yet.</p>'; return; }

  const habitStats = habits.map(h => ({
    ...h,
    consistency: getHabitConsistency(h.id, 30)
  })).sort((a, b) => b.consistency - a.consistency);

  container.innerHTML = habitStats.slice(0, 8).map((h, i) => `
    <div class="top-habit-item">
      <div class="top-habit-rank">#${i + 1}</div>
      <div class="top-habit-icon">${h.icon}</div>
      <div class="top-habit-info">
        <div class="top-habit-name">${h.name}</div>
        <div class="top-habit-pct-bar-wrap">
          <div class="top-habit-pct-bar" style="width:${h.consistency}%"></div>
        </div>
      </div>
      <div class="top-habit-pct">${h.consistency}%</div>
    </div>
  `).join('');
}

// ── Needs Attention ───────────────────────────────────────────
function renderNeedsAttention() {
  const container = document.getElementById('needs-attention-list');
  if (!container) return;

  const habits = getActiveHabits();
  const weak = habits
    .map(h => ({ ...h, consistency: getHabitConsistency(h.id, 30) }))
    .filter(h => h.consistency < 60)
    .sort((a, b) => a.consistency - b.consistency)
    .slice(0, 4);

  if (!weak.length) {
    container.innerHTML = '<div style="text-align:center;color:var(--success);padding:20px;font-size:15px;font-weight:700">🎉 All habits are on track!</div>';
    return;
  }

  container.innerHTML = weak.map(h => `
    <div class="top-habit-item">
      <div class="top-habit-icon">${h.icon}</div>
      <div class="top-habit-info">
        <div class="top-habit-name">${h.name}</div>
        <div class="top-habit-pct-bar-wrap">
          <div class="top-habit-pct-bar" style="width:${h.consistency}%;background:linear-gradient(90deg,var(--streak),var(--xp))"></div>
        </div>
      </div>
      <div class="top-habit-pct" style="color:var(--streak)">${h.consistency}%</div>
    </div>
  `).join('');
}

// ── Charts ────────────────────────────────────────────────────
function renderAnalyticsCharts() {
  if (typeof Chart === 'undefined') return;

  const stats = getDailyStats(14); // last 14 days

  const ctxDaily = document.getElementById('chart-analytics-daily');
  if (ctxDaily) {
    if (chartDailyAnalytics) chartDailyAnalytics.destroy();
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,111,247,0.08)';
    const tickColor = isDark ? 'rgba(200,200,220,0.6)' : 'rgba(107,104,128,0.8)';

    chartDailyAnalytics = new Chart(ctxDaily, {
      type: 'bar',
      data: {
        labels: stats.map(s => s.label),
        datasets: [{
          label: 'Completion %',
          data: stats.map(s => s.pct),
          backgroundColor: stats.map(s => s.pct >= 100
            ? 'rgba(34,197,94,0.85)'
            : s.pct >= 70
              ? 'rgba(124,111,247,0.80)'
              : 'rgba(249,115,22,0.70)'),
          borderRadius: 8,
          borderSkipped: false,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: ctx => `${ctx.raw}% completed (${stats[ctx.dataIndex].completed}/${stats[ctx.dataIndex].scheduled})` } }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11 } } },
          y: { min: 0, max: 100, grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 10 }, callback: v => `${v}%`, stepSize: 25 } }
        }
      }
    });
  }

  // Monthly heatmap-style (weekly bars)
  const ctxWeekly = document.getElementById('chart-analytics-weekly');
  if (ctxWeekly) {
    if (chartWeeklyAnalytics) chartWeeklyAnalytics.destroy();
    const weeklyStats = getExtendedWeeklyStats(8);
    const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(124,111,247,0.08)';
    const tickColor = isDark ? 'rgba(200,200,220,0.6)' : 'rgba(107,104,128,0.8)';

    chartWeeklyAnalytics = new Chart(ctxWeekly, {
      type: 'line',
      data: {
        labels: weeklyStats.map(w => w.label),
        datasets: [{
          label: 'Weekly %',
          data: weeklyStats.map(w => w.pct),
          borderColor: '#7C6FF7',
          backgroundColor: 'rgba(124,111,247,0.10)',
          borderWidth: 3,
          pointBackgroundColor: '#7C6FF7',
          pointRadius: 5,
          pointHoverRadius: 8,
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => `${ctx.raw}%` } } },
        scales: {
          x: { grid: { display: false }, ticks: { color: tickColor, font: { size: 11 } } },
          y: { min: 0, max: 100, grid: { color: gridColor },
            ticks: { color: tickColor, font: { size: 10 }, callback: v => `${v}%`, stepSize: 25 } }
        }
      }
    });
  }
}

function getExtendedWeeklyStats(weeksBack) {
  const completions = getCompletions();
  const habits      = getActiveHabits();
  const result      = [];

  for (let w = weeksBack - 1; w >= 0; w--) {
    let sched = 0, done = 0;
    const startDay = w * 7;
    for (let d = 0; d < 7; d++) {
      const ds = dateStr(new Date(Date.now() - (startDay + d) * 86400000));
      const s  = habits.filter(h => isHabitScheduledForDate(h, ds));
      sched   += s.length;
      done    += s.filter(h => completions.some(c => c.habitId === h.id && c.date === ds)).length;
    }
    // Label: "Aug 25" for start of week
    const weekStart = new Date(Date.now() - (w * 7 + 6) * 86400000);
    result.push({
      label: weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
      pct:   sched ? Math.round((done / sched) * 100) : 0
    });
  }
  return result;
}
