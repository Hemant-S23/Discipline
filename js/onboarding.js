// ============================================================
// onboarding.js — 5-step onboarding wizard
// ============================================================

import { getUser, updateUser, addHabit } from './data.js?v=6.0';
import { uploadLocalDataToCloud } from './auth.js?v=6.0';
import { auth, isFirebaseConfigured } from './firebase-config.js?v=6.0';
import { showToast } from './ui.js?v=6.0';
import { getHabitSvg } from './icons.js?v=6.0';

const STARTER_HABITS = [
  { icon: 'book',     name: 'Read 10 pages',     category: 'learning', difficulty: 'medium', xpReward: 20, frequency: 'daily', cats: ['learning'] },
  { icon: 'meditate', name: 'Meditate',           category: 'mind',     difficulty: 'easy',   xpReward: 10, frequency: 'daily', cats: ['mind'] },
  { icon: 'code',     name: 'Study / Practice',   category: 'learning', difficulty: 'hard',   xpReward: 30, frequency: 'daily', cats: ['learning', 'work'] },
  { icon: 'activity', name: 'Exercise',           category: 'fitness',  difficulty: 'hard',   xpReward: 30, frequency: 'daily', cats: ['fitness'] },
  { icon: 'pen',      name: 'Plan tomorrow',      category: 'work',     difficulty: 'easy',   xpReward: 10, frequency: 'daily', cats: ['work', 'routine'] },
  { icon: 'moon',     name: 'Sleep by 11pm',      category: 'routine',  difficulty: 'medium', xpReward: 20, frequency: 'daily', cats: ['routine'] },
  { icon: 'walk',     name: 'Walk 10 min',        category: 'fitness',  difficulty: 'easy',   xpReward: 10, frequency: 'daily', cats: ['fitness'] },
  { icon: 'pen',      name: 'Journal',            category: 'mind',     difficulty: 'easy',   xpReward: 10, frequency: 'daily', cats: ['mind', 'personal'] },
  { icon: 'droplet',  name: 'Drink 8 glasses',    category: 'routine',  difficulty: 'easy',   xpReward: 10, frequency: 'daily', cats: ['routine', 'fitness'] },
  { icon: 'target',   name: 'Deep work 1 hr',     category: 'work',     difficulty: 'hard',   xpReward: 30, frequency: 'daily', cats: ['work'] },
  { icon: 'sprout',   name: 'Personal project',   category: 'personal', difficulty: 'medium', xpReward: 20, frequency: 'daily', cats: ['personal'] },
  { icon: 'book',     name: 'No phone after 9pm', category: 'routine',  difficulty: 'medium', xpReward: 20, frequency: 'daily', cats: ['routine', 'mind'] },
];

let currentStep = 1;
const TOTAL_STEPS = 5;
let selectedGoals = new Set();
let selectedHabitNames = new Set();
let userName = '';

export function showStep(step) {
  currentStep = step;
  document.querySelectorAll('.onboarding-step').forEach(el => el.classList.remove('active'));
  const stepEl = document.querySelector(`.onboarding-step[data-step="${step}"]`);
  if (stepEl) stepEl.classList.add('active');

  document.querySelectorAll('.onboarding-dot').forEach((dot, idx) => {
    dot.classList.remove('active', 'done');
    if (idx + 1 === step) dot.classList.add('active');
    else if (idx + 1 < step) dot.classList.add('done');
  });

  if (step === 2) setupNameStep();
  else if (step === 4) renderStarterHabits();
}

function setupNameStep() {
  const input = document.getElementById('ob-name-input');
  const nextBtn = document.getElementById('ob-step2-next-btn');
  const errorEl = document.getElementById('ob-name-error');
  if (!input) return;

  const user = getUser();
  // Pre-fill if a real display name was provided (e.g. from Google login)
  if (!input.value.trim() && user.name && user.name !== 'Friend' && user.name !== 'Google User') {
    input.value = user.name;
  }

  const checkValidity = () => {
    const val = input.value.trim();
    if (nextBtn) {
      nextBtn.disabled = val.length === 0;
    }
    if (val.length > 0) {
      if (errorEl) errorEl.classList.add('hidden');
      input.classList.remove('input-error-shake');
    }
  };

  if (!input.dataset.listenerAttached) {
    input.dataset.listenerAttached = 'true';
    input.addEventListener('input', checkValidity);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        onboardingNext();
      }
    });
  }

  checkValidity();
  setTimeout(() => input.focus(), 150);
}

