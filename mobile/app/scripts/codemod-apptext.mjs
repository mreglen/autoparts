// Разовая миграция: Text/TextInput из "react-native" -> AppText/AppTextInput.
// Запуск: node scripts/codemod-apptext.mjs [--check]
import { readdirSync, readFileSync, writeFileSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");
const SRC = path.join(ROOT, "src");
const CHECK = process.argv.includes("--check");

function* walk(dir) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) yield* walk(p);
    else if (/\.(ts|tsx)$/.test(name)) yield p;
  }
}

const files = [
  ...walk(SRC),
  path.join(ROOT, "App.tsx"),
  path.join(ROOT, "index.ts"),
].filter((f) => {
  try {
    return statSync(f).isFile();
  } catch {
    return false;
  }
});

// Парсит именованные импорты из "react-native"; возвращает
// { specifiers, hasText, hasTextInput, aliases }.
function parseRNImport(src) {
  const re = /import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*["']react-native["'];?/g;
  const matches = [...src.matchAll(re)];
  if (!matches.length) return null;
  // Берём только первый react-native import (обычно он один).
  const m = matches[0];
  const inner = m[1];
  const specifiers = inner
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  const wanted = { Text: null, TextInput: null };
  const keep = [];
  for (const spec of specifiers) {
    if (spec.startsWith("type ")) {
      keep.push(spec);
      continue;
    }
    const asMatch = /^([A-Za-z0-9_$]+)(?:\s+as\s+([A-Za-z0-9_$]+))?$/.exec(spec);
    if (!asMatch) {
      keep.push(spec);
      continue;
    }
    const [, imported, alias] = asMatch;
    if (imported === "Text" || imported === "TextInput") {
      wanted[imported] = alias ?? imported;
    } else {
      keep.push(spec);
    }
  }
  return { match: m, specifiers, keep, wanted };
}

function relImport(fromFile, toFileNoExt) {
  let rel = path
    .relative(path.dirname(fromFile), toFileNoExt)
    .replace(/\\/g, "/");
  if (!rel.startsWith(".")) rel = "./" + rel;
  return rel;
}

let changed = 0;
for (const file of files) {
  if (file.endsWith(path.join("components", "ui", "AppText.tsx"))) continue;
  const src = readFileSync(file, "utf8");
  const parsed = parseRNImport(src);
  if (!parsed) continue;
  const { Text: textAlias, TextInput: inputAlias } = parsed.wanted;
  if (!textAlias && !inputAlias) continue;

  // 1) Убираем Text/TextInput из react-native импорта.
  let next = src;
  const { match, keep } = parsed;
  const isTypeOnly = /^import\s+type/.test(match[0]);
  let replacement;
  if (keep.length === 0 && !isTypeOnly) {
    // Импорт целиком был только ради Text/TextInput — удаляем строку.
    replacement = "";
  } else {
    const keyword = isTypeOnly ? "import type" : "import";
    replacement = `${keyword} { ${keep.join(", ")} } from "react-native";`;
  }
  next = next.slice(0, match.index) + replacement + next.slice(match.index + match[0].length);
  next = next.replace(/\n{3,}/g, "\n\n");

  // 2) Добавляем импорт AppText/AppTextInput.
  const target = path.join(SRC, "components", "ui", "AppText");
  const imp = relImport(file, target);
  const names = [];
  if (textAlias) names.push(`AppText as ${textAlias}`);
  if (inputAlias) names.push(`AppTextInput as ${inputAlias}`);
  const importLine = `import { ${names.join(", ")} } from "${imp}";`;

  // Вставляем после последнего import- statement в начале файла.
  const importRe = /^import[^\n]*(?:\n(?!import)[^\n]*)*$/gm;
  // Проще: найти позицию конца последнего импорта в "шапке".
  const lines = next.split("\n");
  let lastImportEnd = -1;
  let inImport = false;
  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    if (/^import\s/.test(l)) {
      inImport = true;
      // однострочный импорт?
      if (/from\s+["'][^"']+["'];?\s*$/.test(l) || /["'];?\s*$/.test(l)) {
        // может быть многострочный — проверим скобки
        const open = (l.match(/\{/g) || []).length;
        const close = (l.match(/\}/g) || []).length;
        if (open <= close) {
          lastImportEnd = i;
          inImport = false;
        }
      }
    } else if (inImport) {
      if (/\}/.test(l) && /from\s/.test(l)) {
        lastImportEnd = i;
        inImport = false;
      }
    } else if (l.trim() === "" || l.startsWith("//") || l.startsWith("/*")) {
      // пропускаем
    } else {
      break;
    }
  }
  if (lastImportEnd === -1) {
    // fallback: перед первым не-import кодом
    console.error(`WARN: не нашёл место для импорта: ${file}`);
    continue;
  }
  lines.splice(lastImportEnd + 1, 0, importLine);
  next = lines.join("\n");

  if (CHECK) {
    console.log(`CHECK would change: ${path.relative(ROOT, file)}`);
  } else {
    writeFileSync(file, next, "utf8");
    console.log(`updated: ${path.relative(ROOT, file)}`);
  }
  changed++;
}
console.log(`done, files: ${changed}`);
