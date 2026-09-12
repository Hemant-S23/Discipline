// ============================================================
// app.js — Bootstrap, router, global events
// ============================================================

import { initOnboarding } from './onboarding.js?v=6.0';
import { renderDashboard } from './dashboard.js?v=6.0';
import { renderHabitsPage, openAddHabitModal, submitHabitForm, renderArchivedHabits } from './habits.js?v=6.0';
import { renderAnalyticsPage } from './analytics.js?v=6.0';
import { renderCalendarPage, calendarPrev, calendarNext, openDayDetailModal } from './calendar.js?v=6.0';
import { renderAchievementsPage } from './achievements.js?v=6.0';
import { renderRewardsPage, restoreActiveReward, applyReward } from './rewards.js?v=6.0';
import {
  calculateHabitStreak, calculateGlobalStreak, getHabitsByStreak, buildChain,
  calculateAnnualActivity, getNextMilestone, MILESTONES, MILESTONE_DATA
} from './streaks.js?v=6.0';
import {
  getActiveHabits, getUser, updateUser, saveCheckin, getCheckinForDate, hasAwardedXpToday, today, resetAllData, exportData
} from './data.js?v=6.0';
import { awardXP, XP_BONUSES } from './xp.js?v=6.0';
import {
  initAuth, loginWithEmail, signUpWithEmail, loginWithGoogle, resetPassword, logoutUser, deleteAccountAndData, handleRedirectResult,
  checkEmailVerification, resendVerification, cancelEmailVerification, getAuthUser
} from './auth.js?v=6.0';
import {
  showToast, showXPFloat, openModal, closeModal, closeAllModals, showConfirmModal, showConfetti, getDailyQuote, CATEGORY_ICONS
} from './ui.js?v=6.0';
import { getHabitSvg, ICONS_SVG } from './icons.js?v=6.0';

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

  // Hide mobile drawer if open
  closeMobileDrawer();

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

// ── Mobile Drawer ─────────────────────────────────────────────
window.openMobileDrawer = function() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) drawer.classList.add('drawer-open');
};

window.closeMobileDrawer = function() {
  const drawer = document.getElementById('mobile-drawer');
  if (drawer) drawer.classList.remove('drawer-open');
};

export const openMobileDrawer = window.openMobileDrawer;
export const closeMobileDrawer = window.closeMobileDrawer;

function updateThemeToggle(theme) {
  const btn = document.getElementById('theme-toggle');
  const drawerBtn = document.getElementById('drawer-theme-toggle');
  const iconSvg = theme === 'dark' ? ICONS_SVG['sun'] : ICONS_SVG['moon'];
  if (btn) btn.innerHTML = iconSvg;
  if (drawerBtn) drawerBtn.innerHTML = iconSvg;
}

