/**
 * Post-build: generate planner.html — copy of index.html with the planner
 * manifest link baked into the markup. Nginx serves it for
 * /autoservice/planner so installing a PWA from that page always uses
 * manifest-planner.json (start_url=/autoservice/planner), not manifest.json.
 */
const fs = require('fs');
const path = require('path');

const buildDir = path.join(__dirname, '..', 'build');
const indexSrc = path.join(buildDir, 'index.html');
const plannerDest = path.join(buildDir, 'planner.html');

let html = fs.readFileSync(indexSrc, 'utf8');

const manifestLink = '<link id="manifest-link" rel="manifest" href="/manifest.json" />';
if (!html.includes(manifestLink)) {
  console.error('[build-planner-html] manifest link not found in index.html');
  process.exit(1);
}
html = html.replace(manifestLink, '<link id="manifest-link" rel="manifest" href="/manifest-planner.json" />');
html = html.replace('<title>Свой Гараж</title>', '<title>Планировщик — Свой Гараж</title>');
html = html.replace(
  '<meta name="apple-mobile-web-app-title" content="Свой Гараж" />',
  '<meta name="apple-mobile-web-app-title" content="Планировщик" />',
);

fs.writeFileSync(plannerDest, html);
console.log('[build-planner-html] Wrote build/planner.html');
