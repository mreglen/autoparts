import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiAxios, apiRequestFormData, normalizeImageUrl } from '../../utils/apiClient';
import { createStockIn } from '../../redux/slices/StockInSlice';
import { updateProduct, updatePendingProduct } from '../../redux/slices/ProductSlice';

function CloseIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function BackIcon({ className = 'h-5 w-5' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
    </svg>
  );
}

function formatPrice(value) {
  if (value == null || value === '') return '—';
  const num = Number(value);
  if (Number.isNaN(num)) return '—';
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(num);
}

function PhotoThumb({ url, className = 'h-14 w-14' }) {
  const src = url ? normalizeImageUrl(url) : null;
  return (
    <div className={`${className} shrink-0 overflow-hidden rounded-xl bg-gray-100`}>
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center text-[10px] text-gray-400">Нет фото</div>
      )}
    </div>
  );
}

function positiveIntOrNull(raw) {
  if (raw === '' || raw == null) return null;
  if (!/^\d+$/.test(String(raw).trim())) return null;
  const n = parseInt(String(raw).trim(), 10);
  return n > 0 ? n : null;
}

/**
 * @param {{
 *   isOpen: boolean,
 *   onClose: () => void,
 *   articleQuery: string,
 *   onAddAsNew: () => void,
 *   onStockInSuccess: () => void,
 * }} props
 */