export function initOnboarding() {
  const user = getUser();
  if (user.onboardingDone) {
    const overlay = document.getElementById('onboarding-overlay');
    const appShell = document.getElementById('app');
    if (overlay) overlay.classList.add('hidden');
    if (appShell) appShell.classList.remove('hidden');
    return false;
  }
  showStep(1);
  return true;
}

function renderStarterHabits() {
  const container = document.getElementById('starter-habits-container');
  if (!container) return;

  const filtered = selectedGoals.size === 0
    ? STARTER_HABITS
    : STARTER_HABITS.filter(h => h.cats.some(c => selectedGoals.has(c)));

  // If no habits selected yet, pre-select first 3
  if (selectedHabitNames.size === 0 && filtered.length > 0) {
    filtered.slice(0, 3).forEach(h => selectedHabitNames.add(h.name));
  }

  container.innerHTML = filtered.map((h) => {
    const isSel = selectedHabitNames.has(h.name);
    return `
      <div class="starter-habit-item ${isSel ? 'selected' : ''}"
           onclick="window.toggleStarterHabitByName('${h.name.replace(/'/g, "\\'")}')">
        <span class="starter-habit-icon" style="display:inline-flex;align-items:center;justify-content:center">${getHabitSvg(h.icon, 20)}</span>
        <div class="starter-habit-info">
          <div class="starter-habit-name">${h.name}</div>
          <div class="starter-habit-meta">${h.category} · ${h.difficulty} · +${h.xpReward} XP</div>
        </div>
        <span class="starter-habit-check">${isSel ? '✓' : '+'}</span>
      </div>
    `;
  }).join('');
}

window.toggleStarterHabitByName = function(name) {
  if (selectedHabitNames.has(name)) {
    selectedHabitNames.delete(name);
  } else {
    selectedHabitNames.add(name);
  }
  renderStarterHabits();
};

window.toggleGoal = function(goal, el) {
  if (selectedGoals.has(goal)) {
    selectedGoals.delete(goal);
    el.classList.remove('selected');
  } else {
    selectedGoals.add(goal);
    el.classList.add('selected');
  }
  // Clear pre-selections when categories change so fresh category habits are highlighted
  selectedHabitNames.clear();
};

window.onboardingNext = function() {
  if (currentStep === 2) {
    const input = document.getElementById('ob-name-input');
    const nextBtn = document.getElementById('ob-step2-next-btn');
    const errorEl = document.getElementById('ob-name-error');
    const val = (input?.value || '').trim();

    if (!val) {
      input?.focus();
      input?.classList.add('input-error-shake');
      setTimeout(() => input?.classList.remove('input-error-shake'), 600);
      if (errorEl) errorEl.classList.remove('hidden');
      if (nextBtn) nextBtn.disabled = true;
      showToast('Please enter your name to continue', 'warning');
      return; // Cannot proceed without entering name!
    }

    if (errorEl) errorEl.classList.add('hidden');
    userName = val;
    updateUser({ name: userName });
  }

  if (currentStep < TOTAL_STEPS) {
    showStep(currentStep + 1);
  }
};

window.onboardingBack = function() {
  if (currentStep > 1) {
    showStep(currentStep - 1);
  }
};

window.finishOnboarding = async function() {
  if (!userName || userName.trim() === '' || userName === 'Friend') {
    const input = document.getElementById('ob-name-input');
    const val = (input?.value || '').trim();
    if (val) {
      userName = val;
    } else {
      showStep(2);
      showToast('Please enter your name to complete setup', 'warning');
      return;
    }
  }

  updateUser({ name: userName, onboardingDone: true });

  const habitsToCreate = selectedHabitNames.size > 0
    ? STARTER_HABITS.filter(h => selectedHabitNames.has(h.name))
    : STARTER_HABITS.slice(0, 3);

  // Add habits to local storage
  habitsToCreate.forEach(h => {
    addHabit({
      name: h.name,
      icon: h.icon,
      category: h.category,
      frequency: h.frequency || 'daily',
      difficulty: h.difficulty || 'medium',
      xpReward: h.xpReward || 20
    });
  });

  // Sync to Firebase Cloud Firestore immediately if logged in
  const authUser = auth?.currentUser;
  if (authUser && isFirebaseConfigured) {
    try {
      await uploadLocalDataToCloud(authUser.uid);
    } catch (e) {
      console.warn('Onboarding cloud sync:', e);
    }
  }

  try { document.documentElement.classList.add('user-logged-in'); } catch(e) {}
  const overlay = document.getElementById('onboarding-overlay');
  const appShell = document.getElementById('app');
  if (overlay) overlay.classList.add('hidden');
  if (appShell) appShell.classList.remove('hidden');

  if (window._appInit) window._appInit();
  if (window._renderDashboard) window._renderDashboard();
};

