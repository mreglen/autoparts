import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { fetchStockOuts, createReturn } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchMyProducts } from '../../redux/slices/ProductSlice';
import { fetchStockIns } from '../../redux/slices/StockInSlice';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import StockOutCard from '../../components/StockOut/StockOutCard';
import StockOutEmptyState from '../../components/StockOut/StockOutEmptyState';
import MediaModal from '../../components/MediaModal/MediaModal';
import ReturnModal from './ReturnModal';
import { normalizeImageUrl } from '../../utils/apiClient';
import {
  formatStockOutMoney,
  getStockOutLineTotal,
  isStockOutSale,
  matchesStockOutSearch,
  matchesStockOutTypeFilter,
  sortStockOutItems,
  STOCK_OUT_SORT_OPTIONS,
  STOCK_OUT_TYPE_FILTERS,
} from '../../utils/stockOutUi';

export const StockOutList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items: stockOuts, loading, error } = useSelector((state) => state.stockOut);
  const { storageLocations } = useSelector((state) => state.organization);
  const { user, permissionCodes } = useSelector((state) => state.auth);

  const [authChecked, setAuthChecked] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [selectedItems, setSelectedItems] = useState([]);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [itemsToReturn, setItemsToReturn] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [sortOrder, setSortOrder] = useState('date_desc');
  const [refreshing, setRefreshing] = useState(false);

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee && permissionCodes && permissionCodes.includes('stock-out'));

  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  const loadStockOuts = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        await dispatch(fetchStockOuts()).unwrap();
      } catch {
        /* error in redux */
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (authChecked && hasPermission && (user?.is_seller || user?.is_employee) && user.organization_id) {
      loadStockOuts();
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user, authChecked, hasPermission, loadStockOuts]);

  const sortedStockOuts = useMemo(
    () => sortStockOutItems(stockOuts, sortOrder),
    [stockOuts, sortOrder]
  );

  const displayStockOuts = useMemo(
    () =>
      sortedStockOuts.filter(
        (item) => matchesStockOutTypeFilter(item, typeFilter) && matchesStockOutSearch(item, searchQuery)
      ),
    [sortedStockOuts, typeFilter, searchQuery]
  );

  const stats = useMemo(() => {
    let salesCount = 0;
    let writeoffCount = 0;
    let totalValue = 0;
    displayStockOuts.forEach((item) => {
      if (isStockOutSale(item)) salesCount += 1;
      else writeoffCount += 1;
      totalValue += getStockOutLineTotal(item);
    });
    return { count: displayStockOuts.length, salesCount, writeoffCount, totalValue };
  }, [displayStockOuts]);

  const getStorageAddress = useCallback(
    (locationId) => {
      if (!locationId) return '—';
      const loc = storageLocations.find((l) => l.id === locationId);
      return loc ? loc.address || `Склад #${locationId}` : `Склад #${locationId}`;
    },
    [storageLocations]
  );

  const handleSelectItem = (itemId) => {
    setSelectedItems((prev) =>
      prev.includes(itemId) ? prev.filter((id) => id !== itemId) : [...prev, itemId]
    );
  };

  const handleSelectAllDisplayed = () => {
    const ids = displayStockOuts.map((item) => item.id);
    const allSelected = ids.length > 0 && ids.every((id) => selectedItems.includes(id));
    if (allSelected) {
      setSelectedItems((prev) => prev.filter((id) => !ids.includes(id)));
    } else {
      setSelectedItems((prev) => [...new Set([...prev, ...ids])]);
    }
  };

  const handleReturnItem = (item) => {
    setItemsToReturn([item]);
    setReturnModalOpen(true);
  };

  const handleReturnSelected = () => {
    const selected = stockOuts.filter((item) => selectedItems.includes(item.id));
    setItemsToReturn(selected);
    setReturnModalOpen(true);
  };

  const handleReturnConfirm = async (returnData) => {
    try {
      await dispatch(createReturn({ items: returnData })).unwrap();
      dispatch(fetchStockOuts());
      dispatch(fetchMyProducts({ page: 1, page_size: 500 }));
      dispatch(fetchStockIns());
      setReturnModalOpen(false);
      setItemsToReturn([]);
      setSelectedItems([]);
    } catch (err) {
      console.error('Ошибка при возврате:', err);
    }
  };

  const handleRemoveItemFromReturn = (itemId) => {
    setSelectedItems((prev) => prev.filter((id) => id !== itemId));
    setItemsToReturn((prev) => prev.filter((item) => item.id !== itemId));
  };

  const toggleExpand = (id) => {
    setExpandedDocId((prev) => (prev === id ? null : id));
  };

  const handleOpenMediaModal = (mediaItems, initialIndex = 0) => {
    const formattedMedia = mediaItems.map((mediaItem) => {
      const url =
        typeof mediaItem === 'string'
          ? mediaItem
          : mediaItem.full_url || mediaItem.photo_url || mediaItem.video_url || '';
      const normalizedUrl = normalizeImageUrl(url);
      const isVideo = normalizedUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
      return {
        type: isVideo ? 'video' : 'image',
        src: normalizedUrl,
      };
    });
    setCurrentMediaItems(formattedMedia);
    setCurrentMediaIndex(initialIndex);
    setMediaModalOpen(true);
  };

  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  const totalInList = sortedStockOuts.length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || typeFilter !== 'all';
  const displayedIds = displayStockOuts.map((i) => i.id);
  const allDisplayedSelected =
    displayedIds.length > 0 && displayedIds.every((id) => selectedItems.includes(id));

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white via-white to-rose-50/80 p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-rose-400/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">Склад</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Расходы
            </h1>
            <p className="mt-2 max-w-xl text-sm text-gray-600">
              Списания и продажи запчастей: можно вернуть позиции на склад или посмотреть детали операции.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadStockOuts(true)}
              disabled={loading || refreshing}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
            >
              <svg
                className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              {refreshing ? 'Обновление…' : 'Обновить'}
            </button>
            <button
              type="button"
              onClick={() => navigate('/my-parts')}
              className="inline-flex items-center justify-center rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-rose-700"
            >
              Мои запчасти
            </button>
          </div>
        </div>

        {!loading && !error && totalInList > 0 && (
          <dl className="relative mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Записей</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{stats.count}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Продажи</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-emerald-700">{stats.salesCount}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Списания</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-rose-700">{stats.writeoffCount}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm col-span-2 sm:col-span-1">
              <dt className="text-xs font-medium text-gray-500">На сумму</dt>
              <dd className="mt-1 text-xl font-bold tabular-nums text-gray-900 sm:text-2xl">
                {formatStockOutMoney(stats.totalValue)}
              </dd>
            </div>
          </dl>
        )}
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-1 shadow-sm">
        <div className="p-3">
          <div className="relative min-w-0">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Бренд, артикул, причина, ответственный…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-rose-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                aria-label="Очистить поиск"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-3 py-3">
          {STOCK_OUT_TYPE_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setTypeFilter(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                typeFilter === opt.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-3 py-3">
          {STOCK_OUT_SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortOrder(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sortOrder === opt.id
                  ? 'bg-rose-100 text-rose-900 ring-1 ring-rose-200'
                  : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {selectedItems.length > 0 && (
        <div className="flex flex-col gap-3 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <span className="text-sm font-medium text-rose-900">Выбрано: {selectedItems.length}</span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleReturnSelected}
              className="inline-flex items-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-medium text-white hover:bg-rose-700"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                />
              </svg>
              Вернуть на склад
            </button>
            <button
              type="button"
              onClick={() => setSelectedItems([])}
              className="rounded-xl border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-800 hover:bg-rose-50"
            >
              Снять выделение
            </button>
          </div>
        </div>
      )}

      {displayStockOuts.length > 0 && (
        <div className="flex items-center justify-between rounded-xl border border-gray-200/80 bg-white px-4 py-2.5 shadow-sm">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={allDisplayedSelected}
              onChange={handleSelectAllDisplayed}
              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
            />
            Выбрать все на странице
          </label>
          <span className="text-xs text-gray-500">{displayStockOuts.length} поз.</span>
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
          <AuthLoadingScreen className="h-24" />
          <p className="mt-4 text-sm text-gray-600">Загружаем расходы…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">
            {typeof error === 'object' ? JSON.stringify(error) : error}
          </p>
          <button
            type="button"
            onClick={() => loadStockOuts()}
            className="mt-4 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {totalInList > 0 && displayStockOuts.length !== totalInList && (
            <p className="text-sm text-gray-500">
              Показано {displayStockOuts.length} из {totalInList} записей
              {hasActiveFilters ? ' (с учётом фильтров)' : ''}
            </p>
          )}

          <div className="space-y-4">
            {displayStockOuts.map((item) => (
              <StockOutCard
                key={item.id}
                item={item}
                storageLabel={getStorageAddress(item.storage_location_id)}
                isExpanded={expandedDocId === item.id}
                isSelected={selectedItems.includes(item.id)}
                onToggle={toggleExpand}
                onSelect={() => handleSelectItem(item.id)}
                onReturn={handleReturnItem}
                onImageClick={handleOpenMediaModal}
              />
            ))}
          </div>

          {displayStockOuts.length === 0 && (
            <StockOutEmptyState hasSearch={hasActiveFilters || totalInList > 0} />
          )}
        </>
      )}

      <ReturnModal
        isOpen={returnModalOpen}
        onClose={() => {
          setReturnModalOpen(false);
          setItemsToReturn([]);
        }}
        items={itemsToReturn}
        onConfirm={handleReturnConfirm}
        onRemoveItem={handleRemoveItemFromReturn}
      />

      <MediaModal
        isOpen={mediaModalOpen}
        onClose={() => setMediaModalOpen(false)}
        mediaItems={currentMediaItems}
        initialIndex={currentMediaIndex}
      />
    </div>
  );
};
