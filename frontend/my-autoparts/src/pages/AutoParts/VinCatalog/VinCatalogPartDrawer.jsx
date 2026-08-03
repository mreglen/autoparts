import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { buildNewPartOpenPath, buildPartDetailPath } from '../../../utils/partRoutes';
import {
  getRosskoMinPrice,
  getRosskoParts,
  normalizeArticle,
  roundRosskoSalePrice,
} from '../NewParts/rosskoHelpers';

const CLOSE_ANIMATION_MS = 200;

function productImage(p) {
  if (!p) return null;
  if (p.main_photo) return p.main_photo;
  if (p.image) return p.image;
  if (p.photo) return p.photo;
  const photos = p.photos;
  if (Array.isArray(photos) && photos.length) {
    const first = photos[0];
    if (typeof first === 'string') return first;
    return (
      first?.list_photo_url ||
      first?.thumb_url ||
      first?.full_url ||
      first?.photo_url ||
      first?.url ||
      first?.image ||
      null
    );
  }
  return null;
}

function formatPrice(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n.toLocaleString('ru-RU', { maximumFractionDigits: 0 });
}

function OfferSkeleton({ rows = 4 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-100 px-3 py-3">
          <div className="h-3 w-24 rounded bg-gray-100" />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="h-3 w-32 rounded bg-gray-100" />
            <div className="h-3 w-16 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function UsedSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="animate-pulse overflow-hidden rounded-lg border border-gray-100">
          <div className="aspect-square bg-gray-100" />
          <div className="space-y-2 p-2">
            <div className="h-3 w-full rounded bg-gray-100" />
            <div className="h-3 w-1/2 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function isExactOemMatch(part, oemNorm) {
  if (!oemNorm) return false;
  const pn = normalizeArticle(part?.partnumber || part?.article);
  if (!pn) return false;
  return pn === oemNorm || pn.includes(oemNorm) || oemNorm.includes(pn);
}

export default function VinCatalogPartDrawer({ detail, onClose, loadUsedProducts }) {
  const open = Boolean(detail);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [rosskoLoading, setRosskoLoading] = useState(false);
  const [usedLoading, setUsedLoading] = useState(false);
  const [similarParts, setSimilarParts] = useState([]);
  const [analogParts, setAnalogParts] = useState([]);
  const [usedItems, setUsedItems] = useState([]);

  const oem = detail?.oem || '';
  const oemNorm = normalizeArticle(oem);

  const requestClose = useCallback(() => {
    onClose();
  }, [onClose]);

  useEffect(() => {
    if (open) {
      setIsVisible(true);
      setIsClosing(false);
      return undefined;
    }
    if (!isVisible) return undefined;
    setIsClosing(true);
    const timer = window.setTimeout(() => {
      setIsClosing(false);
      setIsVisible(false);
    }, CLOSE_ANIMATION_MS);
    return () => window.clearTimeout(timer);
  }, [open, isVisible]);

  useEffect(() => {
    if (!isVisible) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') requestClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener('keydown', onKey);
    };
  }, [isVisible, requestClose]);

  useEffect(() => {
    setSimilarParts([]);
    setAnalogParts([]);
    setUsedItems([]);
  }, [detail?.oem, detail?.detail_id]);

  useEffect(() => {
    if (!open || !oem) return undefined;
    let cancelled = false;
    setRosskoLoading(true);
    (async () => {
      try {
        const response = await apiAxiosUnauth.post('/rossko/GetSearch', {
          text: oem,
          delivery_id: '000000001',
          address_id: 176458,
        });
        if (cancelled) return;
        const parts = getRosskoParts(response?.data || response);
        const similar = [];
        const analogs = [];
        parts.forEach((part) => {
          if (isExactOemMatch(part, oemNorm)) similar.push(part);
          else analogs.push(part);
        });
        setSimilarParts(similar);
        setAnalogParts(analogs);
      } catch {
        if (!cancelled) {
          setSimilarParts([]);
          setAnalogParts([]);
        }
      } finally {
        if (!cancelled) setRosskoLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, oem, oemNorm]);

  useEffect(() => {
    if (!open || !oem || !loadUsedProducts) return undefined;
    let cancelled = false;
    setUsedLoading(true);
    (async () => {
      try {
        const items = await loadUsedProducts(oem);
        if (!cancelled) setUsedItems(Array.isArray(items) ? items : []);
      } catch {
        if (!cancelled) setUsedItems([]);
      } finally {
        if (!cancelled) setUsedLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, oem, loadUsedProducts]);

  if (!isVisible) return null;

  const renderRosskoRow = (part, idx) => {
    const brand = part?.brand || part?.manufacturer || '';
    const article = part?.partnumber || part?.article || '';
    const rawPrice = getRosskoMinPrice(part);
    const price = rawPrice > 0 ? roundRosskoSalePrice(rawPrice) : null;
    const href = buildNewPartOpenPath({ brand, article });
    return (
      <a
        key={`${brand}-${article}-${idx}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2.5 transition hover:border-indigo-300 hover:bg-indigo-50/40"
      >
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">{brand || '—'}</p>
          <p className="mt-0.5 truncate font-mono text-xs text-indigo-700">{article || '—'}</p>
        </div>
        <div className="shrink-0 text-right">
          {price != null ? (
            <p className="text-sm font-semibold text-gray-900">{formatPrice(price)} ₽</p>
          ) : (
            <p className="text-xs text-gray-400">—</p>
          )}
        </div>
      </a>
    );
  };

  const body = (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Закрыть"
        className={`absolute inset-0 bg-black/45 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={requestClose}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col bg-white shadow-2xl sm:max-w-lg ${
          isClosing ? 'animate-slide-out-right' : 'animate-slide-in-right'
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">{detail?.name || 'Деталь'}</h3>
            {oem ? <p className="mt-0.5 font-mono text-sm text-indigo-700">{oem}</p> : null}
          </div>
          <button
            type="button"
            onClick={requestClose}
            className="rounded-lg p-1.5 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-4 py-4">
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Схожие</h4>
            {rosskoLoading ? (
              <OfferSkeleton rows={3} />
            ) : similarParts.length ? (
              <div className="space-y-2">{similarParts.map(renderRosskoRow)}</div>
            ) : (
              <p className="text-sm text-gray-500">Нет предложений</p>
            )}

            <div className="mt-3">
              {usedLoading ? (
                <UsedSkeleton />
              ) : usedItems.length ? (
                <div className="grid grid-cols-2 gap-2">
                  {usedItems.map((p) => {
                    const img = productImage(p);
                    const href = buildPartDetailPath(p);
                    const price = p.price ?? p.min_price;
                    return (
                      <a
                        key={p.id || href}
                        href={href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="overflow-hidden rounded-lg border border-gray-200 transition hover:border-indigo-300"
                      >
                        <div className="flex aspect-square items-center justify-center bg-gray-50">
                          {img ? (
                            <img src={img} alt="" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <span className="text-xs text-gray-400">Нет фото</span>
                          )}
                        </div>
                        <div className="p-2">
                          <p className="truncate text-xs text-gray-700">{p.name || p.article || 'Товар'}</p>
                          {price != null ? (
                            <p className="mt-0.5 text-sm font-semibold text-gray-900">{formatPrice(price)} ₽</p>
                          ) : null}
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : null}
            </div>
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Аналоги</h4>
            {rosskoLoading ? (
              <OfferSkeleton rows={4} />
            ) : analogParts.length ? (
              <div className="space-y-2">{analogParts.map(renderRosskoRow)}</div>
            ) : (
              <p className="text-sm text-gray-500">Нет аналогов</p>
            )}
          </section>
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
