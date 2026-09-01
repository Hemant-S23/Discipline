// ============================================================
// rewards.js — Reward definitions and shop rendering
// ============================================================

import { getUser } from './data.js';
import { showToast } from './ui.js';

export const REWARDS = [
  {
    id: 'sakura_theme',
    name: 'Sakura Theme',
    icon: '🌸',
    cost: 300,
    desc: 'A soft pink blossom dashboard theme.',
    themeClass: 'theme-sakura'
  },
  {
    id: 'ocean_theme',
    name: 'Ocean Theme',
    icon: '🌊',
    cost: 500,
    desc: 'A deep ocean blue calming theme.',
    themeClass: 'theme-ocean'
  },
  {
    id: 'forest_theme',
    name: 'Forest Theme',
    icon: '🌿',
    cost: 750,
    desc: 'A lush green forest theme.',
    themeClass: 'theme-forest'
  },
  {
    id: 'sunset_theme',
    name: 'Sunset Theme',
    icon: '🌅',
    cost: 1000,
    desc: 'A warm sunset orange and pink theme.',
    themeClass: 'theme-sunset'
  },
  {
    id: 'midnight_theme',
    name: 'Midnight Theme',
    icon: '🌙',
    cost: 1200,
    desc: 'A deep midnight dark theme.',
    themeClass: 'theme-midnight'
  },
  {
    id: 'neon_theme',
    name: 'Neon Theme',
    icon: '⚡',
    cost: 1500,
    desc: 'Electric neon cyberpunk theme.',
    themeClass: 'theme-neon'
  },
  {
    id: 'gold_badge',
    name: 'Golden Badge',
    icon: '🥇',
    cost: 2000,
    desc: 'A golden profile badge of honor.',
    themeClass: null
  },
  {
    id: 'epic_confetti',
    name: 'Epic Celebrations',
    icon: '🎆',
    cost: 2500,
    desc: 'More intense confetti on perfect days.',
    themeClass: null
  },
  {
    id: 'diamond_badge',
    name: 'Diamond Badge',
    icon: '💎',
    cost: 3500,
    desc: 'The ultimate diamond profile badge.',
    themeClass: null
  },
  {
    id: 'legendary_bg',
    name: 'Legendary Background',
    icon: '🌌',
    cost: 5000,
    desc: 'An exclusive animated starfield background.',
    themeClass: 'theme-legendary'
  }
];

export function getRewardById(id) {
  return REWARDS.find(r => r.id === id) || null;
}

/**
 * Check which rewards are unlocked based on user's total XP.
 */
export function getUnlockedRewards(totalXP) {
  return REWARDS.filter(r => totalXP >= r.cost).map(r => r.id);
}

export function renderRewardsPage() {
  const container = document.getElementById('rewards-grid');
  if (!container) return;

  const user = getUser();
  const totalXP = user.totalXP || 0;
  const activeRewardId = localStorage.getItem('discipline_active_reward');

  container.innerHTML = REWARDS.map((r, i) => {
    const isUnlocked = totalXP >= r.cost;
    const isEquipped = activeRewardId === r.id;
    return `
      <div class="reward-card ${isUnlocked ? 'unlocked' : 'locked'} ${isEquipped ? 'equipped' : ''} slide-in-up"
           style="animation-delay:${i * 0.04}s"
           onclick="${isUnlocked ? `applyReward('${r.id}')` : ''}">
        <div class="reward-icon">${r.icon}</div>
        <div class="reward-name">${r.name}</div>
        <div style="font-size:12px;color:var(--text-2);text-align:center">${r.desc}</div>
        <div class="reward-cost">⭐ ${r.cost.toLocaleString()} XP</div>
        <div class="reward-status ${isEquipped ? 'equipped' : (isUnlocked ? 'unlocked' : 'locked')}">
          ${isEquipped ? '✨ Equipped' : (isUnlocked ? '✓ Tap to Equip' : `🔒 ${(r.cost - totalXP).toLocaleString()} XP needed`)}
        </div>
      </div>
    `;
  }).join('');

  // XP status at top
  const statusEl = document.getElementById('rewards-xp-status');
  if (statusEl) {
    const unlockedCount = REWARDS.filter(r => totalXP >= r.cost).length;
    statusEl.textContent = `You have ⭐ ${totalXP.toLocaleString()} XP — ${unlockedCount} / ${REWARDS.length} rewards unlocked`;
  }
}

// Apply a visual reward (theme)
export function applyReward(rewardId) {
  const reward = getRewardById(rewardId);
  if (!reward) return;

  const currentSaved = localStorage.getItem('discipline_active_reward');

  // Toggle off if already equipped
  if (currentSaved === rewardId) {
    REWARDS.forEach(r => { if (r.themeClass) document.documentElement.classList.remove(r.themeClass); });
    localStorage.removeItem('discipline_active_reward');
    showToast('Default theme restored', 'info');
    renderRewardsPage();
    if (window._renderDashboard) window._renderDashboard();
    return;
  }

  if (reward.themeClass) {
    REWARDS.forEach(r => { if (r.themeClass) document.documentElement.classList.remove(r.themeClass); });
    document.documentElement.classList.add(reward.themeClass);
    localStorage.setItem('discipline_active_reward', rewardId);
    showToast(`${reward.icon} ${reward.name} equipped!`, 'success');
  } else {
    showToast(`${reward.icon} ${reward.name} unlocked!`, 'achievement');
  }

  renderRewardsPage();
  if (window._renderDashboard) window._renderDashboard();
}

export function restoreActiveReward() {
  const saved = localStorage.getItem('discipline_active_reward');
  if (saved) {
    const reward = getRewardById(saved);
    if (reward && reward.themeClass) {
      document.documentElement.classList.add(reward.themeClass);
    }
  }
}
