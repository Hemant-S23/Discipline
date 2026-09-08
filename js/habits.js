// ============================================================
// habits.js — Habit CRUD UI + one-tap completion
// ============================================================

import {
  getActiveHabits, getArchivedHabits, addHabit, updateHabit, archiveHabit, restoreHabit,
  getCompletions, isCompleted, markComplete, hasAwardedXpToday, today, isHabitScheduledForDate,
  getHabitConsistency, getHabitById
} from './data.js?v=5.0';
import { awardXP, getXPForDifficulty, XP_BONUSES } from './xp.js?v=5.0';
import { calculateHabitStreak, checkMilestone } from './streaks.js?v=5.0';
import { checkAndUnlockAchievements } from './achievements.js?v=5.0';
import { showToast, showXPFloat, openModal, closeModal, animateHabitComplete, CATEGORY_ICONS, CATEGORY_LABELS } from './ui.js?v=5.0';
import { getHabitSvg, getCategorySvg, getAchievementSvg, ICONS_SVG, HABIT_GLYPH_KEYS } from './icons.js?v=5.0';

// ── Habit Completion ──────────────────────────────────────────
export function handleHabitToggle(habitId, checkBtnEl) {
  const todayStr = today();
  const habit = getHabitById(habitId);
  if (!habit) return;

  const alreadyDone = isCompleted(habitId, todayStr);

  if (alreadyDone) {
    showToast(`✓ ${habit.name} is already completed for today!`, 'info', 2500);
    return;
  }

  // Mark as complete for today
  markComplete(habitId, todayStr);

  // Award XP (ONLY if not awarded today for this habit)
  const xpSource = `habit_${habitId}`;
  let xpAwarded = 0;
  let result = null;

  if (!hasAwardedXpToday(xpSource)) {
    const xp = habit.xpReward || getXPForDifficulty(habit.difficulty);
    xpAwarded = xp;
    result = awardXP(xp, xpSource);
    showXPFloat(xp, checkBtnEl);
  }

  // Animate check
  if (checkBtnEl) animateHabitComplete(checkBtnEl);

  // Streak check
  const streak = calculateHabitStreak(habitId);
  const milestone = checkMilestone(streak.current);
  if (milestone) {
    setTimeout(() => showMilestoneModal(milestone, streak.current), 600);
  }

  // Perfect day check (award Perfect Day bonus ONLY ONCE per day!)
  if (!hasAwardedXpToday('perfect_day') && checkPerfectDay()) {
    setTimeout(() => {
      const { showConfetti } = window._ui || {};
      if (showConfetti) showConfetti();
      showToast('Perfect Day! +50 Bonus XP', 'achievement', 4000);
      awardXP(XP_BONUSES.PERFECT_DAY, 'perfect_day');
      if (window._renderDashboard) window._renderDashboard();
    }, 800);
  }

  // Check achievements
  const newAch = checkAndUnlockAchievements();
  newAch.forEach((a, i) => {
    setTimeout(() => showAchievementModal(a), 1200 + i * 500);
  });

  // Level up?
  if (result && result.leveledUp) {
    setTimeout(() => showLevelUpModal(result.levelInfo), 1800);
  }

  showToast(`✓ ${habit.name} completed!${xpAwarded ? ` +${xpAwarded} XP` : ''}`, 'success');

  // Re-render views
  if (window._renderDashboard) window._renderDashboard();
  renderHabitsPage(window._currentHabitFilter || 'all');
}

function checkPerfectDay() {
  const habits = getActiveHabits();
  const todayStr = today();
  const scheduled = habits.filter(h => isHabitScheduledForDate(h, todayStr));
  if (!scheduled.length) return false;
  return scheduled.every(h => isCompleted(h.id, todayStr));
}

