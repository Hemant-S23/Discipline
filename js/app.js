// ============================================================
// app.js — Bootstrap, router, global events
// ============================================================

import { initOnboarding } from './onboarding.js';
import { renderDashboard } from './dashboard.js';
import { renderHabitsPage, openAddHabitModal, submitHabitForm, renderArchivedHabits } from './habits.js';
import { renderAnalyticsPage } from './analytics.js';
import { renderCalendarPage, calendarPrev, calendarNext } from './calendar.js';
import { renderAchievementsPage } from './achievements.js';
import { renderRewardsPage, restoreActiveReward, applyReward } from './rewards.js';
import { calculateHabitStreak, calculateGlobalStreak, getHabitsByStreak, buildChain } from './streaks.js';
import {
  getActiveHabits, getUser, updateUser, saveCheckin, getCheckinForDate, hasAwardedXpToday, today, resetAllData, exportData
} from './data.js';
import { awardXP, XP_BONUSES } from './xp.js';
import {
  showToast, showXPFloat, openModal, closeModal, closeAllModals, showConfirmModal, showConfetti, getDailyQuote, CATEGORY_ICONS
} from './ui.js';

// ── Pages ─────────────────────────────────────────────────────
const PAGES = ['dashboard', 'habits', 'streaks', 'analytics', 'achievements', 'rewards', 'calendar', 'settings'];

let currentPage = 'dashboard';

function navigateTo(page) {
  if (!PAGES.includes(page)) page = 'dashboard';
  currentPage = page;

  // Hide all pages
  PAGES.forEach(p => {
    const el = document.getElementById(`page-${p}`);
    if (el) el.classList.remove('active');
  });

  // Show current page
  const current = document.getElementById(`page-${page}`);
  if (current) current.classList.add('active');

  // Update nav
  document.querySelectorAll('.nav-item, .mobile-nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Render page content
  switch (page) {
    case 'dashboard':    renderDashboard();          break;
    case 'habits':       renderHabitsPage();         break;
    case 'streaks':      renderStreaksPage();         break;
    case 'analytics':    renderAnalyticsPage();      break;
    case 'achievements': renderAchievementsPage();   break;
    case 'rewards':      renderRewardsPage();        break;
    case 'calendar':     renderCalendarPage();       break;
    case 'settings':     renderSettingsPage();       break;
  }

  // Scroll to top
  const main = document.querySelector('.main-content');
  if (main) main.scrollTop = 0;
}

// ── Router ────────────────────────────────────────────────────
function initRouter() {
  window.addEventListener('hashchange', () => {
    const page = (location.hash || '#dashboard').slice(1);
    navigateTo(page);
  });
}

// ── Theme ─────────────────────────────────────────────────────
function initTheme() {
  const user = getUser();
  const theme = user.theme || 'light';
  document.documentElement.setAttribute('data-theme', theme);
  updateThemeToggle(theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme');
  const next    = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  updateUser({ theme: next });
  updateThemeToggle(next);

  // Re-render charts if on those pages
  if (currentPage === 'dashboard')  renderDashboard();
  if (currentPage === 'analytics')  renderAnalyticsPage();
}

function updateThemeToggle(theme) {
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

// ── Nav Events ────────────────────────────────────────────────
function initNav() {
  document.querySelectorAll('[data-page]').forEach(el => {
    el.addEventListener('click', e => {
      e.preventDefault();
      const page = el.dataset.page;
      history.pushState(null, '', `#${page}`);
      navigateTo(page);
    });
  });
}

// ── Habit Form ────────────────────────────────────────────────
function initHabitForm() {
  // Frequency options
  document.querySelectorAll('.freq-option').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.freq-option').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
    });
  });

  // Difficulty options
  document.querySelectorAll('.diff-option-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.diff-option-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      // Update XP display
      const xpMap = { easy: 10, medium: 20, hard: 30 };
      const xpEl = document.getElementById('habit-xp-display');
      if (xpEl) xpEl.textContent = `+${xpMap[btn.dataset.value]} XP`;
    });
  });

  // Form submit
  const form = document.getElementById('habit-form');
  if (form) form.addEventListener('submit', e => { e.preventDefault(); submitHabitForm(); });

  // Habits filter tabs
  document.querySelectorAll('.habits-filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.habits-filter-tab').forEach(t => t.classList.remove('active'));
      tab.classList.add('active');
      window._currentHabitFilter = tab.dataset.filter;
      renderHabitsPage(tab.dataset.filter);
    });
  });
}

