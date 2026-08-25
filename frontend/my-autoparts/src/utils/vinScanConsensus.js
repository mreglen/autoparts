import { VIN_MAX_LENGTH, VIN_MIN_LENGTH } from './laximoVin';

const DEFAULT_HISTORY_SIZE = 7;
const MIN_FRAMES_FULL = 2;
const MIN_FRAMES_SHORT = 4;
const MIN_CHAR_RATIO_FULL = 0.68;
const MIN_CHAR_RATIO_SHORT = 0.78;

function charVote(readings, index) {
  const counts = new Map();
  for (const reading of readings) {
    if (index >= reading.length) continue;
    const ch = reading[index];
    counts.set(ch, (counts.get(ch) || 0) + 1);
  }
  let bestChar = '';
  let bestCount = 0;
  counts.forEach((count, ch) => {
    if (count > bestCount) {
      bestChar = ch;
      bestCount = count;
    }
  });
  return { char: bestChar, count: bestCount, total: readings.length };
}

function buildConsensusForLength(readings, targetLength) {
  const sameLength = readings.filter((r) => r.length === targetLength);
  if (sameLength.length < (targetLength === VIN_MAX_LENGTH ? MIN_FRAMES_FULL : MIN_FRAMES_SHORT)) {
    return null;
  }

  const minRatio = targetLength === VIN_MAX_LENGTH ? MIN_CHAR_RATIO_FULL : MIN_CHAR_RATIO_SHORT;
  const chars = [];
  for (let i = 0; i < targetLength; i += 1) {
    const vote = charVote(sameLength, i);
    if (!vote.char || vote.count / vote.total < minRatio) {
      return null;
    }
    chars.push(vote.char);
  }
  return chars.join('');
}

export class VinScanConsensus {
  constructor(maxSize = DEFAULT_HISTORY_SIZE) {
    this.maxSize = maxSize;
    this.readings = [];
  }

  reset() {
    this.readings = [];
  }

  add(vin) {
    const text = String(vin || '').toUpperCase().trim();
    if (text.length < VIN_MIN_LENGTH || text.length > VIN_MAX_LENGTH) {
      return null;
    }
    this.readings.push(text);
    if (this.readings.length > this.maxSize) {
      this.readings.shift();
    }
    return this.getConsensus();
  }

  getConsensus() {
    if (!this.readings.length) return null;

    const full = buildConsensusForLength(this.readings, VIN_MAX_LENGTH);
    if (full) return full;

    const lengths = [...new Set(this.readings.map((r) => r.length))].sort((a, b) => b - a);
    for (const len of lengths) {
      if (len === VIN_MAX_LENGTH) continue;
      const consensus = buildConsensusForLength(this.readings, len);
      if (consensus) return consensus;
    }
    return null;
  }

  getProgress() {
    if (!this.readings.length) return 0;

    const targetLength = this.readings.some((r) => r.length === VIN_MAX_LENGTH)
      ? VIN_MAX_LENGTH
      : Math.max(...this.readings.map((r) => r.length));
    const sameLength = this.readings.filter((r) => r.length === targetLength);
    const minFrames = targetLength === VIN_MAX_LENGTH ? MIN_FRAMES_FULL : MIN_FRAMES_SHORT;
    const frameProgress = Math.min(1, sameLength.length / minFrames);

    if (!sameLength.length) return frameProgress * 0.3;

    let charMatches = 0;
    for (let i = 0; i < targetLength; i += 1) {
      const vote = charVote(sameLength, i);
      const minRatio = targetLength === VIN_MAX_LENGTH ? MIN_CHAR_RATIO_FULL : MIN_CHAR_RATIO_SHORT;
      if (vote.count / vote.total >= minRatio) charMatches += 1;
    }

    const charProgress = charMatches / targetLength;
    return Math.min(1, frameProgress * 0.45 + charProgress * 0.55);
  }
}

export function consensusProgressLabel(progress) {
  if (progress <= 0) return 'Держите VIN в рамке — считаем автоматически';
  if (progress < 0.35) return 'Читаем…';
  if (progress < 0.7) return 'Почти готово…';
  return 'Проверяем результат…';
}