// ── Today's Habits List (Dashboard) ──────────────────────────
export function renderTodayHabits(containerId = 'today-habits-list') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const habits   = getActiveHabits();
  const todayStr = today();
  const todayHabits = habits.filter(h => isHabitScheduledForDate(h, todayStr));

  const emptyEl = document.getElementById('habits-empty');

  if (!habits.length) {
    container.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
    return;
  }

  if (!todayHabits.length) {
    if (emptyEl) emptyEl.classList.add('hidden');
    container.innerHTML = `
      <div class="empty-state" style="padding:28px 16px">
        <div class="empty-icon" style="margin-bottom:8px">${ICONS_SVG['clock']}</div>
        <p style="font-weight:700;font-size:15px;color:var(--text);margin-bottom:4px">No habits scheduled for today</p>
        <p style="font-size:13px;color:var(--text-3);margin-bottom:16px">You have ${habits.length} active habit${habits.length > 1 ? 's' : ''} scheduled for other days.</p>
        <div style="display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
          <a href="#habits" class="btn-secondary" style="font-size:12.5px;padding:8px 16px">Manage Habits</a>
        </div>
      </div>
    `;
    return;
  }
  if (emptyEl) emptyEl.classList.add('hidden');

  // Sort: incomplete first
  const sorted = [...todayHabits].sort((a, b) => {
    const ac = isCompleted(a.id, todayStr) ? 1 : 0;
    const bc = isCompleted(b.id, todayStr) ? 1 : 0;
    return ac - bc;
  });

  container.innerHTML = sorted.map(h => {
    const done    = isCompleted(h.id, todayStr);
    const streak  = calculateHabitStreak(h.id);
    return `
      <div class="habit-item ${done ? 'completed' : ''} slide-in-up" data-habit-id="${h.id}">
        <button class="habit-check-btn" onclick="handleHabitToggleGlobal('${h.id}', this)" title="${done ? 'Completed' : 'Mark Complete'}">
          ${done ? '✓' : ''}
        </button>
        <span class="habit-item-icon">${getHabitSvg(h.icon, 18)}</span>
        <div class="habit-item-info">
          <div class="habit-item-name">${h.name}</div>
          <div class="habit-item-meta">
            ${streak.current > 0 ? `<span class="habit-meta-streak">${streak.current}d streak</span>` : ''}
            <span class="habit-meta-xp">+${h.xpReward || 20} XP</span>
            <span style="display:inline-flex;align-items:center;gap:4px">${CATEGORY_ICONS[h.category] || ''} ${CATEGORY_LABELS[h.category] || h.category}</span>
          </div>
        </div>
        <span class="habit-item-difficulty diff-${h.difficulty}">${diffLabel(h.difficulty)}</span>
      </div>
    `;
  }).join('');
}

function diffLabel(d) { return { easy: 'Easy', medium: 'Med', hard: 'Hard' }[d] || 'Med'; }

