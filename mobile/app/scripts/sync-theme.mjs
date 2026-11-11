#!/usr/bin/env node
// Генерирует src/theme/tokens.ts из конфига Tailwind веб-фронтенда: мобильный клиент
// берёт цвета и типографику из того же источника, что и сайт (правило паритета PLAN §1.6).
// 1rem в React Native нет, поэтому rem переводим в px по базовому размеру Tailwind — 16px.

import { createRequire } from 'node:module';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);
const appRoot = path.resolve(import.meta.dirname, '..');
const webConfigPath = path.resolve(appRoot, '../../frontend/my-autoparts/tailwind.config.js');
const outFile = path.join(appRoot, 'src/theme/tokens.ts');

const REM_PX = 16;

function toPx(value, { emBase, lineBase } = {}) {
  const raw = String(value).trim();
  const rem = /^(-?[\d.]+)rem$/.exec(raw);
  if (rem) return round(Number(rem[1]) * REM_PX);
  const em = /^(-?[\d.]+)em$/.exec(raw);
  if (em && emBase !== undefined) return round(Number(em[1]) * emBase);
  const px = /^(-?[\d.]+)px$/.exec(raw);
  if (px) return round(Number(px[1]));
  const num = parseFloat(raw);
  if (!Number.isFinite(num)) return null;
  // Безразмерный line-height в CSS — множитель; в React Native lineHeight задаётся в px.
  if (lineBase !== undefined && num > 0 && num < 8) return round(num * lineBase);
  return round(num);
}

function round(value) {
  return Math.round(value * 100) / 100;
}

function quote(text) {
  return `'${text}'`;
}

function renderColors(colors) {
  const lines = ['export const palette = {'];
  for (const [name, variants] of Object.entries(colors)) {
    if (typeof variants === 'string') {
      lines.push(`  ${key(name)}: ${quote(variants)},`);
      continue;
    }
    lines.push(`  ${key(name)}: {`);
    for (const [variant, hex] of Object.entries(variants)) {
      lines.push(`    ${key(variant)}: ${quote(hex)},`);
    }
    lines.push('  },');
  }
  lines.push('} as const;');
  return lines.join('\n');
}

function key(name) {
  return /^\d/.test(name) ? `'${name}'` : name;
}

function renderTypography(fontSize) {
  const scale = [];
  const blocks = ['export const typography = {'];
  for (const [name, definition] of Object.entries(fontSize)) {
    const [size, options = {}] = Array.isArray(definition) ? definition : [definition, {}];
    const token = name.replace(/^sg-/, '').replace(/-/g, '_');
    const sizePx = toPx(size);
    scale.push(`  ${key(token)}: ${sizePx},`);
    blocks.push(`  ${key(token)}: {`);
    blocks.push(`    fontSize: ${sizePx},`);
    if (options.lineHeight) {
      blocks.push(`    lineHeight: ${toPx(options.lineHeight, { lineBase: sizePx })},`);
    }
    if (options.letterSpacing) {
      blocks.push(`    letterSpacing: ${toPx(options.letterSpacing, { emBase: sizePx })},`);
    }
    if (options.fontWeight) blocks.push(`    fontWeight: ${quote(options.fontWeight)},`);
    blocks.push('  },');
  }
  blocks.push('} as const;');
  const scaleBlock = [
    '/** Шкала размеров текста в px: text-sg-* из веб-конфига. */',
    'export const fontSizePx = {',
    ...scale,
    '} as const;',
  ].join('\n');
  return [scaleBlock, blocks.join('\n')].join('\n\n');
}

function renderRadius(borderRadius) {
  const lines = ['export const radius = {'];
  for (const [name, value] of Object.entries(borderRadius)) {
    const px = toPx(value);
    if (px === null) continue;
    lines.push(`  ${key(name.replace(/^sg-?/, '') || 'base')}: ${px},`);
  }
  lines.push('} as const;');
  return lines.join('\n');
}

const web = require(webConfigPath);
const extend = web.theme?.extend ?? {};

const body = [
  '// Этот файл сгенерирован scripts/sync-theme.mjs — не правьте вручную.',
  `// Источник: ${path.relative(appRoot, webConfigPath).replace(/\\/g, '/')}`,
  '',
  renderColors(extend.colors ?? {}),
  '',
  renderTypography(extend.fontSize ?? {}),
  '',
  renderRadius(extend.borderRadius ?? {}),
  '',
].join('\n');

const next = `${body}\n`;

if (process.argv.includes('--check')) {
  const current = (() => {
    try {
      return readFileSync(outFile, 'utf8');
    } catch {
      return '';
    }
  })();
  if (current !== next) {
    console.error('src/theme/tokens.ts устарел: выполните npm run theme:sync');
    process.exit(1);
  }
  console.log('src/theme/tokens.ts актуален');
  process.exit(0);
}

mkdirSync(path.dirname(outFile), { recursive: true });
writeFileSync(outFile, next, 'utf8');
console.log(`Записан ${path.relative(appRoot, outFile)}`);
