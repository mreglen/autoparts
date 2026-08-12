import {
  normalizeVinOrNull,
  sanitizeVinInput,
  VIN_MAX_LENGTH,
  VIN_MIN_LENGTH,
} from './laximoVin';

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
  if (VIN_CHARS.includes(upper)) return upper;
  if (upper === 'О') return '0'; // Cyrillic O
  if (upper === 'З') return '3';
  if (upper === 'Ч') return '4';
  return '';
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

function buildCandidate(value) {
  const trimmed = String(value || '').trim();
  if (!trimmed) return null;

  const withoutLabel = trimmed.replace(VIN_LABEL_RE, '');
  const sanitized = sanitizeVinInput(withoutLabel);
  const normalized = normalizeVinOrNull(sanitized);
  const fixed = fixOcrSequence(sanitized);
  const normalizedFixed = normalizeVinOrNull(fixed);

  const best = normalized || normalizedFixed;
  if (!best) return null;

  return {
    raw: sanitized || fixed,
    normalized: best,
    length: best.length,
  };
}

function collectCandidates(text) {
  const found = new Map();
  const add = (value) => {
    const candidate = buildCandidate(value);
    if (!candidate) return;
    found.set(candidate.normalized, candidate);
  };

  const upper = String(text || '').toUpperCase();
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

/**
 * Find the best VIN-like substring in noisy OCR output.
 * Prefers exact valid 17-char matches.
 */
export function extractVinFromOcrText(text) {
  if (!text) return null;

  const candidates = collectCandidates(text);
  if (!candidates.length) return null;

  candidates.sort((a, b) => {
    const lengthScoreA = a.length === VIN_MAX_LENGTH ? 100 : a.length * 4;
    const lengthScoreB = b.length === VIN_MAX_LENGTH ? 100 : b.length * 4;
    return lengthScoreB - lengthScoreA;
  });

  const best = candidates[0];
  return {
    raw: best.raw,
    normalized: best.normalized,
  };
}
