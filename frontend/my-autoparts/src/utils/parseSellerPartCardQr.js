/**
 * Parse QR payload from warehouse labels into an in-app route.
 * Supports full URLs and relative paths for /seller/part-card/{id}.
 */

function normalizeQrPath(path) {
  let normalized = (path || '').trim();
  if (!normalized) return '';
  if (!normalized.startsWith('/')) {
    normalized = `/${normalized}`;
  }
  if (normalized === '/server' || normalized.startsWith('/server/')) {
    normalized = normalized.slice('/server'.length) || '/';
    if (!normalized.startsWith('/')) {
      normalized = `/${normalized}`;
    }
  }
  return normalized;
}

export function parseSellerPartCardQr(text) {
  const raw = (text || '').trim();
  if (!raw) return null;

  let path = raw;
  if (/^https?:\/\//i.test(raw)) {
    try {
      path = new URL(raw).pathname;
    } catch {
      return null;
    }
  }

  path = normalizeQrPath(path);

  const labelCodeMatch = path.match(/\/qr\/label\/([^/?#]+)/i);
  if (labelCodeMatch) {
    const internalCode = decodeURIComponent(labelCodeMatch[1]).trim();
    return {
      type: 'label-code',
      internalCode,
      path: `/qr/label/${encodeURIComponent(internalCode)}`,
    };
  }

  const partCardMatch = path.match(/\/seller\/part-card\/(\d+)/i);
  if (partCardMatch) {
    return {
      type: 'part-card',
      productId: parseInt(partCardMatch[1], 10),
      path: `/seller/part-card/${partCardMatch[1]}`,
    };
  }

  const pendingMatch = path.match(/\/my-parts\/edit-pending\/(\d+)/i);
  if (pendingMatch) {
    return {
      type: 'edit-pending',
      id: parseInt(pendingMatch[1], 10),
      path: `/my-parts/edit-pending/${pendingMatch[1]}`,
    };
  }

  const resubmitMatch = path.match(/\/my-parts\/resubmit\/(\d+)/i);
  if (resubmitMatch) {
    return {
      type: 'resubmit',
      id: parseInt(resubmitMatch[1], 10),
      path: `/my-parts/resubmit/${resubmitMatch[1]}`,
    };
  }

  const publicPartMatch = path.match(/^\/part\/(\d+)(?:-|$)/i);
  if (publicPartMatch) {
    const productId = parseInt(publicPartMatch[1], 10);
    return {
      type: 'public-part',
      productId,
      path,
    };
  }

  if (/^\d+$/.test(raw)) {
    const productId = parseInt(raw, 10);
    return { type: 'part-card', productId, path: `/seller/part-card/${productId}` };
  }

  return null;
}