// ── Check-in Modal ────────────────────────────────────────────
function initCheckin() {
  let selectedMood = null;

  const checkinBtn = document.getElementById('dash-checkin-btn');
  if (checkinBtn) {
    checkinBtn.addEventListener('click', () => {
      const todayStr = today();
      const existing = getCheckinForDate(todayStr);
      const noteInput = document.getElementById('checkin-note');
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));

      if (existing) {
        selectedMood = existing.mood;
        const moodBtn = document.querySelector(`.mood-btn[data-mood="${existing.mood}"]`);
        if (moodBtn) moodBtn.classList.add('selected');
        if (noteInput) noteInput.value = existing.note || '';
      } else {
        selectedMood = null;
        if (noteInput) noteInput.value = '';
      }
    });
  }

  document.querySelectorAll('.mood-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
      btn.classList.add('selected');
      selectedMood = btn.dataset.mood;
    });
  });

  const saveBtn = document.getElementById('save-checkin-btn');
  if (saveBtn) saveBtn.addEventListener('click', () => {
    const note = document.getElementById('checkin-note')?.value || '';
    const todayStr = today();
    saveCheckin({ date: todayStr, mood: selectedMood || 'good', note, completionPct: 0 });

    const xpKey = `daily_checkin_${todayStr}`;
    let xpAwarded = 0;
    let result = null;

    if (!hasAwardedXpToday(xpKey)) {
      const xp = XP_BONUSES.DAILY_CHECKIN || 15;
      xpAwarded = xp;
      result = awardXP(xp, xpKey);
      if (checkinBtn) showXPFloat(xp, checkinBtn);
    }

    showToast(`✓ Check-in saved!${xpAwarded ? ` +${xpAwarded} XP ⭐` : ''}`, 'success');
    closeModal('modal-checkin');
    selectedMood = null;
    document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
    if (document.getElementById('checkin-note')) document.getElementById('checkin-note').value = '';

    if (result && result.leveledUp) {
      setTimeout(() => {
        document.getElementById('levelup-num').textContent  = result.levelInfo.level;
        document.getElementById('levelup-name').textContent = result.levelInfo.name;
        openModal('modal-levelup');
      }, 800);
    }

    renderDashboard();
  });
}

// ── Modal Close Buttons ───────────────────────────────────────
function initModalClose() {
  document.querySelectorAll('[data-close-modal]').forEach(btn => {
    btn.addEventListener('click', () => closeModal(btn.dataset.closeModal));
  });
}

