// ============================================================
// calendar.js — Habit matrix calendar
// ============================================================

import {
  getActiveHabits, getCompletions, isCompleted, toggleCompletion,
  today, dateStr, isHabitScheduledForDate, getTasksForDate, addTask, toggleTask, deleteTask,
  getTaskById, getTasks, saveTasks, hasAwardedXpToday
} from './data.js';
import { awardXP } from './xp.js';
import { showToast, openModal, closeModal, showXPFloat } from './ui.js';

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
    const dayTasks = getTasksForDate(d.dateStr);
    const hasTasks = dayTasks.length > 0;
    html += `<th class="matrix-day-th ${d.isToday ? 'text-accent today-th' : ''}" onclick="openDayDetailModal('${d.dateStr}')" title="Click to view & plan tasks for ${d.dateStr}">
      <span class="matrix-day-num">${d.day}</span>
      ${hasTasks ? `<span class="day-task-indicator" title="${dayTasks.length} task(s)"></span>` : ''}
      <br><span style="font-size:9px;opacity:0.6">${dow}</span>
    </th>`;
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

// ── Day Detail Modal (Calendar Date Interaction) ──────────────
let activeModalDate = today();

function escapeHtml(str) {
  return String(str || '').replace(/[&<>'"]/g, tag => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[tag] || tag));
}

export function openDayDetailModal(dateStr) {
  activeModalDate = dateStr;
  const todayStr = today();
  const isToday = dateStr === todayStr;
  const isFuture = dateStr > todayStr;

  const d = new Date(dateStr + 'T00:00:00');
  const titleEl = document.getElementById('day-detail-date-title');
  const subtitleEl = document.getElementById('day-detail-date-subtitle');

  if (titleEl) {
    const formatted = d.toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    titleEl.textContent = formatted;
  }
  if (subtitleEl) {
    let tag = '';
    if (isToday) tag = '<span class="day-status-pill today">Today</span>';
    else if (isFuture) tag = '<span class="day-status-pill future">Upcoming</span>';
    else tag = '<span class="day-status-pill past">Past Date</span>';
    subtitleEl.innerHTML = `${tag} Review habits &amp; manage day tasks`;
  }

  // Render Habits for this date
  renderDayModalHabits(dateStr);

  // Render Tasks for this date
  renderDayModalTasks(dateStr);

  openModal('modal-day-detail');
}

function renderDayModalHabits(dateStr) {
  const container = document.getElementById('day-detail-habits-list');
  const badge = document.getElementById('day-detail-habits-badge');
  if (!container) return;

  const habits = getActiveHabits();
  const todayStr = today();
  const isToday = dateStr === todayStr;

  const scheduled = habits.filter(h => isHabitScheduledForDate(h, dateStr));
  const doneCount = scheduled.filter(h => isCompleted(h.id, dateStr)).length;

  if (badge) {
    badge.textContent = `${doneCount}/${scheduled.length} completed`;
  }

  if (!scheduled.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:8px 0;">No habits scheduled for this day.</div>';
    return;
  }

  container.innerHTML = scheduled.map(h => {
    const done = isCompleted(h.id, dateStr);
    let statusHtml = '';
    if (done) {
      statusHtml = '<span class="day-habit-badge done">✓ Done</span>';
    } else if (dateStr < todayStr) {
      statusHtml = '<span class="day-habit-badge missed">Missed</span>';
    } else if (isToday) {
      statusHtml = '<span class="day-habit-badge pending">Pending</span>';
    } else {
      statusHtml = '<span class="day-habit-badge future">Scheduled</span>';
    }

    return `
      <div class="day-modal-habit-row ${done ? 'done' : ''}">
        <div class="day-modal-habit-info">
          <span class="day-modal-habit-icon">${h.icon}</span>
          <span class="day-modal-habit-name">${escapeHtml(h.name)}</span>
        </div>
        ${statusHtml}
      </div>
    `;
  }).join('');
}

function renderDayModalTasks(dateStr) {
  const container = document.getElementById('day-detail-tasks-list');
  const badge = document.getElementById('day-detail-tasks-badge');
  if (!container) return;

  const tasks = getTasksForDate(dateStr);
  const doneCount = tasks.filter(t => t.completed).length;

  if (badge) {
    badge.textContent = `${doneCount}/${tasks.length}`;
  }

  if (!tasks.length) {
    container.innerHTML = '<div style="font-size:13px;color:var(--text-3);padding:14px 0;text-align:center;">No tasks planned for this day yet. Add one above!</div>';
    return;
  }

  container.innerHTML = tasks.map(task => {
    return `
      <div class="task-item ${task.completed ? 'completed' : ''}" id="modal-task-${task.id}">
        <button class="task-check-btn ${task.completed ? 'checked' : ''}" onclick="handleDayTaskToggle('${task.id}', this)" title="${task.completed ? '✓ Already completed! (Locked)' : 'Mark completed'}" type="button">
          ${task.completed ? '✓' : ''}
        </button>
        <div class="task-content">
          <span class="task-text">${escapeHtml(task.text)}</span>
          <span class="task-reward-chip">+${task.xpReward || 10} XP</span>
        </div>
        <button class="task-delete-btn" onclick="handleDayTaskDelete('${task.id}')" title="Delete task" type="button">✕</button>
      </div>
    `;
  }).join('');
}

window.handleDayTaskSubmit = function(e) {
  if (e) e.preventDefault();
  const input = document.getElementById('day-detail-task-input');
  if (!input) return;
  const text = input.value.trim();
  if (!text) {
    showToast('Please enter a task description', 'warning', 2000);
    return;
  }

  addTask({ text, date: activeModalDate, xpReward: 10 });
  input.value = '';
  renderDayModalTasks(activeModalDate);
  renderMatrix();

  if (activeModalDate === today() && window._renderDashboard) {
    window._renderDashboard();
  }
  showToast('✓ Task added for this date! 📌', 'success', 2000);
};

window.handleDayTaskToggle = function(taskId, btnEl) {
  const existing = getTaskById(taskId);
  if (existing && existing.completed) {
    showToast(`✓ "${existing.text}" is already completed! 🎉`, 'info', 2500);
    return;
  }

  const res = toggleTask(taskId);
  if (!res || res.alreadyCompleted) {
    showToast('✓ Task is already completed! 🎉', 'info', 2500);
    return;
  }

  const task = res.task;
  const xpSource = `task_${task.id}`;
  if (task.date === today() && !task.xpAwarded && !hasAwardedXpToday(xpSource)) {
    const xp = task.xpReward || 10;
    task.xpAwarded = true;
    const allTasks = getTasks();
    const t = allTasks.find(x => x.id === task.id);
    if (t) { t.xpAwarded = true; saveTasks(allTasks); }

    awardXP(xp, xpSource);
    if (btnEl) showXPFloat(xp, btnEl);
    showToast(`✓ Task completed! +${xp} XP ⭐`, 'success', 2500);
  } else {
    showToast('✓ Task completed!', 'success', 2000);
  }

  renderDayModalTasks(activeModalDate);
  renderMatrix();

  if (window._renderDashboard) window._renderDashboard();
};

window.handleDayTaskDelete = function(taskId) {
  deleteTask(taskId);
  renderDayModalTasks(activeModalDate);
  renderMatrix();

  if (window._renderDashboard) window._renderDashboard();
  showToast('Task removed', 'info', 1500);
};

window.openDayDetailModal = openDayDetailModal;
window._renderCalendar = renderCalendarPage;

