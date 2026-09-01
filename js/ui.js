// ============================================================
// ui.js — Shared UI helpers: toast, modal, confetti, XP float
// ============================================================

// ── Toast ─────────────────────────────────────────────────────
const TOAST_ICONS = { success: '✓', error: '✕', info: 'ℹ', achievement: '🏆', warning: '⚠' };

export function showToast(message, type = 'success', duration = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span class="toast-icon">${TOAST_ICONS[type] || '✓'}</span><span class="toast-msg">${message}</span>`;
  container.appendChild(toast);

  requestAnimationFrame(() => { setTimeout(() => toast.classList.add('toast-show'), 10); });

  setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.classList.add('toast-hide');
    setTimeout(() => toast.remove(), 350);
  }, duration);
}

// ── XP Float ─────────────────────────────────────────────────
export function showXPFloat(amount, sourceEl) {
  const container = document.getElementById('xp-float-container');
  if (!container) return;

  const rect = sourceEl ? sourceEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
  const el = document.createElement('div');
  el.className = 'xp-float';
  el.textContent = `+${amount} XP ⭐`;
  el.style.left = (rect.left + rect.width / 2) + 'px';
  el.style.top = (rect.top + window.scrollY) + 'px';
  container.appendChild(el);

  requestAnimationFrame(() => { setTimeout(() => el.classList.add('xp-float-active'), 10); });
  setTimeout(() => el.remove(), 1400);
}

// ── Modal ─────────────────────────────────────────────────────
export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.add('modal-open');
  document.body.classList.add('body-modal');

  // Close on backdrop click
  el.onclick = (e) => { if (e.target === el) closeModal(id); };
}

export function closeModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('modal-open');
  document.body.classList.remove('body-modal');
}

// Close all modals
export function closeAllModals() {
  document.querySelectorAll('.modal-overlay.modal-open').forEach(m => {
    m.classList.remove('modal-open');
  });
  document.body.classList.remove('body-modal');
}

// ── Confetti ─────────────────────────────────────────────────
export function showConfetti(duration = 3000) {
  const canvas = document.getElementById('confetti-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  canvas.style.display = 'block';
  canvas.style.pointerEvents = 'none';

  const colors = ['#7C6FF7', '#F97316', '#F59E0B', '#22C55E', '#EF4444', '#EC4899', '#06B6D4'];
  const particles = Array.from({ length: 180 }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * -canvas.height,
    color: colors[Math.floor(Math.random() * colors.length)],
    w: Math.random() * 10 + 4,
    h: Math.random() * 6 + 3,
    speed: Math.random() * 4 + 2,
    angle: Math.random() * Math.PI * 2,
    spin: (Math.random() - 0.5) * 0.2,
    swing: Math.random() * 2 - 1
  }));

  const start = Date.now();
  function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const elapsed = Date.now() - start;
    const alpha = elapsed > duration - 500 ? 1 - (elapsed - (duration - 500)) / 500 : 1;
    ctx.globalAlpha = Math.max(0, alpha);

    particles.forEach(p => {
      p.y += p.speed;
      p.angle += p.spin;
      p.x += p.swing;
      if (p.y > canvas.height) { p.y = -10; p.x = Math.random() * canvas.width; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });

    if (elapsed < duration) requestAnimationFrame(animate);
    else { ctx.clearRect(0, 0, canvas.width, canvas.height); canvas.style.display = 'none'; ctx.globalAlpha = 1; }
  }
  animate();
}

// ── Quotes ────────────────────────────────────────────────────
export const QUOTES = [
  "Consistency beats motivation.",
  "Small wins compound into big results.",
  "You don't rise to the level of your goals. You fall to the level of your systems.",
  "The secret of your future is hidden in your daily routine.",
  "Success is the sum of small efforts repeated day in and day out.",
  "Don't break the chain.",
  "It's not about having time. It's about making time.",
  "Every habit you have was once a first step.",
  "Progress, not perfection.",
  "Show up. Every day. No exceptions.",
  "Discipline is the bridge between goals and accomplishment.",
  "One day or day one. You decide.",
  "We are what we repeatedly do. Excellence is not an act, but a habit.",
  "Build systems, not goals.",
  "Motivation gets you started. Habit keeps you going.",
  "Each day is a new opportunity to grow.",
  "First we make our habits, then our habits make us.",
  "Discipline is choosing between what you want now and what you want most.",
  "Your habits shape your identity, and your identity shapes your habits.",
  "Be relentless in the pursuit of what sets your mind on fire.",
  "Great things are done by a series of small things brought together.",
  "Action is the foundational key to all success.",
  "Self-discipline is self-caring.",
  "Focus on the process, not the outcome.",
  "A 1% improvement every day means 37x better in a year.",
  "Small daily improvements over time lead to stunning results.",
  "Discipline will take you places motivation never could.",
  "Mastering yourself is true power.",
  "The pain of discipline is far less than the pain of regret.",
  "Do something today that your future self will thank you for.",
  "If you get tired, learn to rest, not to quit.",
  "Energy flows where attention goes.",
  "Clear vision, disciplined action, daily compound interest.",
  "Fall in love with the daily grind.",
  "Small promises. Kept every day."
];

let lastQuoteIndex = -1;

export function getDailyQuote() {
  const start = new Date(new Date().getFullYear(), 0, 0);
  const day = Math.floor((Date.now() - start.getTime()) / 86400000);
  return QUOTES[day % QUOTES.length];
}

export function getRandomQuote() {
  let idx;
  do {
    idx = Math.floor(Math.random() * QUOTES.length);
  } while (idx === lastQuoteIndex && QUOTES.length > 1);
  lastQuoteIndex = idx;
  return QUOTES[idx];
}

export function rotateQuote(quoteEl) {
  if (!quoteEl) return;
  quoteEl.classList.add('quote-fade');
  setTimeout(() => {
    quoteEl.textContent = `"${getRandomQuote()}"`;
    quoteEl.classList.remove('quote-fade');
  }, 250);
}

// ── Greeting ─────────────────────────────────────────────────
export function getGreeting() {
  const h = new Date().getHours();
  if (h < 5)  return 'Good night';
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  if (h < 21) return 'Good evening';
  return 'Good night';
}

// ── Format helpers ────────────────────────────────────────────
export function formatNumber(n) {
  return n >= 1000 ? (n / 1000).toFixed(1).replace(/\.0$/, '') + 'K' : String(n);
}

export function formatDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

export function formatShortDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function getTodayLong() {
  const d = new Date();
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

// ── Animate habit check ───────────────────────────────────────
export function animateHabitComplete(checkEl) {
  checkEl.classList.add('habit-bounce');
  setTimeout(() => checkEl.classList.remove('habit-bounce'), 600);
}

// ── Streak fire pulse ─────────────────────────────────────────
export function pulseStreak(el) {
  el.classList.add('streak-pulse');
  setTimeout(() => el.classList.remove('streak-pulse'), 800);
}

// ── Difficulty label ──────────────────────────────────────────
export function difficultyLabel(d) {
  return { easy: 'Easy', medium: 'Medium', hard: 'Hard' }[d] || 'Medium';
}

// ── Category label ────────────────────────────────────────────
export const CATEGORY_ICONS = {
  mind: '🧠', learning: '📚', fitness: '💪', work: '💻', personal: '🌱', routine: '😴'
};
export const CATEGORY_LABELS = {
  mind: 'Mind', learning: 'Learning', fitness: 'Fitness', work: 'Work', personal: 'Personal', routine: 'Routine'
};

// ── Scroll to top ─────────────────────────────────────────────
export function scrollTop() {
  const main = document.querySelector('.main-content');
  if (main) main.scrollTop = 0;
}

// ── Ripple effect ─────────────────────────────────────────────
export function addRipple(el, e) {
  const ripple = document.createElement('span');
  ripple.className = 'ripple';
  const rect = el.getBoundingClientRect();
  ripple.style.left = (e.clientX - rect.left) + 'px';
  ripple.style.top = (e.clientY - rect.top) + 'px';
  el.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

// ── Percentage display ────────────────────────────────────────
export function pctBar(pct, el) {
  if (!el) return;
  el.style.width = Math.min(100, Math.max(0, pct)) + '%';
}
