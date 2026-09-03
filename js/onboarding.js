// ============================================================
// onboarding.js — 5-step onboarding wizard
// ============================================================

import { getUser, updateUser, addHabit } from './data.js';
import { uploadLocalDataToCloud } from './auth.js';
import { auth, isFirebaseConfigured } from './firebase-config.js';

const STARTER_HABITS = [
  { icon: '📚', name: 'Read 10 pages',     category: 'learning', difficulty: 'medium', xpReward: 20, frequency: 'daily',    cats: ['learning'] },
  { icon: '🧘', name: 'Meditate',           category: 'mind',     difficulty: 'easy',   xpReward: 10, frequency: 'daily',    cats: ['mind'] },
  { icon: '💻', name: 'Study / Practice',   category: 'learning', difficulty: 'hard',   xpReward: 30, frequency: 'weekdays', cats: ['learning', 'work'] },
  { icon: '🏃', name: 'Exercise',           category: 'fitness',  difficulty: 'hard',   xpReward: 30, frequency: 'daily',    cats: ['fitness'] },
  { icon: '📝', name: 'Plan tomorrow',      category: 'work',     difficulty: 'easy',   xpReward: 10, frequency: 'daily',    cats: ['work', 'routine'] },
  { icon: '🌙', name: 'Sleep by 11pm',      category: 'routine',  difficulty: 'medium', xpReward: 20, frequency: 'daily',    cats: ['routine'] },
  { icon: '🚶', name: 'Walk 10 min',        category: 'fitness',  difficulty: 'easy',   xpReward: 10, frequency: 'daily',    cats: ['fitness'] },
  { icon: '✍️', name: 'Journal',            category: 'mind',     difficulty: 'easy',   xpReward: 10, frequency: 'daily',    cats: ['mind', 'personal'] },
  { icon: '💧', name: 'Drink 8 glasses',    category: 'routine',  difficulty: 'easy',   xpReward: 10, frequency: 'daily',    cats: ['routine', 'fitness'] },
  { icon: '🎯', name: 'Deep work 1 hr',     category: 'work',     difficulty: 'hard',   xpReward: 30, frequency: 'weekdays', cats: ['work'] },
  { icon: '🌱', name: 'Personal project',   category: 'personal', difficulty: 'medium', xpReward: 20, frequency: 'daily',    cats: ['personal'] },
  { icon: '📖', name: 'No phone after 9pm', category: 'routine',  difficulty: 'medium', xpReward: 20, frequency: 'daily',    cats: ['routine', 'mind'] },
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

  if (step === 4) renderStarterHabits();
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
        <span class="starter-habit-icon">${h.icon}</span>
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
    userName = (input?.value || '').trim() || 'Friend';
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
  updateUser({ name: userName || 'Friend', onboardingDone: true });

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

  const overlay = document.getElementById('onboarding-overlay');
  const appShell = document.getElementById('app');
  if (overlay) overlay.classList.add('hidden');
  if (appShell) appShell.classList.remove('hidden');

  if (window._appInit) window._appInit();
  if (window._renderDashboard) window._renderDashboard();
};

