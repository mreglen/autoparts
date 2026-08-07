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
import PillDropdown from '../../components/PillDropdown/PillDropdown';
import {
  mapIdOptionsForPillDropdown,
  warehousePageClass,
  warehousePillButtonClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';
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
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

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

  const loadStockOuts = useCallback(async () => {
    try {
      await dispatch(fetchStockOuts()).unwrap();
    } catch {
      /* error in redux */
    }
  }, [dispatch]);

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

  const typeFilterOptions = useMemo(
    () => mapIdOptionsForPillDropdown(STOCK_OUT_TYPE_FILTERS),
    [],
  );
  const sortFilterOptions = useMemo(
    () => mapIdOptionsForPillDropdown(STOCK_OUT_SORT_OPTIONS),
    [],
  );

  const setFilterDropdownOpen = (key) => (open) => {
    setOpenFilterDropdown(open ? key : null);
  };

  const totalInList = sortedStockOuts.length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || typeFilter !== 'all';
  const displayedIds = displayStockOuts.map((i) => i.id);
  const allDisplayedSelected =
    displayedIds.length > 0 && displayedIds.every((id) => selectedItems.includes(id));

  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  return (
    <div className={warehousePageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Расходы</h1>
          <p className="mt-1 text-sm text-gray-500">Списания и продажи запчастей со склада</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!loading && !error && totalInList > 0 && (
            <div className="mr-1 hidden items-center gap-4 text-right sm:flex">
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.count}</div>
                <div className="text-[11px] text-gray-500">Записей</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.salesCount}</div>
                <div className="text-[11px] text-gray-500">Продажи</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">
                  {formatStockOutMoney(stats.totalValue)}
                </div>
                <div className="text-[11px] text-gray-500">На сумму</div>
              </div>
            </div>
          )}
          <button type="button" onClick={() => navigate('/my-parts')} className={warehousePrimaryButtonClass}>
            Мои запчасти
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <div className="relative min-w-0 flex-1 rounded-full transition focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-400/70">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Бренд, артикул, причина, ответственный…"
              className={`${warehousePillControlClass} pr-10`}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
                aria-label="Очистить поиск"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setFiltersOpen((v) => {
                if (v) setOpenFilterDropdown(null);
                return !v;
              });
            }}
            className={`${warehousePillButtonClass} ${filtersOpen ? 'bg-white ring-2 ring-indigo-400/70' : ''}`}
            aria-expanded={filtersOpen}
          >
            Фильтры
            <svg
              className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>
        </div>

        {filtersOpen && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:max-w-xl">
            <PillDropdown
              ariaLabel="Тип операции"
              placeholder="Все операции"
              value={typeFilter}
              options={typeFilterOptions}
              isOpen={openFilterDropdown === 'type'}
              onOpenChange={setFilterDropdownOpen('type')}
              onChange={setTypeFilter}
            />
          </div>
        )}

        <div className={warehouseToolbarClass}>
          {displayStockOuts.length > 0 && (
            <label className="inline-flex cursor-pointer items-center gap-2 rounded-full bg-white px-3 py-1.5 text-sm text-gray-700 ring-1 ring-gray-200">
              <input
                type="checkbox"
                checked={allDisplayedSelected}
                onChange={handleSelectAllDisplayed}
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              />
              <span>Выбрать все</span>
              {selectedItems.length > 0 && (
                <span className="text-gray-400 tabular-nums">({selectedItems.length})</span>
              )}
            </label>
          )}

          <PillDropdown
            ariaLabel="Сортировка"
            placeholder="Сначала новые"
            value={sortOrder}
            options={sortFilterOptions}
            isOpen={openFilterDropdown === 'sort'}
            onOpenChange={setFilterDropdownOpen('sort')}
            onChange={setSortOrder}
            fullWidth={false}
            triggerClassName="h-9 rounded-xl bg-white px-3 ring-1 ring-gray-200 hover:bg-gray-50"
            menuClassName="min-w-[14rem]"
          />

          {selectedItems.length > 0 && (
            <>
              <button
                type="button"
                onClick={handleReturnSelected}
                className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg bg-indigo-600 px-3 text-sm font-medium text-white hover:bg-indigo-700"
              >
                Вернуть на склад
              </button>
              <button
                type="button"
                onClick={() => setSelectedItems([])}
                className="inline-flex h-9 items-center rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Снять выделение
              </button>
            </>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setTypeFilter('all');
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
            >
              <span aria-hidden>×</span>
              Сбросить фильтры
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <AuthLoadingScreen className="h-24" />
          <p className="mt-4 text-sm text-gray-500">Загружаем расходы…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">
            {typeof error === 'object' ? JSON.stringify(error) : error}
          </p>
          <button type="button" onClick={() => loadStockOuts()} className={`mt-4 ${warehousePrimaryButtonClass}`}>
            Попробовать снова
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {totalInList > 0 && displayStockOuts.length !== totalInList && (
            <p className="mb-3 text-sm text-gray-500">
              Показано {displayStockOuts.length} из {totalInList} записей
              {hasActiveFilters ? ' (с учётом фильтров)' : ''}
            </p>
          )}

          {displayStockOuts.length > 0 ? (
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
          ) : (
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
