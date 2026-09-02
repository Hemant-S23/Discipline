// ============================================================
// onboarding.js — 5-step onboarding wizard
// ============================================================

import { getUser, updateUser, addHabit } from './data.js';

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
let selectedHabits = new Set();
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

  container.innerHTML = filtered.map((h, i) => `
    <div class="starter-habit-item ${selectedHabits.has(i) ? 'selected' : ''}"
         onclick="window.toggleStarterHabit(${i})" data-idx="${i}">
      <span class="starter-habit-icon">${h.icon}</span>
      <div class="starter-habit-info">
        <div class="starter-habit-name">${h.name}</div>
        <div class="starter-habit-meta">${h.category} · ${h.difficulty} · +${h.xpReward} XP</div>
      </div>
    </div>
  `).join('');

  window._onboardingFiltered = filtered;
}

// Attach immediately to window for inline onclick handlers
window.toggleStarterHabit = function(idx) {
  if (selectedHabits.has(idx)) selectedHabits.delete(idx);
  else selectedHabits.add(idx);
  document.querySelectorAll(`.starter-habit-item[data-idx="${idx}"]`).forEach(el => {
    el.classList.toggle('selected', selectedHabits.has(idx));
  });
};

window.toggleGoal = function(goal, el) {
  if (selectedGoals.has(goal)) { selectedGoals.delete(goal); el.classList.remove('selected'); }
  else { selectedGoals.add(goal); el.classList.add('selected'); }
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

window.finishOnboarding = function() {
  updateUser({ name: userName || 'Friend', onboardingDone: true });

  const filtered = window._onboardingFiltered || STARTER_HABITS;
  const habitsToCreate = selectedHabits.size > 0
    ? [...selectedHabits].map(i => filtered[i]).filter(Boolean)
    : STARTER_HABITS.slice(0, 3);

  habitsToCreate.forEach(h => addHabit({ ...h }));

  const overlay = document.getElementById('onboarding-overlay');
  const appShell = document.getElementById('app');
  if (overlay) overlay.classList.add('hidden');
  if (appShell) appShell.classList.remove('hidden');

  if (window._appInit) window._appInit();
};
