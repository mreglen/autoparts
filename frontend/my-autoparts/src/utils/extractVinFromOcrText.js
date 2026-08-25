import {
  normalizeVinOrNull,
  sanitizeVinInput,
  VIN_MAX_LENGTH,
  VIN_MIN_LENGTH,
} from './laximoVin';
import { vinCheckDigitScoreBoost } from './vinCheckDigit';

/** Cyrillic lookalikes (RU docs) → Latin VIN letters */
const CYR_TO_LATIN = {
  А: 'A',
  В: 'B',
  Е: 'E',
  К: 'K',
  М: 'M',
  Н: 'H',
  О: 'O',
  Р: 'P',
  С: 'C',
  Т: 'T',
  У: 'Y',
  Х: 'X',
};

/** Common OCR confusions for VIN (I/O/Q are forbidden in real VIN). */
const OCR_CONFUSIONS = {
  0: ['O', 'Q', 'D'],
  1: ['I', 'L', 'T'],
  5: ['S'],
  8: ['B'],
  B: ['8'],
  D: ['0', 'O'],
  G: ['6'],
  I: ['1'],
  O: ['0', 'Q'],
  Q: ['0', 'O'],
  S: ['5'],
  Z: ['2'],
};

const VIN_CHARS = 'ABCDEFGHJKLMNPRSTUVWXYZ0123456789';
const VIN_LABEL_RE = /^(?:VIN|V\.I\.N\.?|WIN|W1N)\s*/i;

function normalizeOcrChar(ch) {
  if (!ch) return '';
  const upper = String(ch).toUpperCase();
  if (upper === 'O' || upper === 'О' || upper === 'Q') return '0';
  if (upper === 'I' || upper === '|' || upper === '!') return '1';
  if (VIN_CHARS.includes(upper)) return upper;
  if (upper === 'З') return '3';
  if (upper === 'Ч') return '4';
  return '';
}

function mapCyrillicLookalikes(text) {
  return String(text || '').replace(/[АВЕКМНОРСТУХ]/g, (ch) => CYR_TO_LATIN[ch] || ch);
}

function rewriteForbiddenVinChars(text) {
  return mapCyrillicLookalikes(String(text || ''))
    .toUpperCase()
    .replace(/[OОQ]/g, '0')
    .replace(/[I|!]/g, '1');
}

function fixOcrSequence(raw) {
  const chars = String(raw || '').toUpperCase().split('');
  return chars.map((ch, idx) => {
    const normalized = normalizeOcrChar(ch);
    if (normalized) return normalized;
    const options = OCR_CONFUSIONS[ch] || [];
    for (const opt of options) {
      const candidate = [...chars];
      candidate[idx] = opt;
      const attempt = sanitizeVinInput(candidate.join(''));
      if (normalizeVinOrNull(attempt)) return opt;
    }
    return '';
  }).join('');
}

function countOcrFixes(raw, normalized) {
  const rawChars = String(raw || '').toUpperCase().split('');
  const normChars = String(normalized || '').toUpperCase().split('');
  let fixes = 0;
  for (let i = 0; i < Math.min(rawChars.length, normChars.length); i += 1) {
    if (rawChars[i] !== normChars[i]) fixes += 1;
  }
  return fixes;
}

function buildCandidate(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const withoutLabel = rewriteForbiddenVinChars(trimmed.replace(VIN_LABEL_RE, ''));
  const sanitized = sanitizeVinInput(withoutLabel);
  const normalized = normalizeVinOrNull(sanitized);
  const fixed = fixOcrSequence(sanitized);
  const normalizedFixed = normalizeVinOrNull(fixed);

  const best = normalized || normalizedFixed;
  if (!best) return null;

  const raw = sanitized || fixed;
  const fixCount = countOcrFixes(raw, best);

  return {
    raw,
    normalized: best,
    length: best.length,
    fixCount,
    score: scoreCandidate(best, fixCount),
  };
}

function scoreCandidate(normalized, fixCount = 0) {
  let score = normalized.length === VIN_MAX_LENGTH ? 100 : normalized.length * 4;
  score += vinCheckDigitScoreBoost(normalized);
  score -= Math.min(fixCount, 8) * 2;
  return score;
}

function collectCandidates(text) {
  const found = new Map();
  const add = (value) => {
    const candidate = buildCandidate(value);
    if (!candidate) return;
    const existing = found.get(candidate.normalized);
    if (!existing || candidate.score > existing.score) {
      found.set(candidate.normalized, candidate);
    }
  };

  const stripped = String(text || '').replace(VIN_LABEL_RE, '');
  const upper = rewriteForbiddenVinChars(stripped);
  upper.split(/[^A-Z0-9]+/).forEach((token) => add(token));

  const compact = upper.replace(/[^A-Z0-9]/g, '');
  add(compact.replace(VIN_LABEL_RE, ''));

  for (let len = VIN_MAX_LENGTH; len >= VIN_MIN_LENGTH; len -= 1) {
    for (let i = 0; i <= compact.length - len; i += 1) {
      add(compact.slice(i, i + len));
    }
  }

  return [...found.values()];
}

function sortCandidates(candidates) {
  return [...candidates].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const lengthScoreA = a.length === VIN_MAX_LENGTH ? 100 : a.length * 4;
    const lengthScoreB = b.length === VIN_MAX_LENGTH ? 100 : b.length * 4;
    return lengthScoreB - lengthScoreA;
  });
}

/**
 * Find the best VIN-like substring in noisy OCR output.
 */
export function extractVinFromOcrText(text) {
  if (!text) return null;

  const candidates = sortCandidates(collectCandidates(text));
  if (!candidates.length) return null;

  const best = candidates[0];
  return {
    raw: best.raw,
    normalized: best.normalized,
    score: best.score,
    fixCount: best.fixCount,
  };
}

export function extractVinCandidatesFromOcrText(text) {
  if (!text) return [];
  return sortCandidates(collectCandidates(text));
}

/**
 * Pick best VIN from repeated frame readings using score + frequency.
 */
export function pickBestVinFromFrameReadings(readings) {
  const scores = new Map();
  for (const reading of readings || []) {
    const extracted = extractVinFromOcrText(reading);
    if (!extracted?.normalized) continue;
    const prev = scores.get(extracted.normalized) || { count: 0, score: extracted.score || 0 };
    scores.set(extracted.normalized, {
      count: prev.count + 1,
      score: Math.max(prev.score, extracted.score || 0),
    });
  }

  let bestVin = null;
  let bestCombined = -1;
  scores.forEach(({ count, score }, vin) => {
    const combined = score + count * 12;
    if (combined > bestCombined) {
      bestCombined = combined;
      bestVin = vin;
    }
  });

  return bestVin;
}