function initMobileDrawer() {
  const toggleBtn = document.getElementById('mobile-menu-toggle-btn');
  const moreBtn   = document.getElementById('mobile-nav-more-btn');
  const closeBtn  = document.getElementById('mobile-drawer-close-btn');
  const drawer    = document.getElementById('mobile-drawer');
  const drawerThemeBtn = document.getElementById('drawer-theme-toggle');

  if (toggleBtn) toggleBtn.addEventListener('click', openMobileDrawer);
  if (moreBtn)   moreBtn.addEventListener('click', openMobileDrawer);
  if (closeBtn)  closeBtn.addEventListener('click', closeMobileDrawer);

  if (drawer) {
    drawer.addEventListener('click', e => {
      if (e.target === drawer) closeMobileDrawer();
    });
  }

  if (drawerThemeBtn) drawerThemeBtn.addEventListener('click', toggleTheme);
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
function handleCheckinClick(e) {
  if (e && typeof e.preventDefault === 'function') e.preventDefault();
  const todayStr = today();
  const existing = getCheckinForDate(todayStr);
  if (existing) {
    showToast('You have already checked in for today.', 'info');
    return;
  }
  const noteInput = document.getElementById('checkin-note');
  document.querySelectorAll('.mood-btn').forEach(b => b.classList.remove('selected'));
  if (noteInput) noteInput.value = '';
  openModal('modal-checkin');
}
window.handleCheckinClick = handleCheckinClick;

function initCheckin() {
  let selectedMood = null;

  const checkinBtn = document.getElementById('dash-checkin-btn');
  if (checkinBtn) {
    checkinBtn.onclick = handleCheckinClick;
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
    const todayStr = today();
    const existing = getCheckinForDate(todayStr);
    if (existing) {
      showToast('You have already checked in for today.', 'info');
      closeModal('modal-checkin');
      return;
    }

    const note = document.getElementById('checkin-note')?.value || '';
    const saved = saveCheckin({ date: todayStr, mood: selectedMood || 'good', note, completionPct: 0 });
    if (!saved) {
      showToast('You have already checked in for today.', 'info');
      closeModal('modal-checkin');
      return;
    }

    const xpKey = `daily_checkin_${todayStr}`;
    let xpAwarded = 0;
    let result = null;

    if (!hasAwardedXpToday(xpKey)) {
      const xp = XP_BONUSES.DAILY_CHECKIN || 15;
      xpAwarded = xp;
      result = awardXP(xp, xpKey);
      if (checkinBtn) showXPFloat(xp, checkinBtn);
    }

    showToast(`✓ Check-in saved!${xpAwarded ? ` +${xpAwarded} XP` : ''}`, 'success');
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
  const annual  = calculateAnnualActivity(habits);

  // 1. Executive KPI Header
  const chainFiresEl = document.getElementById('streak-chain-fires');
  const chainDaysEl  = document.getElementById('streak-chain-days');
  const chainSubEl   = document.getElementById('streak-chain-sub');
  if (chainFiresEl) chainFiresEl.innerHTML = buildChain(global.current, 12);
  
  const chainDays = global.current;
  const chainUnit = chainDays === 1 ? 'DAY' : 'DAYS';
  if (chainDaysEl) chainDaysEl.textContent = `${chainDays}`;
  const chainUnitEl = document.querySelector('.streak-kpi-primary .streak-kpi-unit');
  if (chainUnitEl) chainUnitEl.textContent = chainUnit;

  if (chainSubEl) {
    chainSubEl.textContent = global.current > 0
      ? `${global.current} consecutive ${global.current === 1 ? 'day' : 'days'} without missing a scheduled habit`
      : 'Complete today\'s scheduled habits to start or extend your chain';
  }

  const bestEl = document.getElementById('streak-kpi-best');
  const bestSubEl = document.getElementById('streak-kpi-best-sub');
  const bestDays = global.best;
  const bestUnit = bestDays === 1 ? 'DAY' : 'DAYS';
  if (bestEl) bestEl.textContent = `${bestDays}`;
  const bestUnitEl = document.querySelectorAll('.streak-kpi-card')[1]?.querySelector('.streak-kpi-unit');
  if (bestUnitEl) bestUnitEl.textContent = bestUnit;

  if (bestSubEl) {
    bestSubEl.textContent = global.best > 0
      ? 'Personal record across all habits'
      : 'Complete habits consecutively to set records';
  }

  const consistencyEl = document.getElementById('streak-kpi-consistency');
  const consistencyBarEl = document.getElementById('streak-kpi-consistency-bar');
  const consistencySubEl = document.getElementById('streak-kpi-consistency-sub');
  if (consistencyEl) consistencyEl.textContent = `${global.consistency30d}%`;
  if (consistencyBarEl) consistencyBarEl.style.width = `${global.consistency30d}%`;
  if (consistencySubEl) {
    const tier = global.consistency30d >= 90 ? 'Elite discipline tier' : (global.consistency30d >= 70 ? 'Strong momentum' : 'Building consistency');
    consistencySubEl.textContent = `${tier} (last 30 days)`;
  }

  const habitsActiveEl = document.getElementById('streak-kpi-habits-active');
  const habitsTotalEl  = document.getElementById('streak-kpi-habits-total');
  if (habitsActiveEl) habitsActiveEl.textContent = `${global.habitsOnTrack}`;
  if (habitsTotalEl)  habitsTotalEl.textContent = `/ ${global.totalHabits}`;

  // 2. Annual Consistency Heatmap
  renderAnnualHeatmap(habits);

  // 3. Habit Performance Ledger
  renderHabitLedger(withStr);

  // 4. Discipline Shields / Milestone Matrix
  renderDisciplineShields(global);
}

let selectedHeatmapYear = null;

function renderAnnualHeatmap(habits, targetYear = null) {
  const currentYear = new Date().getFullYear();
  if (targetYear) {
    selectedHeatmapYear = targetYear;
  } else if (!selectedHeatmapYear) {
    selectedHeatmapYear = currentYear;
  }
  const year = selectedHeatmapYear;
  const annual = calculateAnnualActivity(habits, year);

  // Update Title and Year Selector
  const cardTitleEl = document.querySelector('.heatmap-title');
  if (cardTitleEl) {
    cardTitleEl.innerHTML = `
      <span>${year} Annual Consistency Matrix</span>
      <div class="heatmap-year-selector">
        <button class="heatmap-year-btn ${year === currentYear - 1 ? 'active' : ''}" data-year="${currentYear - 1}">${currentYear - 1}</button>
        <button class="heatmap-year-btn ${year === currentYear ? 'active' : ''}" data-year="${currentYear}">${currentYear}</button>
      </div>
    `;
    cardTitleEl.querySelectorAll('.heatmap-year-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const y = parseInt(btn.dataset.year, 10);
        if (y !== selectedHeatmapYear) {
          renderAnnualHeatmap(habits, y);
        }
      });
    });
  }

  // Update Subtitle
  const totalCompEl = document.getElementById('heatmap-total-completions');
  if (totalCompEl) {
    totalCompEl.innerHTML = `
      <span class="matrix-range-pill">${annual.timelineRange}</span>
      <span>${annual.totalCompletionsThisYear} completion${annual.totalCompletionsThisYear === 1 ? '' : 's'} across ${annual.activeDaysCount} active days</span>
      ${year === currentYear ? `<span class="matrix-progress-pill">Day ${annual.dayOfYear} of ${annual.totalDaysInYear} (${annual.yearProgressPercent}% elapsed)</span>` : ''}
    `;
  }

  const heatmapContainer = document.getElementById('heatmap-matrix-container');
  if (heatmapContainer && annual.weeks) {
    let heatmapHtml = '';

    // Month header row (synchronized with 53 columns)
    heatmapHtml += '<div class="heatmap-row-wrapper heatmap-months-row">';
    heatmapHtml += '<div class="heatmap-day-label-space"></div>';
    heatmapHtml += '<div class="heatmap-months-track">';
    annual.monthLabels.forEach(m => {
      heatmapHtml += `<span class="heatmap-month-label ${m.isCurrent ? 'is-current-month' : ''}" style="grid-column-start:${m.colIndex + 1}">
        ${m.label}
      </span>`;
    });
    heatmapHtml += '</div></div>';

    // Body row: All 7 days labeled on the left, and 53 columns on the right
    heatmapHtml += '<div class="heatmap-row-wrapper heatmap-body-row">';
    heatmapHtml += '<div class="heatmap-days-col">';
    heatmapHtml += '<span class="heatmap-day-label">Mon</span>';
    heatmapHtml += '<span class="heatmap-day-label">Tue</span>';
    heatmapHtml += '<span class="heatmap-day-label">Wed</span>';
    heatmapHtml += '<span class="heatmap-day-label">Thu</span>';
    heatmapHtml += '<span class="heatmap-day-label">Fri</span>';
    heatmapHtml += '<span class="heatmap-day-label">Sat</span>';
    heatmapHtml += '<span class="heatmap-day-label">Sun</span>';
    heatmapHtml += '</div>';

    heatmapHtml += '<div class="heatmap-weeks-grid">';
    annual.weeks.forEach(week => {
      heatmapHtml += '<div class="heatmap-col">';
      week.forEach(day => {
        const titleText = day.isOutsideYear
          ? ''
          : (day.isFuture
              ? `Upcoming • ${day.date}`
              : `${day.count} completion${day.count === 1 ? '' : 's'} on ${day.date}`);
        const classes = [
          'heatmap-cell',
          `lvl-${day.level}`,
          day.isToday ? 'is-today' : '',
          day.isFuture ? 'is-future' : '',
          day.isOutsideYear ? 'is-outside-year' : ''
        ].filter(Boolean).join(' ');

        heatmapHtml += `<div class="${classes}" data-date="${day.date}" data-count="${day.count}" data-future="${day.isFuture}" data-outside="${day.isOutsideYear}" title="${titleText}"></div>`;
      });
      heatmapHtml += '</div>';
    });
    heatmapHtml += '</div>';
    heatmapHtml += '</div>';

    heatmapContainer.innerHTML = heatmapHtml;

    // Attach interactive hover tooltip
    const tooltipEl = document.getElementById('heatmap-tooltip');
    if (tooltipEl) {
      heatmapContainer.querySelectorAll('.heatmap-cell:not(.is-outside-year)').forEach(cell => {
        cell.addEventListener('mouseenter', () => {
          const date = cell.dataset.date;
          const isFuture = cell.dataset.future === 'true';
          const count = parseInt(cell.dataset.count || '0', 10);
          const dObj = new Date(date + 'T00:00:00');
          const dateStrFormatted = dObj.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });
          
          let content = '';
          if (cell.classList.contains('is-today')) {
            content = `<strong>${count} habit${count === 1 ? '' : 's'} completed today</strong><div style="font-size:11px;color:var(--accent);margin-top:2px">Today • ${dateStrFormatted}</div>`;
          } else if (isFuture) {
            content = `<strong>Upcoming Day</strong><div style="font-size:11px;color:var(--text-3);margin-top:2px">${dateStrFormatted}</div>`;
          } else if (count > 0) {
            content = `<strong>${count} habit${count === 1 ? '' : 's'} completed</strong><div style="font-size:11px;color:var(--text-3);margin-top:2px">${dateStrFormatted}</div>`;
          } else {
            content = `<strong>No completions</strong><div style="font-size:11px;color:var(--text-3);margin-top:2px">${dateStrFormatted}</div>`;
          }

          tooltipEl.innerHTML = content;
          tooltipEl.style.display = 'block';
          const rect = cell.getBoundingClientRect();
          const tipRect = tooltipEl.getBoundingClientRect();
          tooltipEl.style.left = `${rect.left + window.scrollX - tipRect.width / 2 + rect.width / 2}px`;
          tooltipEl.style.top  = `${rect.top + window.scrollY - tipRect.height - 8}px`;
        });
        cell.addEventListener('mouseleave', () => {
          tooltipEl.style.display = 'none';
        });
      });
    }

    // Auto-scroll on mobile/overflow viewports so today or current week is visible
    setTimeout(() => {
      const scrollContainer = document.querySelector('.heatmap-scroll-container');
      if (scrollContainer && scrollContainer.scrollWidth > scrollContainer.clientWidth) {
        const todayCell = heatmapContainer.querySelector('.heatmap-cell.is-today');
        if (todayCell) {
          const cellLeft = todayCell.offsetLeft;
          scrollContainer.scrollLeft = Math.max(0, cellLeft - scrollContainer.clientWidth / 2);
        } else {
          scrollContainer.scrollLeft = 0;
        }
      }
    }, 50);
  }
}

