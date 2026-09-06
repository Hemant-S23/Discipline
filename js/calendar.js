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
    const ds = dateStr(d);
    return {
      day: i + 1,
      dateStr: ds,
      isToday: ds === todayStr,
      isFuture: ds > todayStr,
      isPast: ds < todayStr
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
    const createdDate = h.createdAt ? h.createdAt.slice(0, 10) : todayStr;

    html += `<tr><td><div class="matrix-habit-name">${h.icon} ${h.name}</div></td>`;
    days.forEach(d => {
      const isBeforeCreated = d.dateStr < createdDate;
      const scheduled = isHabitScheduledForDate(h, d.dateStr);
      const done      = isCompleted(h.id, d.dateStr);

      let cls = 'matrix-cell';
      if (done) cls += ' done';
      else if (isBeforeCreated) cls += ' before-created not-scheduled';
      else if (!scheduled) cls += ' not-scheduled';

      if (d.isToday) cls += ' today';
      else if (d.isFuture) cls += ' future';
      else if (!isBeforeCreated && scheduled && !done) cls += ' past-missed';
      else cls += ' past-locked';

      // TODAY is ALWAYS clickable so user can check off their habit!
      if (d.isToday) {
        html += `<td class="${cls}" onclick="calendarToggle('${h.id}','${d.dateStr}')" title="${done ? 'Completed! Tap to undo' : 'Tap to mark completed for today'}">
          <div class="matrix-dot">${done ? '✓' : ''}</div>
        </td>`;
      } else if (d.isFuture) {
        html += `<td class="${cls}" onclick="calendarNotice('future')" title="Future date">
          <div class="matrix-dot"></div>
        </td>`;
      } else if (isBeforeCreated) {
        html += `<td class="${cls}" onclick="calendarNotice('before','${h.name.replace(/'/g, "\\'")}')" title="Before habit was created">
          <div class="matrix-dot"></div>
        </td>`;
      } else if (!scheduled) {
        html += `<td class="${cls}" onclick="calendarNotice('off_schedule','${h.name.replace(/'/g, "\\'")}')" title="Not scheduled on this day">
          <div class="matrix-dot"></div>
        </td>`;
      } else {
        html += `<td class="${cls}" onclick="calendarNotice('past')" title="${done ? 'Completed' : 'Missed'}">
          <div class="matrix-dot">${done ? '✓' : ''}</div>
        </td>`;
      }
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

  const todayStr = today();
  let totalScheduled = 0, totalCompleted = 0, totalMissed = 0;

  days.forEach(d => {
    // Only evaluate dates up to today
    if (d.dateStr <= todayStr) {
      habits.forEach(h => {
        const createdDate = h.createdAt ? h.createdAt.slice(0, 10) : todayStr;
        // Only count days on or after the habit was created
        if (d.dateStr >= createdDate && isHabitScheduledForDate(h, d.dateStr)) {
          totalScheduled++;
          if (isCompleted(h.id, d.dateStr)) {
            totalCompleted++;
          } else if (d.dateStr < todayStr) {
            // Strictly past days that were scheduled and missed
            totalMissed++;
          }
        }
      });
    }
  });

  const pct = totalScheduled ? Math.round((totalCompleted / totalScheduled) * 100) : 0;

  container.innerHTML = `
    <div class="stats-row" style="grid-template-columns:repeat(3,1fr);margin-top:20px">
      <div class="card card-sm text-center">
        <div class="stat-overview-value" style="color:var(--success)">${totalCompleted}</div>
        <div class="stat-overview-label">Completed</div>
      </div>
      <div class="card card-sm text-center">
        <div class="stat-overview-value" style="color:var(--danger)">${totalMissed}</div>
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
  if (ds !== todayStr) {
    showToast('🔒 Past entries are locked. Complete habits on today!', 'warning');
    return;
  }

  toggleCompletion(habitId, ds);
  renderMatrix();

  if (window._renderDashboard) window._renderDashboard();
};

window.calendarNotice = function(type, habitName) {
  if (type === 'future') {
    showToast('⏳ Future dates cannot be completed in advance.', 'info', 2500);
  } else if (type === 'before') {
    showToast(`ℹ️ "${habitName || 'Habit'}" was started after this date.`, 'info', 2500);
  } else if (type === 'off_schedule') {
    showToast(`ℹ️ "${habitName || 'Habit'}" is not scheduled for this day.`, 'info', 2500);
  } else {
    showToast('🔒 Past entries are locked. Complete habits each day to build discipline!', 'warning', 2500);
  }
};

window.calendarLockedNotice = function() {
  showToast('🔒 Past entries are locked. Discipline is built day by day!', 'warning', 2500);
};

window.calendarPrev = calendarPrev;
window.calendarNext = calendarNext;
