// ============================================================
// xp.js — XP award system and level progression
// ============================================================

import { getUser, saveUser, addXPEntry } from './data.js';

export const LEVELS = [
  { level: 1,  name: 'Beginner',    xpRequired: 0,    color: '#9CA3AF' },
  { level: 2,  name: 'Starter',     xpRequired: 150,  color: '#60A5FA' },
  { level: 3,  name: 'Consistent',  xpRequired: 350,  color: '#34D399' },
  { level: 4,  name: 'Focused',     xpRequired: 650,  color: '#A78BFA' },
  { level: 5,  name: 'Disciplined', xpRequired: 1050, color: '#F472B6' },
  { level: 6,  name: 'Determined',  xpRequired: 1600, color: '#FB923C' },
  { level: 7,  name: 'Strong',      xpRequired: 2300, color: '#FBBF24' },
  { level: 8,  name: 'Elite',       xpRequired: 3200, color: '#F97316' },
  { level: 9,  name: 'Master',      xpRequired: 4400, color: '#EF4444' },
  { level: 10, name: 'Legendary',   xpRequired: 6000, color: '#7C6FF7' }
];

export function getLevelInfo(totalXP) {
  let current = LEVELS[0];
  let next = LEVELS[1];

  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (totalXP >= LEVELS[i].xpRequired) {
      current = LEVELS[i];
      next = LEVELS[i + 1] || null;
      break;
    }
  }

  const xpIntoLevel = totalXP - current.xpRequired;
  const xpForLevel  = next ? next.xpRequired - current.xpRequired : 1;
  const progress    = next ? Math.min((xpIntoLevel / xpForLevel) * 100, 100) : 100;
  const xpToNext    = next ? next.xpRequired - totalXP : 0;

  return {
    level:        current.level,
    name:         current.name,
    color:        current.color,
    totalXP,
    xpIntoLevel,
    xpForLevel,
    xpToNext,
    progress,
    isMaxLevel:   !next,
    nextLevelName: next?.name || null
  };
}

export function getXPForDifficulty(difficulty) {
  return { easy: 10, medium: 20, hard: 30 }[difficulty] || 20;
}

/**
 * Award XP to the current user.
 * @param {number} amount
 * @param {string} source
 * @returns {{ levelInfo, leveledUp, oldLevel, newLevel }}
 */
export function awardXP(amount, source) {
  const user = getUser();
  const oldLevelInfo = getLevelInfo(user.totalXP);
  user.totalXP = (user.totalXP || 0) + amount;
  const newLevelInfo = getLevelInfo(user.totalXP);
  user.level = newLevelInfo.level;
  saveUser(user);
  addXPEntry(amount, source);
  return {
    levelInfo: newLevelInfo,
    leveledUp: newLevelInfo.level > oldLevelInfo.level,
    oldLevel: oldLevelInfo.level,
    newLevel: newLevelInfo.level
  };
}

export function getCurrentLevelInfo() {
  return getLevelInfo(getUser().totalXP);
}

// XP Bonuses
export const XP_BONUSES = {
  PERFECT_DAY: 50,
  STREAK_7:    100,
  STREAK_30:   500,
  STREAK_100:  2000,
  FIRST_HABIT: 20
};
