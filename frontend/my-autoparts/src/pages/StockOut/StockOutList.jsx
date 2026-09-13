import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, Link } from 'react-router-dom';
import { fetchStockOuts, createReturn } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { fetchMyProducts } from '../../redux/slices/ProductSlice';
import { fetchStockIns } from '../../redux/slices/StockInSlice';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import StockOutEmptyState from '../../components/StockOut/StockOutEmptyState';
import SellerStockMovementModal from '../../components/SellerWarehouse/SellerStockMovementModal';
import MediaModal from '../../components/MediaModal/MediaModal';
import ReturnModal from './ReturnModal';
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
import {
  formatStockOutMoney,
  getStockOutLineTotal,
  matchesStockOutSearch,
} from '../../utils/stockOutUi';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';

export const StockOutList = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { items: stockOuts, loading, error } = useSelector((state) => state.stockOut);
  const { items: stockIns } = useSelector((state) => state.stockIn);
  const { storageLocations } = useSelector((state) => state.organization);
  const { user, permissionCodes } = useSelector((state) => state.auth);

  const [authChecked, setAuthChecked] = useState(false);
  const [viewStockOut, setViewStockOut] = useState(null);
  const [returnModalOpen, setReturnModalOpen] = useState(false);
  const [itemsToReturn, setItemsToReturn] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');

  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [currentMediaItems, setCurrentMediaItems] = useState([]);
  const [currentMediaIndex, setCurrentMediaIndex] = useState(0);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee && permissionCodes && permissionCodes.includes('stock-out'));
  const canScanQr = userHasWarehouseQrAccess(user, permissionCodes);

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
      dispatch(fetchStockIns());
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user, authChecked, hasPermission, loadStockOuts]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/stock-out') {
        loadStockOuts();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadStockOuts]);

  const displayStockOuts = useMemo(
    () => stockOuts.filter((item) => matchesStockOutSearch(item, searchQuery)),
    [stockOuts, searchQuery]
  );

  const totalInList = stockOuts.length;

  const getStorageAddress = useCallback(
    (locationId) => {
      if (!locationId) return '—';
      const loc = storageLocations.find((l) => l.id === locationId);
      return loc ? loc.address || `Склад #${locationId}` : `Склад #${locationId}`;
    },
    [storageLocations]
  );

  const handleReturnItem = (item) => {
    setItemsToReturn([item]);
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
    } catch (err) {
      console.error('Ошибка при возврате:', err);
    }
  };

  const handleRemoveItemFromReturn = (itemId) => {
    setItemsToReturn((prev) => prev.filter((item) => item.id !== itemId));
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
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Расходы</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!loading && !error && totalInList > 0 && (
            <div className="mr-1 hidden items-center gap-4 text-right sm:flex">
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{totalInList}</div>
                <div className="text-[11px] text-gray-500">Записей</div>
              </div>
            </div>
          )}
          {canScanQr ? (
            <Link to="/warehouse/scan" className={warehouseSecondaryButtonClass}>
              Сканировать QR
            </Link>
          ) : null}
          <button type="button" onClick={() => navigate('/my-parts')} className={warehousePrimaryButtonClass}>
            Мои запчасти
          </button>
        </div>
      </div>

      <div className="mb-4 space-y-3">
        <div className="relative min-w-0 rounded-full transition focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-400/70">
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

        {hasSearch && (
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
            >
              <span aria-hidden>×</span>
              Сбросить поиск
            </button>
          </div>
        )}
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
            </p>
          )}

          {displayStockOuts.length > 0 ? (
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
                    {displayStockOuts.map((item) => {
                      const product = item.product || {};
                      const title = [product.brand, product.article, product.name].filter(Boolean).join(' · ') || '—';
                      return (
                        <tr key={item.id} className={autoserviceListTrClickableClass} onClick={() => setViewStockOut(item)}>
                          <td className={`${autoserviceListTdClass} whitespace-nowrap text-ink-muted`}>{new Date(item.movement_date).toLocaleDateString('ru-RU')}</td>
                          <td className={`min-w-0 ${autoserviceListTdClass}`}>
                            <div className="w-0 min-w-full truncate text-ink" title={title}>
                              {title}
                            </div>
                          </td>
                          <td className={`${autoserviceListTdRightClass} tabular-nums`}>{item.quantity} шт.</td>
                          <td className={`${autoserviceListTdRightClass} tabular-nums`}>{formatStockOutMoney(item.sale_price)}</td>
                          <td className={`${autoserviceListTdRightClass} tabular-nums font-semibold`}>{formatStockOutMoney(getStockOutLineTotal(item))}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className={autoserviceListMobileWrapClass}>
                {displayStockOuts.map((item) => {
                  const product = item.product || {};
                  const title = [product.brand, product.article, product.name].filter(Boolean).join(' · ') || '—';
                  return (
                    <button key={item.id} type="button" onClick={() => setViewStockOut(item)} className="w-full border-b border-line-soft py-2 text-left last:border-0">
                      <div className="flex justify-between gap-2">
                        <span className="truncate font-medium text-ink" title={title}>{title}</span>
                        <span className="shrink-0 font-semibold tabular-nums">{formatStockOutMoney(getStockOutLineTotal(item))}</span>
                      </div>
                      <p className="mt-1 text-xs text-ink-muted">{new Date(item.movement_date).toLocaleDateString('ru-RU')} · {item.quantity} шт.</p>
                    </button>
                  );
                })}
              </div>
            </>
          ) : (
            <StockOutEmptyState hasSearch={hasSearch || totalInList > 0} />
          )}
        </>
      )}

      <SellerStockMovementModal
        row={viewStockOut}
        type="out"
        stockIns={stockIns}
        stockOuts={stockOuts}
        onClose={() => setViewStockOut(null)}
        onImageClick={handleOpenMediaModal}
        onReturn={(item) => {
          setViewStockOut(null);
          handleReturnItem(item);
        }}
      />

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
