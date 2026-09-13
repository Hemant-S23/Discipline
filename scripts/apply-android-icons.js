/**
 * scripts/apply-android-icons.js
 * Copies custom transparent launcher icons from icons/android/ into android/app/src/main/res/
 * Run with: node scripts/apply-android-icons.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC  = path.join(ROOT, 'icons', 'android');
const DEST = path.join(ROOT, 'android', 'app', 'src', 'main', 'res');

function copyDirRecursive(src, dest) {
  if (!fs.existsSync(src)) return;
  if (!fs.existsSync(dest)) fs.mkdirSync(dest, { recursive: true });

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirRecursive(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
      console.log(`[ICON] Copied -> ${path.relative(DEST, destPath)}`);
    }
  }
}

if (!fs.existsSync(DEST)) {
  console.log(`[NOTICE] Android res directory not found at ${DEST}. Skipping copy.`);
  process.exit(0);
}

console.log(`Applying custom Discipline transparent icons to Android project...`);
copyDirRecursive(SRC, DEST);
console.log(`[SUCCESS] Custom Android launcher icons applied!`);
