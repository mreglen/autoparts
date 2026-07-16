/**
 * URL для QR на этикетке.
 * Стабильный путь по внутреннему коду — работает и до, и после модерации.
 */
import { formatInternalCodeDisplay, normalizeInternalCodeForSearch } from './internalCode';

export function getLabelQrPath(part) {
  const code = normalizeInternalCodeForSearch(part?.internal_code).trim();
  if (code && code !== '—') {
    return `/qr/label/${encodeURIComponent(code.toUpperCase())}`;
  }

  if (!part?.id) return '';

  // Fallback for rare cases without internal_code
  if (part.moderationKind === 'pending') {
    return `/my-parts/edit-pending/${part.id}`;
  }
  if (part.moderationKind === 'rejected') {
    return `/my-parts/resubmit/${part.id}`;
  }
  return `/seller/part-card/${part.id}`;
}

export function getLabelQrUrl(part, origin) {
  const path = getLabelQrPath(part);
  if (!path) return '';
  const base = (origin || (typeof window !== 'undefined' && window.location?.origin) || '').replace(/\/$/, '');
  return base ? `${base}${path}` : path;
}

/** Для печати: явно помечаем тип позиции, чтобы не перепутать с модерацией. */
export function partForLabelPrint(part, { moderationKind } = {}) {
  if (!part) return part;
  if (moderationKind === 'pending' || moderationKind === 'rejected') {
    return { ...part, moderationKind };
  }
  const { moderationKind: _drop, ...rest } = part;
  return rest;
}

export function labelQrPreviewCode(part) {
  return formatInternalCodeDisplay(part?.internal_code);
}
