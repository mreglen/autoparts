/**
 * URL для QR на этикетке.
 * — pending: редактирование на модерации
 * — rejected: повторная отправка
 * — иначе: карточка складского товара продавца
 */
export function getLabelQrPath(part) {
  if (!part?.id) return '';

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