export default function ArticleMatchesModal({
  isOpen,
  onClose,
  articleQuery,
  onAddAsNew,
  onStockInSuccess,
}) {
  const dispatch = useDispatch();
  const currentUser = useSelector((state) => state.auth.user);

  const [view, setView] = useState('list'); // list | detail
  const [sort, setSort] = useState('date');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [offset, setOffset] = useState(0);
  const [listStatus, setListStatus] = useState('idle');
  const [listError, setListError] = useState(null);

  const [selected, setSelected] = useState(null); // {id, source}
  const [detail, setDetail] = useState(null);
  const [detailStatus, setDetailStatus] = useState('idle');
  const [detailError, setDetailError] = useState(null);
  const [galleryIndex, setGalleryIndex] = useState(0);

  const [stockQty, setStockQty] = useState('1');
  const [stockSaving, setStockSaving] = useState(false);
  const [stockError, setStockError] = useState('');

  const [editing, setEditing] = useState(false);
  const [editQty, setEditQty] = useState('');
  const [editPrice, setEditPrice] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editPhotos, setEditPhotos] = useState([]);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState('');

  const stockQtyValid = positiveIntOrNull(stockQty) != null;
  const editQtyValid = positiveIntOrNull(editQty) != null;

  const creatorLabel = useMemo(() => {
    if (!detail) return '—';
    if (detail.created_by && currentUser?.id && detail.created_by === currentUser.id) return 'Вы';
    return detail.creator_full_name || '—';
  }, [detail, currentUser?.id]);

  const loadList = useCallback(
    async ({ reset = false, nextOffset = 0, nextSort = sort } = {}) => {
      const q = String(articleQuery || '').trim();
      if (q.length < 2) {
        setItems([]);
        setTotal(0);
        setHasMore(false);
        setListStatus('succeeded');
        return;
      }
      setListStatus('loading');
      setListError(null);
      try {
        const res = await apiAxios.get('/products/article-matches', {
          params: { q, sort: nextSort, offset: nextOffset, limit: 20 },
        });
        const data = res.data || {};
        const pageItems = Array.isArray(data.items) ? data.items : [];
        setItems((prev) => (reset ? pageItems : [...prev, ...pageItems]));
        setTotal(Number(data.total) || 0);
        setHasMore(Boolean(data.has_more));
        setOffset(nextOffset + pageItems.length);
        setListStatus('succeeded');
      } catch (err) {
        setListError(err?.response?.data?.detail || 'Не удалось загрузить совпадения');
        setListStatus('failed');
      }
    },
    [articleQuery, sort]
  );

  const loadDetail = useCallback(async (source, id) => {
    setDetailStatus('loading');
    setDetailError(null);
    setDetail(null);
    try {
      const res = await apiAxios.get(`/products/article-matches/${source}/${id}`);
      const data = res.data;
      setDetail(data);
      setGalleryIndex(0);
      setStockQty('1');
      setStockError('');
      setEditing(false);
      setEditQty(String(data.quantity ?? 1));
      setEditPrice(data.price != null ? String(data.price) : '');
      setEditDescription(data.description || '');
      setEditPhotos(Array.isArray(data.photos) ? [...data.photos] : []);
      setEditError('');
      setDetailStatus('succeeded');
    } catch (err) {
      setDetailError(err?.response?.data?.detail || 'Не удалось загрузить карточку');
      setDetailStatus('failed');
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return undefined;
    setView('list');
    setSelected(null);
    setDetail(null);
    setSort('date');
    setItems([]);
    setOffset(0);
    void loadList({ reset: true, nextOffset: 0, nextSort: 'date' });

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [isOpen, articleQuery]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!isOpen) return null;

  const openDetail = (row) => {
    setSelected({ id: row.id, source: row.source });
    setView('detail');
    void loadDetail(row.source, row.id);
  };

  const backToList = () => {
    setView('list');
    setSelected(null);
    setDetail(null);
    setEditing(false);
  };

  const handleSortChange = (nextSort) => {
    if (nextSort === sort) return;
    setSort(nextSort);
    setItems([]);
    setOffset(0);
    void loadList({ reset: true, nextOffset: 0, nextSort });
  };

  const handleStockIn = async () => {
    const qty = positiveIntOrNull(stockQty);
    if (!qty) {
      setStockError('Укажите целое положительное число');
      return;
    }
    if (!detail || detail.source !== 'product') return;
    if (!detail.storage_location_id) {
      setStockError('У товара не указан склад');
      return;
    }
    setStockSaving(true);
    setStockError('');
    try {
      await dispatch(
        createStockIn({
          product_id: detail.id,
          storage_location_id: detail.storage_location_id,
          quantity: qty,
          sale_price: Number(detail.price) || 0,
          acquired_product_id: null,
        })
      ).unwrap();
      onStockInSuccess?.();
    } catch (err) {
      setStockError(typeof err === 'string' ? err : 'Не удалось оформить приход');
    } finally {
      setStockSaving(false);
    }
  };

  const handleSaveEdit = async () => {
    const qty = positiveIntOrNull(editQty);
    if (!qty) {
      setEditError('Укажите целое положительное количество');
      return;
    }
    if (!detail) return;
    setEditSaving(true);
    setEditError('');
    try {
      const priceNum = editPrice === '' ? detail.price : Number(editPrice);
      if (editPrice !== '' && (Number.isNaN(priceNum) || priceNum < 0)) {
        setEditError('Некорректная цена');
        setEditSaving(false);
        return;
      }

      if (detail.source === 'product') {
        await dispatch(
          updateProduct({
            id: detail.id,
            productData: {
              article: detail.article,
              name: detail.name,
              brand: detail.brand,
              quantity: qty,
              price: priceNum,
              description: editDescription,
              is_new: detail.is_new,
              storage_location_id: detail.storage_location_id,
              part_type_id: detail.part_type_id,
              photos: editPhotos,
              videos: detail.videos || [],
            },
          })
        ).unwrap();
      } else {
        await dispatch(
          updatePendingProduct({
            id: detail.id,
            productData: {
              article: detail.article,
              name: detail.name,
              brand: detail.brand,
              quantity: qty,
              price: priceNum,
              description: editDescription,
              photos: editPhotos,
              videos: detail.videos || [],
              is_new: detail.is_new,
              storage_location_id: detail.storage_location_id,
              part_type_id: detail.part_type_id,
            },
          })
        ).unwrap();
      }
      await loadDetail(detail.source, detail.id);
      setEditing(false);
    } catch (err) {
      setEditError(typeof err === 'string' ? err : 'Не удалось сохранить изменения');
    } finally {
      setEditSaving(false);
    }
  };

  const handleAddPhoto = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      const result = await apiRequestFormData('/upload/photo', formData);
      const url = result?.temp_path || result?.url || result?.photo_url;
      if (url) setEditPhotos((prev) => [...prev, url]);
    } catch {
      setEditError('Не удалось загрузить фото');
    }
  };

  const media = detail?.media?.length
    ? detail.media
    : [
        ...(detail?.photos || []).map((url) => ({ url, kind: 'photo' })),
        ...(detail?.videos || []).map((url) => ({ url, kind: 'video' })),
      ];

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Похожие товары"
        className="flex max-h-[min(92dvh,720px)] w-full max-w-lg flex-col rounded-t-3xl bg-white shadow-2xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex justify-center pt-3 sm:hidden" aria-hidden>
          <div className="h-1.5 w-10 rounded-full bg-gray-200" />
        </div>

        <div className="flex items-start justify-between gap-3 border-b border-gray-100 px-4 pb-3 pt-2 sm:px-5 sm:pt-4">
          <div className="min-w-0">
            {view === 'detail' ? (
              <button
                type="button"
                onClick={backToList}
                className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-700"
              >
                <BackIcon className="h-4 w-4" />
                К списку
              </button>
            ) : null}
            <h2 className="text-lg font-semibold text-gray-900">
              {view === 'list' ? 'Похожие товары' : 'Карточка товара'}
            </h2>
            {view === 'list' ? (
              <p className="mt-0.5 text-sm text-gray-500">
                Найдено: {total} · артикул «{articleQuery}»
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-gray-400 hover:bg-gray-50 hover:text-gray-700"
            aria-label="Закрыть"
          >
            <CloseIcon />
          </button>
        </div>

        {view === 'list' ? (
          <>
            <div className="flex gap-2 border-b border-gray-100 px-4 py-3 sm:px-5">
              {[
                { id: 'date', label: 'По дате' },
                { id: 'quantity', label: 'По остатку' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleSortChange(opt.id)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    sort === opt.id
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-2 py-2 sm:px-3">
              {listStatus === 'loading' && items.length === 0 ? (
                <div className="space-y-2 p-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="flex gap-3 rounded-xl p-2">
                      <div className="h-14 w-14 animate-pulse rounded-xl bg-gray-100" />
                      <div className="flex-1 space-y-2 py-1">
                        <div className="h-3 w-2/3 animate-pulse rounded bg-gray-100" />
                        <div className="h-3 w-1/2 animate-pulse rounded bg-gray-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : null}

              {listStatus === 'failed' ? (
                <div className="px-4 py-10 text-center text-sm text-gray-600">
                  <p>{listError}</p>
                  <button
                    type="button"
                    onClick={() => loadList({ reset: true, nextOffset: 0 })}
                    className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Повторить
                  </button>
                </div>
              ) : null}

              {listStatus === 'succeeded' && items.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-500">Совпадений не найдено</p>
              ) : null}

              <ul className="space-y-1">
                {items.map((row) => (
                  <li key={`${row.source}-${row.id}`}>
                    <button
                      type="button"
                      onClick={() => openDetail(row)}
                      className="flex w-full items-start gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-gray-50 active:bg-gray-100"
                    >
                      <PhotoThumb url={row.photo_url} />
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-gray-900">
                            {row.brand || '—'} · {row.article || '—'}
                          </p>
                          {row.source === 'pending' ? (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-800">
                              На модерации
                            </span>
                          ) : null}
                          {row.is_exact ? (
                            <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold text-indigo-700">
                              Точное
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{row.name || 'Без названия'}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          Остаток: {row.quantity ?? 0} шт. · {formatPrice(row.price)}
                        </p>
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {hasMore ? (
                <div className="px-2 py-3">
                  <button
                    type="button"
                    disabled={listStatus === 'loading'}
                    onClick={() => loadList({ reset: false, nextOffset: offset })}
                    className="w-full rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
                  >
                    {listStatus === 'loading' ? 'Загрузка…' : 'Показать ещё'}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="border-t border-gray-100 p-4 sm:p-5">
              <button
                type="button"
                onClick={onAddAsNew}
                className="w-full rounded-xl bg-gray-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-gray-800"
              >
                Добавить как новое
              </button>
            </div>
          </>
        ) : (
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
            {detailStatus === 'loading' ? (
              <div className="space-y-3">
                <div className="h-48 animate-pulse rounded-2xl bg-gray-100" />
                <div className="h-4 w-2/3 animate-pulse rounded bg-gray-100" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-gray-100" />
              </div>
            ) : null}

            {detailStatus === 'failed' ? (
              <div className="py-10 text-center text-sm text-gray-600">
                <p>{detailError}</p>
                {selected ? (
                  <button
                    type="button"
                    onClick={() => loadDetail(selected.source, selected.id)}
                    className="mt-3 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white"
                  >
                    Повторить
                  </button>
                ) : null}
              </div>
            ) : null}

            {detailStatus === 'succeeded' && detail ? (
              <div className="space-y-5">
                {media.length > 0 ? (
                  <div>
                    <div className="overflow-hidden rounded-2xl bg-gray-100">
                      {media[galleryIndex]?.kind === 'video' ? (
                        <video
                          src={normalizeImageUrl(media[galleryIndex].url)}
                          controls
                          className="max-h-64 w-full object-contain"
                        />
                      ) : (
                        <img
                          src={normalizeImageUrl(media[galleryIndex]?.url)}
                          alt=""
                          className="max-h-64 w-full object-contain"
                        />
                      )}
                    </div>
                    {media.length > 1 ? (
                      <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
                        {media.map((m, idx) => (
                          <button
                            key={`${m.kind}-${m.url}-${idx}`}
                            type="button"
                            onClick={() => setGalleryIndex(idx)}
                            className={`h-14 w-14 shrink-0 overflow-hidden rounded-lg ring-2 ${
                              idx === galleryIndex ? 'ring-indigo-500' : 'ring-transparent'
                            }`}
                          >
                            {m.kind === 'video' ? (
                              <div className="flex h-full w-full items-center justify-center bg-gray-200 text-[10px] text-gray-600">
                                Видео
                              </div>
                            ) : (
                              <img src={normalizeImageUrl(m.url)} alt="" className="h-full w-full object-cover" />
                            )}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="flex h-40 items-center justify-center rounded-2xl bg-gray-100 text-sm text-gray-400">
                    Нет фото
                  </div>
                )}

                <div>
                  <p className="text-sm font-semibold text-indigo-700">
                    {detail.brand || '—'} · {detail.article || '—'}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-gray-900">{detail.name || 'Без названия'}</h3>
                  {detail.source === 'pending' ? (
                    <span className="mt-2 inline-flex rounded-full bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-800">
                      На модерации
                    </span>
                  ) : null}
                </div>

                <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-gray-500">Остаток</dt>
                    <dd className="font-semibold text-gray-900">{detail.quantity ?? 0} шт.</dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2">
                    <dt className="text-xs text-gray-500">Цена</dt>
                    <dd className="font-semibold text-gray-900">{formatPrice(detail.price)}</dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 sm:col-span-2">
                    <dt className="text-xs text-gray-500">Склад</dt>
                    <dd className="font-medium text-gray-900">{detail.storage_location_address || '—'}</dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 sm:col-span-2">
                    <dt className="text-xs text-gray-500">Адресное хранение</dt>
                    <dd className="font-medium text-gray-900">
                      {detail.storage_cells?.length
                        ? detail.storage_cells
                            .map((c) => [c.cell_name, c.value].filter(Boolean).join(': '))
                            .join(', ')
                        : '—'}
                    </dd>
                  </div>
                  <div className="rounded-xl bg-gray-50 px-3 py-2 sm:col-span-2">
                    <dt className="text-xs text-gray-500">Кто завёл</dt>
                    <dd className="font-medium text-gray-900">{creatorLabel}</dd>
                  </div>
                </dl>

                {!editing ? (
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Описание</p>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                      {detail.description?.trim() || 'Нет описания'}
                    </p>
                  </div>
                ) : null}

                {detail.source === 'product' && !editing ? (
                  <div className="rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <p className="text-sm font-semibold text-gray-900">Добавить на склад</p>
                    <p className="mt-1 text-xs text-gray-600">Создаст запись поступления и увеличит остаток</p>
                    <div className="mt-3 flex items-end gap-3">
                      <div className="flex-1">
                        <label className="mb-1 block text-xs font-medium text-gray-600">Количество</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          value={stockQty}
                          onChange={(e) => {
                            const v = e.target.value.replace(/[^\d]/g, '');
                            setStockQty(v);
                            setStockError('');
                          }}
                          className={`w-full rounded-xl border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500/20 ${
                            stockQty === '' || !stockQtyValid
                              ? 'border-red-400 bg-red-50'
                              : 'border-gray-200 bg-white'
                          }`}
                        />
                      </div>
                      <button
                        type="button"
                        disabled={stockSaving || !stockQtyValid}
                        onClick={handleStockIn}
                        className="shrink-0 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                      >
                        {stockSaving ? '…' : `+${positiveIntOrNull(stockQty) || ''}`}
                      </button>
                    </div>
                    {stockError ? <p className="mt-2 text-xs text-red-600">{stockError}</p> : null}
                  </div>
                ) : null}

                {editing ? (
                  <div className="space-y-3 rounded-2xl border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-gray-900">Редактирование</p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Количество *</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={editQty}
                        onChange={(e) => setEditQty(e.target.value.replace(/[^\d]/g, ''))}
                        className={`w-full rounded-xl border px-3 py-2.5 text-sm ${
                          editQty === '' || !editQtyValid ? 'border-red-400 bg-red-50' : 'border-gray-200'
                        }`}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Цена</label>
                      <input
                        type="text"
                        inputMode="decimal"
                        value={editPrice}
                        onChange={(e) => setEditPrice(e.target.value.replace(/[^\d.]/g, ''))}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Описание</label>
                      <textarea
                        value={editDescription}
                        onChange={(e) => setEditDescription(e.target.value)}
                        rows={4}
                        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm"
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-600">Фото</label>
                      <div className="flex flex-wrap gap-2">
                        {editPhotos.map((url) => (
                          <div key={url} className="relative">
                            <PhotoThumb url={url} className="h-16 w-16" />
                            <button
                              type="button"
                              onClick={() => setEditPhotos((prev) => prev.filter((u) => u !== url))}
                              className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] text-white"
                              aria-label="Удалить фото"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                        <label className="flex h-16 w-16 cursor-pointer items-center justify-center rounded-xl border border-dashed border-gray-300 text-xs text-gray-500 hover:bg-gray-50">
                          +
                          <input type="file" accept="image/*" className="hidden" onChange={handleAddPhoto} />
                        </label>
                      </div>
                    </div>
                    {editError ? <p className="text-xs text-red-600">{editError}</p> : null}
                    <div className="flex gap-2">
                      <button
                        type="button"
                        disabled={editSaving || !editQtyValid}
                        onClick={handleSaveEdit}
                        className="flex-1 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50"
                      >
                        {editSaving ? 'Сохранение…' : 'Сохранить'}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditing(false);
                          setEditError('');
                        }}
                        className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-semibold text-gray-700"
                      >
                        Отмена
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      className="flex-1 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 hover:bg-gray-50"
                    >
                      Отредактировать
                    </button>
                    <button
                      type="button"
                      onClick={onAddAsNew}
                      className="flex-1 rounded-xl bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-gray-800"
                    >
                      Добавить как новое
                    </button>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
