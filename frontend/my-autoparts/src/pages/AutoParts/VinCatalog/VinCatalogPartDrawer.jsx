import { useEffect, useState } from 'react';
import { buildPartDetailPath } from '../../../utils/partRoutes';

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

function normalizeOemKey(oem) {
  return String(oem || '')
    .replace(/[^A-Za-z0-9А-Яа-яЁё]/g, '')
    .toUpperCase();
}

function lookupAvail(availability, oem) {
  if (!oem || !availability) return null;
  const key = normalizeOemKey(oem);
  return availability[key] || availability[String(oem).toUpperCase()] || null;
}

export default function VinCatalogPartDrawer({ detail, availability, onClose, loadUsedProducts }) {
  const open = Boolean(detail);
  const [showUsed, setShowUsed] = useState(false);
  const [usedItems, setUsedItems] = useState([]);
  const [usedLoading, setUsedLoading] = useState(false);

  const oem = detail?.oem || '';
  const avail = lookupAvail(availability, oem);
  const rossko = avail?.rossko;

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    setShowUsed(false);
    setUsedItems([]);
  }, [detail?.oem, detail?.detail_id]);

  useEffect(() => {
    if (!showUsed || !oem || !loadUsedProducts) return undefined;
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
  }, [showUsed, oem, loadUsedProducts]);

  if (!open) return null;

  const newUrl = `/autoparts/new?q=${encodeURIComponent(oem)}`;
  const minPrice = rossko?.min_price ?? rossko?.price ?? null;
  const count = rossko?.count ?? 0;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <button
        type="button"
        aria-label="Закрыть"
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative flex h-full w-full max-w-md flex-col bg-white shadow-xl sm:max-w-lg">
        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold text-gray-900">{detail.name || 'Деталь'}</h3>
            {oem ? <p className="mt-0.5 font-mono text-sm text-indigo-700">{oem}</p> : null}
          </div>
          <button
            type="button"
            onClick={onClose}
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
            <h4 className="mb-2 text-sm font-semibold text-gray-900">Новые</h4>
            {count > 0 ? (
              <div className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
                <div>
                  <p className="text-sm text-gray-700">
                    {count} поз.
                    {minPrice != null ? (
                      <span className="ml-2 font-semibold text-gray-900">от {minPrice} ₽</span>
                    ) : null}
                  </p>
                </div>
                <a
                  href={newUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
                >
                  Смотреть
                </a>
              </div>
            ) : (
              <p className="text-sm text-gray-500">Нет в наличии</p>
            )}
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h4 className="text-sm font-semibold text-gray-900">На сайте</h4>
              <button
                type="button"
                onClick={() => setShowUsed((v) => !v)}
                className="text-sm font-medium text-indigo-600 hover:text-indigo-800"
              >
                {showUsed ? 'Скрыть' : 'Показать б/у'}
              </button>
            </div>
            {showUsed ? (
              usedLoading ? (
                <p className="text-sm text-gray-500">Загрузка…</p>
              ) : !usedItems.length ? (
                <p className="text-sm text-gray-500">Нет предложений</p>
              ) : (
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
                        className="overflow-hidden rounded-lg border border-gray-200 hover:border-indigo-300"
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
                            <p className="mt-0.5 text-sm font-semibold text-gray-900">{price} ₽</p>
                          ) : null}
                        </div>
                      </a>
                    );
                  })}
                </div>
              )
            ) : (
              <p className="text-sm text-gray-500">
                {(avail?.used?.count ?? 0) > 0
                  ? `${avail.used.count} б/у`
                  : 'Нажмите «Показать б/у»'}
              </p>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
