/**
 * Post-build: inject hashed CRA assets into service-worker precache list.
 */
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const buildDir = path.join(root, 'build');
const manifestPath = path.join(buildDir, 'asset-manifest.json');
const swSrc = path.join(root, 'public', 'service-worker.js');
const swDest = path.join(buildDir, 'service-worker.js');

if (!fs.existsSync(buildDir) || !fs.existsSync(manifestPath)) {
  console.error('[inject-sw-precache] build/asset-manifest.json not found — run after react-scripts build');
  process.exit(1);
}

const assetManifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const fromFiles = Object.values(assetManifest.files || {})
  .filter(Boolean)
  .map((entry) => (entry.startsWith('/') ? entry : `/${entry}`));

const stable = [
  '/',
  '/index.html',
  '/offline.html',
  '/manifest.json',
  '/favicons/android-chrome-192x192.png',
  '/favicons/android-chrome-512x512.png',
  '/img/LogoWithoutBg.png',
];

const precache = [...new Set([...stable, ...fromFiles])];

let sw = fs.readFileSync(swSrc, 'utf8');
const marker = /\/\*__PRECACHE__\*\/\[[\s\S]*?\]/;
if (!marker.test(sw)) {
  console.error('[inject-sw-precache] PRECACHE marker not found in service-worker.js');
  process.exit(1);
}
sw = sw.replace(marker, `/*__PRECACHE__*/${JSON.stringify(precache)}`);

fs.writeFileSync(swDest, sw);
console.log(`[inject-sw-precache] Wrote ${precache.length} URLs to build/service-worker.js`);
