import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import MediaModal from '../../components/MediaModal/MediaModal';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import StockInEmptyState from '../../components/StockIn/StockInEmptyState';
import SellerStockMovementModal from '../../components/SellerWarehouse/SellerStockMovementModal';
import PageFiltersPanel from '../../components/PageFiltersPanel/PageFiltersPanel';
import { usePageFilters } from '../../hooks/usePageFilters';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTheadRowClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListTrClickableClass,
  autoserviceListMobileWrapClass,
} from '../../utils/warehouseListUi';
import { userHasWarehouseQrAccess } from '../../hooks/useWarehousePermissions';
import { normalizeImageUrl } from '../../utils/apiClient';
import { fetchStockIns } from '../../redux/slices/StockInSlice';
import { fetchStockOuts } from '../../redux/slices/StockOutSlice';
import {
  formatStockInMoney,
  getStockInLineTotal,
  matchesStockInSearch,
  sortStockInDocs,
  STOCK_IN_SORT_OPTIONS,
} from '../../utils/stockInUi';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';

const StockInList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { items: stockIns, loading, error } = useSelector((state) => state.stockIn);
  const { items: stockOuts } = useSelector((state) => state.stockOut);

  const [authChecked, setAuthChecked] = useState(false);
  const [viewStockIn, setViewStockIn] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  const DEFAULT_FILTERS = {
    date_from: '',
    date_to: '',
    storage: '',
    creator: '',
    min_sum: '',
    max_sum: '',
    sort: 'date_desc',
  };

  const { filters, updateFilter, activeCount } = usePageFilters(DEFAULT_FILTERS, { syncWithUrl: true });

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee && permissionCodes && permissionCodes.includes('stock-in'));
  const canScanQr = userHasWarehouseQrAccess(user, permissionCodes);

  useEffect(() => {
    if (authChecked && hasPermission) {
      dispatch(fetchStockIns());
      dispatch(fetchStockOuts());
    }
  }, [dispatch, authChecked, hasPermission]);

  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  const loadStockIns = useCallback(async () => {
    try {
      await dispatch(fetchStockIns()).unwrap();
    } catch {
      /* error in redux */
    }
  }, [dispatch]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/stock-in') {
        loadStockIns();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadStockIns]);

  const isDateInRange = useCallback((value) => {
    const date = value ? value.slice(0, 10) : '';
    if (filters.date_from && date < filters.date_from) return false;
    if (filters.date_to && date > filters.date_to) return false;
    return true;
  }, [filters.date_from, filters.date_to]);

  const isSumInRange = useCallback((doc) => {
    const total = getStockInLineTotal(doc);
    if (filters.min_sum && total < Number(filters.min_sum)) return false;
    if (filters.max_sum && total > Number(filters.max_sum)) return false;
    return true;
  }, [filters.min_sum, filters.max_sum]);

  const { storageOptions, creatorOptions } = useMemo(() => {
    const storages = new Map();
    const creators = new Map();
    (stockIns || []).forEach((doc) => {
      const location = doc.storage_location;
      if (location?.id) {
        storages.set(String(location.id), location.address || `Склад #${location.id}`);
      }
      if (doc.creator_name) {
        creators.set(doc.creator_name, doc.creator_name);
      }
    });
    return {
      storageOptions: [
        { value: '', label: 'Все склады' },
        ...Array.from(storages.entries())
          .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
          .map(([value, label]) => ({ value, label })),
      ],
      creatorOptions: [
        { value: '', label: 'Все сотрудники' },
        ...Array.from(creators.entries())
          .sort((a, b) => a[1].localeCompare(b[1], 'ru'))
          .map(([value, label]) => ({ value, label })),
      ],
    };
  }, [stockIns]);

  const displayStockIns = useMemo(() => {
    const list = (stockIns || [])
      .filter((doc) => matchesStockInSearch(doc, searchQuery))
      .filter((doc) => {
        if (!isDateInRange(doc.created_at)) return false;
        if (filters.storage && String(doc.storage_location?.id) !== String(filters.storage)) return false;
        if (filters.creator && doc.creator_name !== filters.creator) return false;
        if (!isSumInRange(doc)) return false;
        return true;
      });
    return sortStockInDocs(list, filters.sort);
  }, [stockIns, searchQuery, filters, isDateInRange, isSumInRange]);

  const stats = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    displayStockIns.forEach((doc) => {
      totalQty += Number(doc.quantity || 0);
      totalValue += getStockInLineTotal(doc);
    });
    return { count: displayStockIns.length, totalQty, totalValue };
  }, [displayStockIns]);

  const totalInList = stockIns.length;

  const handleOpenMediaModal = (mediaItems, initialIndex = 0) => {
    const formattedMedia = mediaItems.map((item) => {
      const url =
        typeof item === 'string' ? item : item.full_url || item.photo_url || item.video_url || '';
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

  const hasSearch = Boolean(searchQuery.trim()) || activeCount > 0;

  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  return (
    <div className={warehousePageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Поступления</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!loading && !error && totalInList > 0 && (
            <>
              <div className="grid w-full grid-cols-3 gap-2 rounded-xl bg-gray-50 px-3 py-2.5 ring-1 ring-gray-200/80 sm:hidden">
                <div className="text-center">
                  <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.count}</div>
                  <div className="text-[11px] text-gray-500">Документов</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.totalQty}</div>
                  <div className="text-[11px] text-gray-500">Принято, шт.</div>
                </div>
                <div className="text-center">
                  <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">
                    {formatStockInMoney(stats.totalValue)}
                  </div>
                  <div className="text-[11px] text-gray-500">На сумму</div>
                </div>
              </div>
              <div className="mr-1 hidden items-center gap-4 text-right sm:flex">
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.count}</div>
                <div className="text-[11px] text-gray-500">Документов</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.totalQty}</div>
                <div className="text-[11px] text-gray-500">Принято, шт.</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">
                  {formatStockInMoney(stats.totalValue)}
                </div>
                <div className="text-[11px] text-gray-500">На сумму</div>
              </div>
            </div>
            </>
          )}
          {canScanQr ? (
            <Link to="/warehouse/scan" className={warehouseSecondaryButtonClass}>
              Сканировать QR
            </Link>
          ) : null}
          <Link to="/my-parts" className={warehousePrimaryButtonClass}>
            Мои запчасти
          </Link>
        </div>
      </div>

      <PageFiltersPanel
        activeFilterCount={activeCount + (searchQuery.trim() ? 1 : 0)}
        searchComponent={
          <div className="relative min-w-0 flex-1 rounded-full transition focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-400/70">
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Бренд, артикул, название, ответственный…"
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
        }
        filters={[
          {
            key: 'storage',
            label: 'Склад',
            placeholder: 'Все склады',
            value: filters.storage,
            options: storageOptions,
            onChange: (value) => updateFilter('storage', value),
          },
          {
            key: 'creator',
            label: 'Ответственный',
            placeholder: 'Все сотрудники',
            value: filters.creator,
            options: creatorOptions,
            onChange: (value) => updateFilter('creator', value),
          },
        ]}
        sortOptions={STOCK_IN_SORT_OPTIONS.map((o) => ({ value: o.id, label: o.label }))}
        sortValue={filters.sort}
        onSortChange={(value) => updateFilter('sort', value)}
      >
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
          <input
            type="date"
            value={filters.date_from}
            onChange={(e) => updateFilter('date_from', e.target.value)}
            placeholder="Дата с"
            className={warehousePillControlClass}
          />
          <input
            type="date"
            value={filters.date_to}
            onChange={(e) => updateFilter('date_to', e.target.value)}
            placeholder="Дата по"
            className={warehousePillControlClass}
          />
          <input
            type="number"
            value={filters.min_sum}
            onChange={(e) => updateFilter('min_sum', e.target.value)}
            placeholder="Сумма от"
            className={warehousePillControlClass}
          />
          <input
            type="number"
            value={filters.max_sum}
            onChange={(e) => updateFilter('max_sum', e.target.value)}
            placeholder="Сумма до"
            className={warehousePillControlClass}
          />
        </div>
      </PageFiltersPanel>

      {loading && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <AuthLoadingScreen className="h-24" />
          <p className="mt-4 text-sm text-gray-500">Загружаем документы…</p>
        </div>
      )}

      {error && !loading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button type="button" onClick={() => loadStockIns()} className={`mt-4 ${warehousePrimaryButtonClass}`}>
            Попробовать снова
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {totalInList > 0 && displayStockIns.length !== totalInList && (
            <p className="mb-3 text-sm text-gray-500">
              Показано {displayStockIns.length} из {totalInList} документов
            </p>
          )}

          {displayStockIns.length > 0 ? (
            <>
              <div className={autoserviceListTableWrapClass}>
                <table className={autoserviceListTableClass}>
                  <thead>
                    <tr className={autoserviceListTheadRowClass}>
                      <th className={`w-24 ${autoserviceListThClass}`}>Дата</th>
                      <th className={`min-w-0 ${autoserviceListThClass}`}>Наименование</th>
                      <th className={`w-20 ${autoserviceListThRightClass}`}>Кол-во</th>
                      <th className={`w-24 ${autoserviceListThRightClass}`}>Цена</th>
                      <th className={`w-24 ${autoserviceListThRightClass}`}>Сумма</th>
                    </tr>
                  </thead>
                  <tbody className={autoserviceListTbodyClass}>
                    {displayStockIns.map((doc) => {
                      const product = doc.product || {};
                      const title = [product.brand, product.article, product.name].filter(Boolean).join(' · ') || '—';
                      return (
                        <tr key={doc.id} className={autoserviceListTrClickableClass} onClick={() => setViewStockIn(doc)}>
                          <td className={`${autoserviceListTdClass} whitespace-nowrap text-ink-muted`}>{new Date(doc.created_at).toLocaleDateString('ru-RU')}</td>
                          <td className={`min-w-0 ${autoserviceListTdClass}`}>
                            <div className="w-0 min-w-full truncate text-ink" title={title}>
                              {title}
                            </div>
                          </td>
                          <td className={`${autoserviceListTdRightClass} tabular-nums`}>{doc.quantity} шт.</td>
                          <td className={`${autoserviceListTdRightClass} tabular-nums`}>{formatStockInMoney(doc.sale_price)}</td>
                          <td className={`${autoserviceListTdRightClass} tabular-nums font-semibold`}>{formatStockInMoney(getStockInLineTotal(doc))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={autoserviceListMobileWrapClass}>
                {displayStockIns.map((doc) => {
                  const product = doc.product || {};
                  const title = [product.brand, product.article, product.name].filter(Boolean).join(' · ') || '—';
                  return (
                    <button key={doc.id} type="button" onClick={() => setViewStockIn(doc)} className="w-full border-b border-line-soft py-2 text-left last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="truncate font-medium text-ink" title={title}>{title}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatStockInMoney(getStockInLineTotal(doc))}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{new Date(doc.created_at).toLocaleDateString('ru-RU')} · {doc.quantity} шт.</p>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <StockInEmptyState hasSearch={hasSearch} />
          )}
        </>
      )}

      <SellerStockMovementModal
        row={viewStockIn}
        type="in"
        stockIns={stockIns}
        stockOuts={stockOuts}
        onClose={() => setViewStockIn(null)}
        onImageClick={handleOpenMediaModal}
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

export default StockInList;