function renderHabitLedger(withStr) {
  const ledgerEl = document.getElementById('streaks-habits-grid');
  if (!ledgerEl) return;
  if (!withStr.length) {
    ledgerEl.innerHTML = `<div class="empty-state" style="grid-column:1/-1"><div class="empty-icon">${ICONS_SVG['flame']}</div><p>No active habits yet. Add habits to start tracking consistency.</p></div>`;
    return;
  }
  ledgerEl.innerHTML = `
    <div class="ledger-table-header">
      <div class="col-habit">Habit Routine</div>
      <div class="col-spark">Last 7 Days</div>
      <div class="col-streak">Current Streak</div>
      <div class="col-best">Best Record</div>
      <div class="col-consistency">30D Consistency</div>
      <div class="col-status">Status Today</div>
    </div>
    <div class="ledger-rows">
      ${withStr.map((h, i) => {
        const isDoneToday = h.streak.last7Days[h.streak.last7Days.length - 1]?.completed;
        const isScheduledToday = h.streak.last7Days[h.streak.last7Days.length - 1]?.scheduled;
        const statusBadge = isDoneToday
          ? `<span class="ledger-tag tag-done">${ICONS_SVG['check-circle'] || ''} Completed</span>`
          : (isScheduledToday
              ? `<span class="ledger-tag tag-due">Due Today</span>`
              : `<span class="ledger-tag tag-rest">Rest Day</span>`);

        return `
          <div class="ledger-row" style="animation-delay:${i * 0.04}s">
            <div class="col-habit">
              <div class="ledger-icon" style="background:${h.color ? h.color + '15' : 'var(--surface-2)'};color:${h.color || 'var(--accent)'}">${getHabitSvg(h.icon, 18)}</div>
              <div class="ledger-name-wrap">
                <div class="ledger-name">${h.name}</div>
                <div class="ledger-category">${CATEGORY_ICONS[h.category] || ''} <span>${h.category}</span></div>
              </div>
            </div>

            <div class="col-spark">
              <div class="sparkline-dots">
                ${h.streak.last7Days.map(d => `
                  <div class="spark-dot ${d.completed ? 'is-done' : (d.isToday ? 'is-today-due' : 'is-missed')} ${!d.scheduled ? 'is-unscheduled' : ''}" title="${d.dayLetter}: ${d.completed ? 'Completed' : (d.isToday ? 'Due today' : 'Not completed')} on ${d.date}">
                    <span class="spark-letter">${d.dayLetter}</span>
                  </div>
                `).join('')}
              </div>
            </div>

            <div class="col-streak">
              <div class="streak-pill-val">
                <span class="fire-icon">🔥</span>
                <span class="num">${h.streak.current}d</span>
              </div>
            </div>

            <div class="col-best">
              <div class="best-stat">
                <span class="best-trophy-icon">🏆</span>
                <span class="best-num">${h.streak.best}d</span>
              </div>
            </div>

            <div class="col-consistency">
              <div class="ledger-progress-wrap">
                <div class="ledger-progress-track">
                  <div class="ledger-progress-fill ${h.streak.consistency30d >= 90 ? 'is-elite' : (h.streak.consistency30d >= 70 ? 'is-good' : '')}" style="width:${h.streak.consistency30d}%"></div>
                </div>
                <span class="ledger-progress-num">${h.streak.consistency30d}%</span>
              </div>
            </div>

            <div class="col-status">
              ${statusBadge}
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

function renderDisciplineShields(global) {
  const shieldsEl = document.getElementById('streak-shields-grid');
  if (!shieldsEl) return;
  const nextInfo = getNextMilestone(global.best);
  shieldsEl.innerHTML = MILESTONES.map(m => {
    const isUnlocked = global.best >= m;
    const data = MILESTONE_DATA[m];
    const isCurrentTarget = nextInfo.nextMilestone === m;

    return `
      <div class="shield-card ${isUnlocked ? 'shield-unlocked' : 'shield-locked'} ${isCurrentTarget ? 'shield-target' : ''}">
        <div class="shield-icon-wrap">
          <div class="shield-icon">${ICONS_SVG[data.key] || ICONS_SVG['award']}</div>
          ${isUnlocked ? '<span class="shield-check">✓</span>' : ''}
        </div>
        <div class="shield-content">
          <div class="shield-title">${data.name} · ${data.title}</div>
          <div class="shield-desc">${data.msg}</div>
          <div class="shield-footer">
            ${isUnlocked
              ? `<span class="shield-status-pill unlocked">Achieved</span>`
              : (isCurrentTarget
                  ? `<span class="shield-status-pill in-progress">${nextInfo.remaining} days away</span>`
                  : `<span class="shield-status-pill locked">${m} Day Target</span>`)}
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// ── Settings Page ─────────────────────────────────────────────
function renderSettingsPage() {
  const user = getUser();
  const nameInput = document.getElementById('settings-name-input');
  if (nameInput) nameInput.value = user.name || '';
  updateAllAvatars();
  renderArchivedHabits();
}

function initSettings() {
  const saveNameBtn = document.getElementById('settings-save-name');
  if (saveNameBtn) saveNameBtn.addEventListener('click', () => {
    const name = document.getElementById('settings-name-input')?.value?.trim();
    if (name) {
      updateUser({ name });
      updateAllAvatars();
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
      message: 'This will permanently delete ALL your habits, completions, streaks, and progress. This action cannot be undone.',
      icon: '',
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

  const dangerDeleteBtn = document.getElementById('settings-danger-delete-btn');
  if (dangerDeleteBtn) {
    dangerDeleteBtn.addEventListener('click', (e) => {
      openDeleteSafetyModal(e);
    });
  }
}

window.setLandingTab = function(m) {
  const tabSignin = document.getElementById('landing-tab-signin');
  const tabSignup = document.getElementById('landing-tab-signup');
  const nameGroup = document.getElementById('landing-name-group');
  const submitBtn = document.getElementById('landing-submit-btn');

  if (m === 'signin') {
    tabSignin?.classList.add('active');
    tabSignup?.classList.remove('active');
    nameGroup?.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'Sign In with Email';
  } else {
    tabSignup?.classList.add('active');
    tabSignin?.classList.remove('active');
    nameGroup?.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'Create Free Account';
  }
};

window.setAuthTab = function(m) {
  const tabSignin = document.getElementById('auth-tab-signin');
  const tabSignup = document.getElementById('auth-tab-signup');
  const nameGroup = document.getElementById('auth-name-group');
  const submitBtn = document.getElementById('auth-submit-btn');

  if (m === 'signin') {
    tabSignin?.classList.add('active');
    tabSignup?.classList.remove('active');
    nameGroup?.classList.add('hidden');
    if (submitBtn) submitBtn.textContent = 'Sign In with Email';
  } else {
    tabSignup?.classList.add('active');
    tabSignin?.classList.remove('active');
    nameGroup?.classList.remove('hidden');
    if (submitBtn) submitBtn.textContent = 'Create Free Account';
  }
};

window.submitAuthForm = async function(e) {
  if (e) e.preventDefault();
  const submitBtn = document.getElementById('auth-submit-btn');
  const email = document.getElementById('auth-email-input')?.value?.trim();
  const password = document.getElementById('auth-password-input')?.value;
  const name = document.getElementById('auth-name-input')?.value?.trim();

  if (!email || !password) {
    showToast('Please enter your email and password', 'error');
    return;
  }

  const isSignUp = document.getElementById('auth-tab-signup')?.classList.contains('active');
  if (isSignUp && !name) {
    showToast('Please enter your name', 'error');
    document.getElementById('auth-name-input')?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';
  }

  try {
    if (isSignUp) {
      await signUpWithEmail(email, password, name);
    } else {
      await loginWithEmail(email, password);
      updateUser({ isLoggedIn: true, authDone: true });
      closeModal('modal-auth');
    }
  } catch (err) {
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? 'Create Free Account' : 'Sign In with Email';
    }
  }
};

window.handleLandingAuthSubmit = async function(e) {
  if (e) e.preventDefault();
  const submitBtn = document.getElementById('landing-submit-btn');
  const email = document.getElementById('landing-email-input')?.value?.trim();
  const password = document.getElementById('landing-password-input')?.value;
  const name = document.getElementById('landing-name-input')?.value?.trim();

  if (!email || !password) {
    showToast('Please enter your email and password', 'error');
    return;
  }

  const isSignUp = document.getElementById('landing-tab-signup')?.classList.contains('active');
  if (isSignUp && !name) {
    showToast('Please enter your name', 'error');
    document.getElementById('landing-name-input')?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = 'Please wait...';
  }

  try {
    if (isSignUp) {
      await signUpWithEmail(email, password, name);
    } else {
      await loginWithEmail(email, password);
      updateUser({ isLoggedIn: true, authDone: true });
      proceedAfterAuth();
    }
  } catch (err) {
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = isSignUp ? 'Create Free Account' : 'Sign In with Email';
    }
  }
};

window.handleGoogleLogin = async function() {
  const googleBtn = document.querySelector('.btn-google');
  if (googleBtn) {
    googleBtn.disabled = true;
    googleBtn.style.opacity = '0.7';
    googleBtn.querySelector('span').textContent = 'Signing in...';
  }
  try {
    const user = await loginWithGoogle();
    if (user) {
      updateUser({ isLoggedIn: true, authDone: true });
      proceedAfterAuth();
    }
  } catch (e) {
    // error toast already shown in loginWithGoogle
  } finally {
    if (googleBtn) {
      googleBtn.disabled = false;
      googleBtn.style.opacity = '1';
      googleBtn.querySelector('span').textContent = 'Continue with Google';
    }
  }
};

window.handleGuestMode = function() {
  updateUser({ isGuest: true, authDone: true });
  showToast('Welcome! Exploring in Guest Mode', 'info');
  proceedAfterAuth();
};

function proceedAfterAuth() {
  const landingOverlay = document.getElementById('landing-overlay');
  if (landingOverlay) landingOverlay.classList.add('hidden');

  const user = getUser();
  if (!user.onboardingDone) {
    const onboardingOverlay = document.getElementById('onboarding-overlay');
    if (onboardingOverlay) onboardingOverlay.classList.remove('hidden');
    initOnboarding();
  } else {
    document.documentElement.classList.add('user-logged-in');
    const appShell = document.getElementById('app');
    if (appShell) appShell.classList.remove('hidden');
    appInit();
  }
}

window.handleForgotPass = async function() {
  const email = document.getElementById('landing-email-input')?.value?.trim() || document.getElementById('auth-email-input')?.value?.trim();
  await resetPassword(email);
};

// ── Authentication & Account UI ───────────────────────────────
function initAuthUI() {
  const logoutBtn = document.getElementById('settings-logout-btn');

  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await logoutUser();
      updateUser({ isLoggedIn: false, authDone: false, isGuest: false, email: null });
      try {
        document.documentElement.classList.remove('user-logged-in');
      } catch(e) {}
      location.hash = '';
      location.reload();
    });
  }

  initAuth((user) => {
    updateAccountSettingsUI(user);
    if (typeof window._refreshAppUI === 'function') {
      window._refreshAppUI();
    }
  });
}

function updateAccountSettingsUI(authUser) {
  const statusEl = document.getElementById('settings-account-status');
  const descEl   = document.getElementById('settings-account-desc');
  const loginBtn = document.getElementById('settings-login-btn');
  const logoutBtn = document.getElementById('settings-logout-btn');
  const syncBadge = document.getElementById('settings-sync-badge');
  const avatarEl  = document.getElementById('settings-avatar-initial');

  const user = getUser();
  const rawEmail = (authUser && authUser.email) || user.email;
  const displayName = (authUser && authUser.displayName) || user.name;
  const accountIdentifier = rawEmail || (displayName ? `${displayName}` : null);

  updateAllAvatars();

  if (authUser || user.email) {
    if (statusEl) statusEl.textContent = accountIdentifier ? `Cloud: ${accountIdentifier}` : 'Cloud Account';
    if (descEl) descEl.textContent = '✓ Progress is automatically synced to the cloud';
    if (syncBadge) {
      syncBadge.textContent = 'Synced';
      syncBadge.className = 'settings-pill-badge badge-synced';
    }
    if (loginBtn) loginBtn.classList.add('hidden');
    if (logoutBtn) logoutBtn.classList.remove('hidden');
  } else {
    if (statusEl) statusEl.textContent = 'Guest Workspace';
    if (descEl) descEl.textContent = 'Sign in with Email or Google to sync across devices';
    if (syncBadge) {
      syncBadge.textContent = 'Local';
      syncBadge.className = 'settings-pill-badge';
    }
    if (loginBtn) loginBtn.classList.remove('hidden');
    if (logoutBtn) logoutBtn.classList.add('hidden');
  }

  const dangerScopeEl = document.getElementById('danger-scope-status');
  if (dangerScopeEl) {
    if (authUser || user.email) {
      dangerScopeEl.textContent = `Cloud Account (${accountIdentifier || 'Synced'})`;
    } else {
      dangerScopeEl.textContent = 'Guest Workspace (Local Data)';
    }
  }
}
window._updateAccountUI = updateAccountSettingsUI;

// ── Safety Verification Modal Logic ───────────────────────────
export function openDeleteSafetyModal(e) {
  if (e && e.preventDefault) e.preventDefault();

  const keywordInput = document.getElementById('delete-safety-keyword-input');
  const confirmBtn = document.getElementById('delete-safety-confirm-btn');
  const errorEl = document.getElementById('delete-safety-error-msg');

  if (keywordInput) keywordInput.value = '';
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }
  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>Delete Account</span>';
  }

  openModal('modal-delete-safety');
  setTimeout(() => {
    keywordInput?.focus();
  }, 120);
}

export async function executeDeleteSafetyAccount() {
  const confirmBtn = document.getElementById('delete-safety-confirm-btn');
  const keywordInput = document.getElementById('delete-safety-keyword-input');
  const errorEl = document.getElementById('delete-safety-error-msg');

  if (keywordInput && keywordInput.value.trim().toUpperCase() !== 'DELETE') {
    if (errorEl) {
      errorEl.textContent = 'Please type DELETE to confirm.';
      errorEl.classList.remove('hidden');
    }
    return;
  }

  if (confirmBtn) {
    confirmBtn.disabled = true;
    confirmBtn.innerHTML = '<span>Deleting Account...</span>';
  }
  if (errorEl) {
    errorEl.textContent = '';
    errorEl.classList.add('hidden');
  }

  try {
    await deleteAccountAndData();
  } catch (err) {
    console.error('Account deletion error:', err);
    if (errorEl) {
      errorEl.textContent = err.message || 'Error deleting account. Please try again.';
      errorEl.classList.remove('hidden');
    }
    showToast(err.message || 'Error deleting account', 'error');
    if (confirmBtn) {
      confirmBtn.disabled = false;
      confirmBtn.innerHTML = '<span>Delete Account</span>';
    }
  }
}

function initDeleteSafetyInputs() {
  const keywordInput = document.getElementById('delete-safety-keyword-input');
  const confirmBtn = document.getElementById('delete-safety-confirm-btn');

  if (keywordInput) {
    keywordInput.addEventListener('input', () => {
      const matches = keywordInput.value.trim().toUpperCase() === 'DELETE';
      if (confirmBtn) {
        confirmBtn.disabled = !matches;
      }
    });
  }
}

// ── Profile Photo & Avatar Management ─────────────────────────
export function updateAllAvatars() {
  const user = getUser();
  const photoUrl = user.photoUrl || user.avatarImage || null;
  const initial = (user.name || user.email || 'D').trim().charAt(0).toUpperCase() || 'D';

  const avatarTargets = [
    document.getElementById('mobile-header-avatar'),
    document.getElementById('profile-menu-avatar'),
    document.getElementById('settings-avatar-initial'),
    document.getElementById('sidebar-avatar'),
    document.getElementById('drawer-avatar')
  ];

  avatarTargets.forEach(el => {
    if (!el) return;
    if (photoUrl) {
      el.innerHTML = `<img src="${photoUrl}" alt="Profile" class="avatar-img-element" />`;
      el.classList.add('has-photo');
    } else {
      el.innerHTML = initial;
      el.classList.remove('has-photo');
    }
  });

  const removeBtn = document.getElementById('profile-menu-remove-photo-btn');
  if (removeBtn) {
    if (photoUrl) removeBtn.classList.remove('hidden');
    else removeBtn.classList.add('hidden');
  }
}
window.updateAllAvatars = updateAllAvatars;

export function triggerProfilePhotoUpload() {
  const input = document.getElementById('profile-photo-file-input');
  if (input) {
    input.value = '';
    input.click();
  }
}
window.triggerProfilePhotoUpload = triggerProfilePhotoUpload;

export function handleProfilePhotoUpload(e) {
  const file = e.target.files && e.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    showToast('Please select a valid image file', 'error');
    return;
  }

  const reader = new FileReader();
  reader.onload = (event) => {
    const img = new Image();
    img.onload = () => {
      // Compress & crop to square 256x256
      const canvas = document.createElement('canvas');
      const size = 256;
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');

      // Center-crop square math
      const minDim = Math.min(img.width, img.height);
      const sx = (img.width - minDim) / 2;
      const sy = (img.height - minDim) / 2;

      ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);
      const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.85);

      updateUser({ photoUrl: compressedDataUrl });
      updateAllAvatars();
      showToast('✓ Profile photo updated!', 'success');
      closeProfileQuickMenu();
    };
    img.src = event.target.result;
  };
  reader.readAsDataURL(file);
}
window.handleProfilePhotoUpload = handleProfilePhotoUpload;

export function removeProfilePhoto() {
  updateUser({ photoUrl: null, avatarImage: null });
  updateAllAvatars();
  showToast('Profile photo removed', 'info');
  closeProfileQuickMenu();
}
window.removeProfilePhoto = removeProfilePhoto;

export function toggleProfileQuickMenu(e) {
  if (e) {
    e.stopPropagation();
    e.preventDefault();
  }
  const menu = document.getElementById('profile-quick-menu');
  if (!menu) return;
  const isOpen = menu.classList.contains('active');
  if (isOpen) closeProfileQuickMenu();
  else openProfileQuickMenu();
}
window.toggleProfileQuickMenu = toggleProfileQuickMenu;

export function openProfileQuickMenu() {
  const menu = document.getElementById('profile-quick-menu');
  const overlay = document.getElementById('profile-quick-overlay');
  if (!menu) return;

  const user = getUser();
  const nameEl = document.getElementById('profile-menu-name');
  const emailEl = document.getElementById('profile-menu-email');
  const levelEl = document.getElementById('profile-menu-level');

  if (nameEl) nameEl.textContent = user.name || 'Friend';
  if (emailEl) emailEl.textContent = user.email || 'Guest Workspace';
  if (levelEl) levelEl.textContent = `Level ${user.level || 1} · ${user.totalXP || 0} XP`;

  updateAllAvatars();

  menu.classList.add('active');
  if (overlay) overlay.classList.add('active');
}
window.openProfileQuickMenu = openProfileQuickMenu;

export function closeProfileQuickMenu() {
  const menu = document.getElementById('profile-quick-menu');
  const overlay = document.getElementById('profile-quick-overlay');
  if (menu) menu.classList.remove('active');
  if (overlay) overlay.classList.remove('active');
}
window.closeProfileQuickMenu = closeProfileQuickMenu;

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
  initMobileDrawer();
  initHabitForm();
  initCheckin();
  initModalClose();
  initDeleteSafetyInputs();
  initSettings();
  initAuthUI();
  initGlobalButtons();
  restoreActiveReward();
  updateAllAvatars();

  // Expose global render function for cross-module use
  window._renderDashboard = renderDashboard;
  window._renderCalendar = renderCalendarPage;
  window.openDayDetailModal = openDayDetailModal;
  window._ui = { showConfetti };

  // Global UI refresh triggered whenever remote cloud sync updates local state
  window._refreshAppUI = function() {
    updateAllAvatars();
    updateAccountSettingsUI(getAuthUser ? getAuthUser() : null);
    const hashPage = (location.hash || '#dashboard').slice(1);
    const targetPage = PAGES.includes(hashPage) ? hashPage : (currentPage || 'dashboard');
    navigateTo(targetPage);
  };

  // Navigate to initial page
  const page = (location.hash || '#dashboard').slice(1);
  navigateTo(PAGES.includes(page) ? page : 'dashboard');
}

// ── Boot Entry Pipeline ───────────────────────────────────────
window._appInit = appInit;
window._proceedAfterAuth = proceedAfterAuth;

async function bootApp() {
  const user = getUser();
  const isAuthDone = user.isLoggedIn || user.isGuest || user.authDone || user.email;

  const landingOverlay = document.getElementById('landing-overlay');
  const onboardingOverlay = document.getElementById('onboarding-overlay');
  const appShell = document.getElementById('app');

  if (isAuthDone) {
    if (landingOverlay) landingOverlay.classList.add('hidden');

    if (!user.onboardingDone) {
      if (onboardingOverlay) onboardingOverlay.classList.remove('hidden');
      if (appShell) appShell.classList.add('hidden');
      initOnboarding();
    } else {
      document.documentElement.classList.add('user-logged-in');
      if (onboardingOverlay) onboardingOverlay.classList.add('hidden');
      if (appShell) appShell.classList.remove('hidden');
      appInit();
    }

    // Check redirect in background without blocking initial paint or page load
    handleRedirectResult().catch(() => {});
    return;
  }

  // Not authenticated locally — check if we just returned from a Google sign-in redirect
  const redirectUser = await handleRedirectResult();
  if (redirectUser) {
    updateUser({ isLoggedIn: true, authDone: true });
    proceedAfterAuth();
    return;
  }

  // Unauthenticated user: display landing welcome screen
  document.documentElement.classList.remove('user-logged-in');
  if (landingOverlay) landingOverlay.classList.remove('hidden');
  if (onboardingOverlay) onboardingOverlay.classList.add('hidden');
  if (appShell) appShell.classList.add('hidden');
}

bootApp();

// Handle browser back/forward
window.addEventListener('popstate', () => {
  const page = (location.hash || '#dashboard').slice(1);
  navigateTo(page);
});

// Make key functions global for inline onclick
window.openAddHabitModal = openAddHabitModal;
window.openModal = (id) => {
  if (id === 'modal-checkin') {
    const todayStr = today();
    if (getCheckinForDate(todayStr)) {
      showToast('You have already checked in for today.', 'info');
      return;
    }
  }
  openModal(id);
};
window.closeModal = closeModal;
window.handleCheckinClick = handleCheckinClick;
window.applyReward = (id) => applyReward(id);
window.calendarPrev = calendarPrev;
window.calendarNext = calendarNext;
window.setAuthTab = window.setAuthTab;
window.submitAuthForm = window.submitAuthForm;
window.openDeleteSafetyModal = openDeleteSafetyModal;
window.executeDeleteSafetyAccount = executeDeleteSafetyAccount;
window.checkEmailVerificationStatus = checkEmailVerification;
window.resendEmailVerificationLink = resendVerification;
window.cancelEmailVerification = cancelEmailVerification;

// ── PWA Service Worker Registration ───────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => {
        console.log('[PWA] ServiceWorker registered with scope:', reg.scope);
      })
      .catch((err) => {
        console.warn('[PWA] ServiceWorker registration failed:', err);
      });
  });
}

// ── PWA Install Prompt Handler ────────────────────────────────
let deferredInstallPrompt = null;
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  window.deferredInstallPrompt = deferredInstallPrompt;
  console.log('[PWA] beforeinstallprompt captured, ready for install.');
  window.dispatchEvent(new CustomEvent('pwa-installable'));
});

window.triggerPWAInstall = async () => {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log('[PWA] User choice outcome:', outcome);
    deferredInstallPrompt = null;
    window.deferredInstallPrompt = null;
  } else {
    showToast('To install, use browser menu: "Install App" or "Add to Home Screen"', 'info');
  }
};
