/**
 * Server datetimes are stored/sent as UTC, often without a trailing "Z".
 * Browsers treat naive ISO strings as local time — which shifts the clock
 * (e.g. EKB UTC+5 shows 05:15 instead of 10:15). Append Z for naive values.
 */
export function parseServerDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  if (/[zZ]$|[+-]\d{2}:?\d{2}$/.test(raw)) {
    const d = new Date(raw);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const normalized = raw.includes('T') ? raw : raw.replace(' ', 'T');
  const d = new Date(`${normalized}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateInputValue(value) {
  if (value == null || value === '') return '';
  const raw = String(value).trim();
  const dateOnly = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly)) {
    return dateOnly;
  }
  const d = parseServerDate(value);
  if (!d) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseWallClockDate(value) {
  if (value == null || value === '') return null;
  if (value instanceof Date) return value;

  const raw = String(value).trim();
  if (!raw) return null;

  const naive = raw.replace(' ', 'T').replace(/([zZ]|[+-]\d{2}:?\d{2})$/, '');
  const d = new Date(naive.length === 10 ? `${naive}T00:00:00` : naive);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatDateTimeValue(d, fallback, options) {
  if (!d) {
    if (!fallback) return '—';
    const parts = String(fallback).slice(0, 10).split('-');
    if (parts.length === 3 && parts[0].length === 4) {
      return `${parts[2]}.${parts[1]}.${parts[0]}`;
    }
    return String(fallback);
  }

  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...options,
  });
}

export function formatServerDateTime(value, options = {}) {
  return formatDateTimeValue(parseServerDate(value), value, options);
}

export function formatWallClockDateTime(value, options = {}) {
  return formatDateTimeValue(parseWallClockDate(value), value, options);
}

export function formatServerDate(value) {
  if (!value) return '—';
  const raw = String(value).trim();
  // Date-only (preferred_date etc.) — no timezone shift
  const dateOnly = raw.slice(0, 10);
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateOnly) && (raw.length === 10 || raw[10] === 'T' || raw[10] === ' ')) {
    const parts = dateOnly.split('-');
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }

  const d = parseServerDate(value);
  if (!d) return raw;

  return d.toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