// ── Habits Page ───────────────────────────────────────────────
export function renderHabitsPage(filter = 'all') {
  const container = document.getElementById('habits-page-list');
  if (!container) return;

  let habits = getActiveHabits();
  if (filter !== 'all') habits = habits.filter(h => h.category === filter);

  if (!habits.length) {
    container.innerHTML = `
      <div class="empty-state" style="grid-column:1/-1">
        <div class="empty-icon">${ICONS_SVG['target']}</div>
        <p>${filter === 'all' ? 'No habits yet. Create your first one!' : 'No habits in this category.'}</p>
        <button class="btn-primary" onclick="openAddHabitModal()">+ Add Habit</button>
      </div>`;
    return;
  }

  const todayStr = today();
  container.innerHTML = habits.map((h, i) => {
    const done         = isCompleted(h.id, todayStr);
    const streak       = calculateHabitStreak(h.id);
    const consistency  = getHabitConsistency(h.id, 30);
    const totalDone    = getCompletions().filter(c => c.habitId === h.id).length;
    return `
      <div class="habit-card" style="animation-delay:${i * 0.05}s">
        <div class="habit-card-accent"></div>
        <div class="habit-card-top">
          <div class="habit-card-icon-wrap">
            <div class="habit-card-icon" style="background:${h.color ? h.color + '18' : 'var(--surface-2)'};color:var(--text)">${getHabitSvg(h.icon, 20)}</div>
            <div>
              <div class="habit-card-name">${h.name}</div>
              <div class="habit-card-category" style="display:inline-flex;align-items:center;gap:4px">${CATEGORY_ICONS[h.category] || ''} ${CATEGORY_LABELS[h.category] || h.category} · ${h.frequency}</div>
            </div>
          </div>
          <div class="habit-card-menu">
            <button onclick="openEditHabitModal('${h.id}')" title="Edit" class="icon-action-btn">${ICONS_SVG['edit']}</button>
            <button onclick="confirmArchive('${h.id}')" title="Archive" class="icon-action-btn">${ICONS_SVG['archive']}</button>
          </div>
        </div>
        <div class="habit-card-stats">
          <div class="habit-stat">
            <div class="habit-stat-value" style="color:var(--text)">${streak.current}</div>
            <div class="habit-stat-label">Streak</div>
          </div>
          <div class="habit-stat">
            <div class="habit-stat-value" style="color:var(--text-2)">${streak.best}</div>
            <div class="habit-stat-label">Best</div>
          </div>
          <div class="habit-stat">
            <div class="habit-stat-value" style="color:var(--text-2)">${totalDone}</div>
            <div class="habit-stat-label">Total</div>
          </div>
        </div>
        <div class="habit-card-footer">
          <div class="consistency-wrap" style="flex:1">
            <div class="consistency-bar-wrap"><div class="consistency-bar" style="width:${consistency}%"></div></div>
            <span class="consistency-pct">${consistency}%</span>
          </div>
          <button class="btn-primary ${done ? 'btn-completed' : ''}" style="padding:8px 14px;font-size:13px" onclick="handleHabitToggleGlobal('${h.id}', this)">
            ${done ? '✓ Done' : '○ Mark'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ── Add / Edit Habit Modal ─────────────────────────────────────
const COLORS = ['#7C6FF7', '#22C55E', '#F97316', '#F59E0B', '#EF4444', '#06B6D4', '#EC4899', '#8B5CF6'];

let editingHabitId = null;
let selectedIcon   = 'book';
let selectedColor  = '#7C6FF7';

export function openAddHabitModal() {
  editingHabitId = null;
  selectedIcon   = 'book';
  selectedColor  = '#7C6FF7';
  document.getElementById('habit-modal-title').textContent  = 'Create New Habit';
  document.getElementById('habit-modal-submit').textContent = 'Create Habit';
  document.getElementById('habit-form').reset();

  // Reset frequency selection to 'daily'
  document.querySelectorAll('.freq-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === 'daily');
  });
  // Reset difficulty selection to 'medium'
  document.querySelectorAll('.diff-option-btn').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === 'medium');
  });

  renderIconPicker('modal-icon-picker');
  openModal('modal-habit');
}

export function openEditHabitModal(id) {
  const h = getHabitById(id);
  if (!h) return;
  editingHabitId = id;
  selectedIcon   = h.icon;
  selectedColor  = h.color || '#7C6FF7';

  document.getElementById('habit-modal-title').textContent  = 'Edit Habit';
  document.getElementById('habit-modal-submit').textContent = 'Save Changes';
  document.getElementById('habit-name-input').value         = h.name;
  document.getElementById('habit-category-select').value    = h.category;
  document.getElementById('habit-reminder-input').value     = h.reminderTime || '';

  // Set frequency
  document.querySelectorAll('.freq-option').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === h.frequency);
  });
  // Set difficulty
  document.querySelectorAll('.diff-option-btn').forEach(el => {
    el.classList.toggle('selected', el.dataset.value === h.difficulty);
  });

  renderIconPicker('modal-icon-picker');
  openModal('modal-habit');
}

function renderIconPicker(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  container.innerHTML = HABIT_GLYPH_KEYS.map(key => `
    <button type="button" class="icon-option ${key === selectedIcon ? 'selected' : ''}"
            onclick="selectHabitIcon('${key}')" title="${key}">${getHabitSvg(key, 18)}</button>
  `).join('');
}

window.selectHabitIcon = function(ico) {
  selectedIcon = ico;
  renderIconPicker('modal-icon-picker');
};

export function submitHabitForm() {
  const name       = (document.getElementById('habit-name-input')?.value || '').trim();
  const category   = document.getElementById('habit-category-select')?.value || 'personal';
  const reminder   = document.getElementById('habit-reminder-input')?.value || '';
  const frequency  = document.querySelector('.freq-option.selected')?.dataset.value || 'daily';
  const difficulty = document.querySelector('.diff-option-btn.selected')?.dataset.value || 'medium';
  const xpReward   = getXPForDifficulty(difficulty);

  if (!name) { showToast('Please enter a habit name', 'error'); return; }

  const data = { name, icon: selectedIcon, category, frequency, difficulty, xpReward, reminderTime: reminder, color: selectedColor };

  if (editingHabitId) {
    updateHabit(editingHabitId, data);
    showToast('✓ Habit updated!', 'success');
  } else {
    addHabit(data);
    showToast('✓ Habit created!', 'success');
  }

  closeModal('modal-habit');
  if (window._renderDashboard) window._renderDashboard();
  renderHabitsPage(window._currentHabitFilter || 'all');
}

window.openAddHabitModal   = openAddHabitModal;
window.openEditHabitModal  = openEditHabitModal;
window.handleHabitToggleGlobal = (id, el) => handleHabitToggle(id, el);

window.confirmArchive = function(id) {
  const h = getHabitById(id);
  if (!h) return;

  const streak = calculateHabitStreak(id);

  const nameEl   = document.getElementById('archive-modal-habit-name');
  const iconEl   = document.getElementById('archive-modal-habit-icon');
  const metaEl   = document.getElementById('archive-modal-habit-meta');
  const streakEl = document.getElementById('archive-modal-habit-streak');
  const confirmBtn = document.getElementById('archive-confirm-action-btn');

  if (nameEl)   nameEl.textContent = h.name;
  if (iconEl) {
    iconEl.innerHTML = getHabitSvg(h.icon, 24);
    iconEl.style.background = h.color ? h.color + '18' : 'var(--surface-2)';
  }
  if (metaEl)   metaEl.innerHTML = `<span style="display:inline-flex;align-items:center;gap:4px">${CATEGORY_ICONS[h.category] || ''} ${CATEGORY_LABELS[h.category] || h.category} · ${h.frequency}</span>`;
  if (streakEl) streakEl.textContent = `${streak.current} ${streak.current === 1 ? 'day' : 'days'} streak`;

  if (confirmBtn) {
    confirmBtn.onclick = () => {
      archiveHabit(id);
      closeModal('modal-archive');
      showToast('Habit archived', 'info');
      renderHabitsPage(window._currentHabitFilter || 'all');
      if (window._renderDashboard) window._renderDashboard();
    };
  }

  openModal('modal-archive');
};


// ── Milestones + Achievement Modals ───────────────────────────
function showMilestoneModal(milestone, streak) {
  document.getElementById('milestone-emoji').innerHTML   = getHabitSvg('flame', 36);
  document.getElementById('milestone-title').textContent  = milestone.title;
  document.getElementById('milestone-msg').textContent    = milestone.msg;
  document.getElementById('milestone-fires').innerHTML    = `<span style="font-size:13px;font-weight:700;color:var(--text)">${streak} DAY STREAK COMPLETED</span>`;
  openModal('modal-milestone');
}

function showAchievementModal(a) {
  if (!a) return;
  document.getElementById('ach-icon').innerHTML     = getAchievementSvg(a.id, 40);
  document.getElementById('ach-name').textContent   = a.name;
  document.getElementById('ach-desc').textContent   = a.desc;
  document.getElementById('ach-rarity').className   = `rarity-badge rarity-${a.rarity}`;
  document.getElementById('ach-rarity').textContent = a.rarity;
  openModal('modal-achievement');
}

function showLevelUpModal(levelInfo) {
  document.getElementById('levelup-num').textContent  = levelInfo.level;
  document.getElementById('levelup-name').textContent = levelInfo.name;
  openModal('modal-levelup');
}

// ── Archived Habits Section (in Settings) ────────────────────
export function renderArchivedHabits() {
  const container = document.getElementById('archived-habits-list');
  if (!container) return;
  const archived = getArchivedHabits();
  if (!archived.length) {
    container.innerHTML = '<p style="color:var(--text-3);font-size:14px">No archived habits.</p>';
    return;
  }
  container.innerHTML = archived.map(h => `
    <div class="settings-row">
      <div>
        <div class="settings-row-label" style="display:flex;align-items:center;gap:8px">${getHabitSvg(h.icon, 16)} ${h.name}</div>
        <div class="settings-row-desc">Archived ${new Date(h.archivedAt).toLocaleDateString()}</div>
      </div>
      <button class="btn-secondary" style="font-size:12px;padding:6px 12px" onclick="restoreHabitUI('${h.id}')">Restore</button>
    </div>
  `).join('');
}

window.restoreHabitUI = function(id) {
  restoreHabit(id);
  showToast('Habit restored!', 'success');
  renderArchivedHabits();
  if (window._renderDashboard) window._renderDashboard();
};
