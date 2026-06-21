export const INTERNAL_CODE_LABEL = 'Код товара';

export function normalizeInternalCodeForSearch(code) {
  if (code == null || code === '') return '';
  if (typeof code === 'object') {
    return String(code.code || code.id || '');
  }
  return String(code);
}

export function formatInternalCodeDisplay(code) {
  const normalized = normalizeInternalCodeForSearch(code).trim();
  return normalized || '—';
}
