/**
 * URL для QR на этикетке.
 * Всегда стабильный /qr/label/{INTERNAL_CODE} — работает и на модерации, и после одобрения.
 * Legacy edit-pending на уже напечатанных этикетках резолвится на бэкенде через label_qr_links.
 */
import { formatInternalCodeDisplay, normalizeInternalCodeForSearch } from './internalCode';

export function getLabelQrPath(part) {
  const code = normalizeInternalCodeForSearch(part?.internal_code).trim();
  if (code && code !== '—') {
    return `/qr/label/${encodeURIComponent(code.toUpperCase())}`;
  }
  // Без внутреннего кода этикетка с рабочим QR невозможна — не печатаем битый edit-pending.
  return '';
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
