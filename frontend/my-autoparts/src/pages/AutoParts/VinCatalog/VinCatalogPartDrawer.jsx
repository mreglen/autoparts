import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import { buildPartDetailPath } from '../../../utils/partRoutes';
import {
  normalizeArticle,
  searchRosskoPartsForOem,
  splitRosskoOriginalAndAnalogs,
} from '../NewParts/rosskoHelpers';
import VinCatalogOffersTable from './VinCatalogOffersTable';

const CLOSE_ANIMATION_MS = 200;
const SECTION_PREVIEW_LIMIT = 5;

function previewItems(items, expanded) {
  if (!Array.isArray(items) || expanded) return items || [];
  return items.slice(0, SECTION_PREVIEW_LIMIT);
}

function ShowMoreButton({ total, expanded, onToggle }) {
  if (!total || total <= SECTION_PREVIEW_LIMIT) return null;
  const hidden = total - SECTION_PREVIEW_LIMIT;
  return (
    <button
      type="button"
      onClick={onToggle}
      className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
    >
      {expanded ? 'Скрыть' : `Показать больше (${hidden})`}
    </button>
  );
}

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

function OfferSkeleton({ rows = 3 }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="animate-pulse rounded-lg border border-gray-100 p-3">
          <div className="h-3 w-28 rounded bg-gray-100" />
          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="h-5 w-20 rounded bg-gray-100" />
            <div className="h-8 w-24 rounded bg-gray-100" />
          </div>
        </div>
      ))}
    </div>
  );
}

function UsedSkeleton({ count = 4 }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
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

export default function VinCatalogPartDrawer({
  detail,
  onClose,
  loadUsedProducts,
  vinBasketId = null,
  ensureVinBasket = null,
  vehicleBrand = '',
}) {
  const open = Boolean(detail);
  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [rosskoLoading, setRosskoLoading] = useState(false);
  const [usedLoading, setUsedLoading] = useState(false);
  const [similarParts, setSimilarParts] = useState([]);
  const [analogParts, setAnalogParts] = useState([]);
  const [usedItems, setUsedItems] = useState([]);
  const [originalsExpanded, setOriginalsExpanded] = useState(false);
  const [analogsExpanded, setAnalogsExpanded] = useState(false);
  const [usedExpanded, setUsedExpanded] = useState(false);

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
    setOriginalsExpanded(false);
    setAnalogsExpanded(false);
    setUsedExpanded(false);
  }, [detail?.oem, detail?.detail_id]);

  useEffect(() => {
    if (!open || !oem) return undefined;
    let cancelled = false;
    setRosskoLoading(true);
    (async () => {
      try {
        const parts = await searchRosskoPartsForOem(
          (path, body) => apiAxiosUnauth.post(path, body),
          { oem, brandHint: vehicleBrand },
        );
        if (cancelled) return;
        const { originals, analogs } = splitRosskoOriginalAndAnalogs(parts, oemNorm);
        setSimilarParts(originals);
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
  }, [open, oem, oemNorm, vehicleBrand]);

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

  const body = (
    <div className="fixed inset-0 z-[100] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Закрыть"
        className={`absolute inset-0 bg-black/45 ${isClosing ? 'animate-fade-out' : 'animate-fade-in'}`}
        onClick={requestClose}
      />
      <div
        className={`relative flex h-full w-full max-w-[58rem] flex-col bg-white shadow-2xl sm:max-w-[58rem] lg:max-w-[66rem] ${
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

        <div className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Оригинал</h4>
            {rosskoLoading ? (
              <OfferSkeleton rows={3} />
            ) : similarParts.length ? (
              <>
                <VinCatalogOffersTable
                  parts={previewItems(similarParts, originalsExpanded)}
                  sectionType="available"
                  vinBasketId={vinBasketId}
                  ensureVinBasket={ensureVinBasket}
                />
                <ShowMoreButton
                  total={similarParts.length}
                  expanded={originalsExpanded}
                  onToggle={() => setOriginalsExpanded((v) => !v)}
                />
              </>
            ) : (
              <p className="text-sm text-gray-500">Нет предложений</p>
            )}
          </section>

          <section>
            <h4 className="mb-2 text-sm font-semibold text-gray-900">
              Аналоги
              {!rosskoLoading && analogParts.length ? (
                <span className="ml-2 text-xs font-normal text-gray-500">{analogParts.length}</span>
              ) : null}
            </h4>
            {rosskoLoading ? (
              <OfferSkeleton rows={4} />
            ) : analogParts.length ? (
              <>
                <VinCatalogOffersTable
                  parts={previewItems(analogParts, analogsExpanded)}
                  sectionType="analog"
                  vinBasketId={vinBasketId}
                  ensureVinBasket={ensureVinBasket}
                />
                <ShowMoreButton
                  total={analogParts.length}
                  expanded={analogsExpanded}
                  onToggle={() => setAnalogsExpanded((v) => !v)}
                />
              </>
            ) : (
              <p className="text-sm text-gray-500">Нет аналогов</p>
            )}
          </section>

          {usedLoading || usedItems.length ? (
            <section>
              <h4 className="mb-2 text-sm font-semibold text-gray-900">
                На складе
                {!usedLoading && usedItems.length ? (
                  <span className="ml-2 text-xs font-normal text-gray-500">{usedItems.length}</span>
                ) : null}
              </h4>
              {usedLoading ? (
                <UsedSkeleton count={5} />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {previewItems(usedItems, usedExpanded).map((p) => {
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
                  <ShowMoreButton
                    total={usedItems.length}
                    expanded={usedExpanded}
                    onToggle={() => setUsedExpanded((v) => !v)}
                  />
                </>
              )}
            </section>
          ) : null}
        </div>
      </div>
    </div>
  );

  return createPortal(body, document.body);
}
