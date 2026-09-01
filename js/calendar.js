// ============================================================
// calendar.js — Habit matrix calendar
// ============================================================

import {
  getActiveHabits, getCompletions, isCompleted, toggleCompletion,
  today, dateStr, isHabitScheduledForDate
} from './data.js';
import { showToast } from './ui.js';

let currentMonth = new Date().getMonth();
let currentYear  = new Date().getFullYear();

export function renderCalendarPage() {
  renderCalendarNav();
  renderMatrix();
}

function renderCalendarNav() {
  const d = new Date(currentYear, currentMonth, 1);
  const label = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const el = document.getElementById('calendar-month-label');
  if (el) el.textContent = label;
}

export function calendarPrev() {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderCalendarPage();
}

export function calendarNext() {
  const now = new Date();
  if (currentYear > now.getFullYear() || (currentYear === now.getFullYear() && currentMonth >= now.getMonth())) return;
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderCalendarPage();
}

function renderMatrix() {
  const container = document.getElementById('calendar-matrix-wrap');
  if (!container) return;

  const habits  = getActiveHabits();
  const todayStr = today();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const days = Array.from({ length: daysInMonth }, (_, i) => {
    const d = new Date(currentYear, currentMonth, i + 1);
    return {
      day: i + 1,
      dateStr: dateStr(d),
      isToday: dateStr(d) === todayStr,
      isFuture: d > new Date()
    };
  });

  if (!habits.length) {
    container.innerHTML = '<div class="empty-state"><div class="empty-icon">📅</div><p>Add habits to see them here.</p></div>';
    return;
  }

  // Build table
  let html = '<div class="calendar-matrix"><table class="matrix-table"><thead><tr>';
  html += '<th>Habit</th>';
  days.forEach(d => {
    const dow = ['S','M','T','W','T','F','S'][new Date(currentYear, currentMonth, d.day).getDay()];
    html += `<th class="${d.isToday ? 'text-accent' : ''}">${d.day}<br><span style="font-size:9px;opacity:0.6">${dow}</span></th>`;
  });
  html += '</tr></thead><tbody>';

  habits.forEach(h => {
    html += `<tr><td><div class="matrix-habit-name">${h.icon} ${h.name}</div></td>`;
    days.forEach(d => {
      const scheduled = isHabitScheduledForDate(h, d.dateStr);
      const done      = isCompleted(h.id, d.dateStr);
      let cls = 'matrix-cell';
      if (!scheduled)  cls += ' not-scheduled';
      else if (done)   cls += ' done';
      if (d.isToday)   cls += ' today';
      if (d.isFuture)  cls += ' future';

      const clickable = scheduled && !d.isFuture;
      html += `<td class="${cls}" ${clickable ? `onclick="calendarToggle('${h.id}','${d.dateStr}')"` : ''}>
        <div class="matrix-dot">${done ? '✓' : ''}</div>
      </td>`;
    });
    html += '</tr>';
  });

  html += '</tbody></table></div>';
  container.innerHTML = html;

  // Monthly summary row
  renderMonthlySummary(habits, days);
}

function renderMonthlySummary(habits, days) {
  const container = document.getElementById('calendar-summary');
  if (!container) return;

  let totalScheduled = 0, totalCompleted = 0;
  days.forEach(d => {
    if (!d.isFuture) {
      const s = habits.filter(h => isHabitScheduledForDate(h, d.dateStr));
      const c = s.filter(h => isCompleted(h.id, d.dateStr));
      totalScheduled += s.length;
      totalCompleted += c.length;
    }
  });

  const pct = totalScheduled ? Math.round((totalCompleted / totalScheduled) * 100) : 0;
  const missed = totalScheduled - totalCompleted;

  container.innerHTML = `
    <div class="stats-row" style="grid-template-columns:repeat(3,1fr);margin-top:20px">
      <div class="card card-sm text-center">
        <div class="stat-overview-value" style="color:var(--success)">${totalCompleted}</div>
        <div class="stat-overview-label">Completed</div>
      </div>
      <div class="card card-sm text-center">
        <div class="stat-overview-value" style="color:var(--danger)">${missed}</div>
        <div class="stat-overview-label">Missed</div>
      </div>
      <div class="card card-sm text-center">
        <div class="stat-overview-value" style="color:var(--accent)">${pct}%</div>
        <div class="stat-overview-label">Consistency</div>
      </div>
    </div>
  `;
}

window.calendarToggle = function(habitId, ds) {
  const todayStr = today();
  const d = new Date(ds + 'T00:00:00');
  if (d > new Date()) return;

  toggleCompletion(habitId, ds);
  renderMatrix();

  // If toggling today, re-render dashboard
  if (ds === todayStr && window._renderDashboard) window._renderDashboard();
};

window.calendarPrev = calendarPrev;
window.calendarNext = calendarNext;
