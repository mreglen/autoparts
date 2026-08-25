import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import MediaModal from '../../components/MediaModal/MediaModal';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import StockInCard from '../../components/StockIn/StockInCard';
import StockInEmptyState from '../../components/StockIn/StockInEmptyState';
import PillDropdown from '../../components/PillDropdown/PillDropdown';
import {
  mapIdOptionsForPillDropdown,
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';
import { userHasWarehouseQrAccess } from '../../hooks/useWarehousePermissions';
import { normalizeImageUrl } from '../../utils/apiClient';
import { fetchStockIns } from '../../redux/slices/StockInSlice';
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

  const [authChecked, setAuthChecked] = useState(false);
  const [expandedDocId, setExpandedDocId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sortOrder, setSortOrder] = useState('date_desc');
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

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

  const sortedStockIns = useMemo(
    () => sortStockInDocs(stockIns, sortOrder),
    [stockIns, sortOrder]
  );

  const displayStockIns = useMemo(
    () => sortedStockIns.filter((doc) => matchesStockInSearch(doc, searchQuery)),
    [sortedStockIns, searchQuery]
  );

  const stats = useMemo(() => {
    let totalQty = 0;
    let totalValue = 0;
    displayStockIns.forEach((doc) => {
      totalQty += Number(doc.quantity || 0);
      totalValue += getStockInLineTotal(doc);
    });
    return { count: displayStockIns.length, totalQty, totalValue };
  }, [displayStockIns]);

  const toggleExpand = (id) => {
    setExpandedDocId((prev) => (prev === id ? null : id));
  };

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

  const sortFilterOptions = useMemo(
    () => mapIdOptionsForPillDropdown(STOCK_IN_SORT_OPTIONS),
    [],
  );

  const setFilterDropdownOpen = (key) => (open) => {
    setOpenFilterDropdown(open ? key : null);
  };

  const totalInList = sortedStockIns.length;
  const hasSearch = Boolean(searchQuery.trim());

  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  return (
    <div className={warehousePageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Документы поступления</h1>
          <p className="mt-1 text-sm text-gray-500">История оприходования запчастей на склад</p>
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

      <div className="mb-4 space-y-3">
        <div className="relative min-w-0 rounded-full transition focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-400/70">
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

        <div className={warehouseToolbarClass}>
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
          {hasSearch && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
            >
              <span aria-hidden>×</span>
              Сбросить поиск
            </button>
          )}
        </div>
      </div>

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
            <div className="space-y-4">
              {displayStockIns.map((doc) => (
                <StockInCard
                  key={doc.id}
                  doc={doc}
                  isExpanded={expandedDocId === doc.id}
                  onToggle={toggleExpand}
                  onImageClick={handleOpenMediaModal}
                />
              ))}
            </div>
          ) : (
            <StockInEmptyState hasSearch={hasSearch} />
          )}
        </>
      )}

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