// ── Streaks Page ──────────────────────────────────────────────
function renderStreaksPage() {
  const habits  = getActiveHabits();
  const global  = calculateGlobalStreak(habits);
  const withStr = getHabitsByStreak(habits);

  // Chain view
  const chainEl = document.getElementById('streak-chain-fires');
  const chainNumEl = document.getElementById('streak-chain-days');
  if (chainEl)    chainEl.textContent    = buildChain(global.current, 28);
  if (chainNumEl) chainNumEl.textContent = `${global.current} DAYS`;

  // Grid
  const gridEl = document.getElementById('streaks-habits-grid');
  if (!gridEl) return;

  if (!withStr.length) {
    gridEl.innerHTML = '<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">🔥</div><p>Add habits to start your streak!</p></div>';
    return;
  }

  gridEl.innerHTML = withStr.map((h, i) => `
    <div class="streak-item-card" style="animation-delay:${i * 0.05}s">
      <div class="streak-item-icon">${h.icon}</div>
      <div class="streak-item-info">
        <div class="streak-item-name">${h.name}</div>
        <div class="streak-item-category">${CATEGORY_ICONS[h.category] || ''} ${h.category}</div>
        <div class="streak-item-nums">
          <div class="streak-num-block">
            <div class="streak-num-value">🔥 ${h.streak.current}</div>
            <div class="streak-num-label">Current</div>
          </div>
          <div class="streak-num-block">
            <div class="streak-num-value best">🏆 ${h.streak.best}</div>
            <div class="streak-num-label">Best</div>
          </div>
          <div class="streak-num-block">
            <div class="streak-num-value" style="color:var(--text-2)">${h.streak.total}</div>
            <div class="streak-num-label">Total</div>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

// ── Settings Page ─────────────────────────────────────────────
function renderSettingsPage() {
  const user = getUser();
  const nameInput = document.getElementById('settings-name-input');
  if (nameInput) nameInput.value = user.name || '';
  renderArchivedHabits();
}

function initSettings() {
  const saveNameBtn = document.getElementById('settings-save-name');
  if (saveNameBtn) saveNameBtn.addEventListener('click', () => {
    const name = document.getElementById('settings-name-input')?.value?.trim();
    if (name) {
      updateUser({ name });
      showToast('✓ Profile updated!', 'success');
      renderDashboard();
    }
  });

  const exportBtn = document.getElementById('settings-export-btn');
  if (exportBtn) exportBtn.addEventListener('click', () => {
    const data = exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = `discipline-export-${today()}.json`;
    a.click(); URL.revokeObjectURL(url);
    showToast('✓ Data exported!', 'success');
  });

  const resetBtn = document.getElementById('settings-reset-btn');
  if (resetBtn) resetBtn.addEventListener('click', () => {
    showConfirmModal({
      title: 'Reset All Data?',
      message: '⚠️ This will permanently delete ALL your habits, completions, streaks, and progress. This action cannot be undone.',
      icon: '⚠️',
      confirmText: 'Reset Everything',
      cancelText: 'Cancel',
      confirmClass: 'btn-danger',
      onConfirm: () => {
        resetAllData();
        location.reload();
      }
    });
  });

  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const sidebarThemeBtn = document.getElementById('sidebar-theme-toggle');
  if (sidebarThemeBtn) sidebarThemeBtn.addEventListener('click', toggleTheme);
}

// ── Global add habit button ───────────────────────────────────
function initGlobalButtons() {
  document.querySelectorAll('[data-action="add-habit"]').forEach(btn => {
    btn.addEventListener('click', openAddHabitModal);
  });
}

// ── App init ──────────────────────────────────────────────────
function appInit() {
  initTheme();
  initRouter();
  initNav();
  initHabitForm();
  initCheckin();
  initModalClose();
  initSettings();
  initGlobalButtons();
  restoreActiveReward();

  // Expose global render function for cross-module use
  window._renderDashboard = renderDashboard;
  window._ui = { showConfetti };

  // Navigate to initial page
  const page = (location.hash || '#dashboard').slice(1);
  navigateTo(PAGES.includes(page) ? page : 'dashboard');
}

// ── Boot ──────────────────────────────────────────────────────
window._appInit = appInit;

// Init onboarding (or go straight to app)
const needsOnboarding = initOnboarding();
if (!needsOnboarding) appInit();

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const page = (location.hash || '#dashboard').slice(1);
  navigateTo(page);
});

// Make key functions global for inline onclick
window.openAddHabitModal = openAddHabitModal;
window.openModal  = openModal;
window.closeModal = closeModal;
window.applyReward = (id) => applyReward(id);
window.calendarPrev = calendarPrev;
window.calendarNext = calendarNext;
