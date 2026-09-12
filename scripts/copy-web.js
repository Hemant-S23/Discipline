/**
 * scripts/copy-web.js
 * Copies all web source files into the www/ directory for Capacitor to bundle.
 * Run with: node scripts/copy-web.js
 */

const fs   = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DEST = path.join(ROOT, 'www');

// Folders and files to copy from project root → www/
const COPY_DIRS  = ['css', 'js', 'icons'];
const COPY_FILES = ['index.html', 'manifest.json', 'sw.js', 'favicon.ico', 'favicon.svg'];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyDir(src, dest) {
  ensureDir(dest);
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath  = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// Clean & recreate www/
if (fs.existsSync(DEST)) {
  fs.rmSync(DEST, { recursive: true, force: true });
}
ensureDir(DEST);

// Copy directories
for (const dir of COPY_DIRS) {
  const srcDir = path.join(ROOT, dir);
  if (fs.existsSync(srcDir)) {
    copyDir(srcDir, path.join(DEST, dir));
    console.log(`✓ Copied ${dir}/`);
  }
}

// Copy root files
for (const file of COPY_FILES) {
  const srcFile = path.join(ROOT, file);
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, path.join(DEST, file));
    console.log(`✓ Copied ${file}`);
  }
}

console.log('\n✅ Web assets copied to www/ successfully!');
