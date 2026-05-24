import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { fetchWarehouseSales } from '../../redux/slices/StockOutSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import WarehouseSaleCard from '../../components/WarehouseSales/WarehouseSaleCard';
import WarehouseSalesEmptyState from '../../components/WarehouseSales/WarehouseSalesEmptyState';
import {
  formatWarehouseMoney,
  matchesSaleSourceFilter,
  SALE_SOURCE_FILTERS,
} from '../../utils/warehouseSaleUi';

const WarehouseSalesPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { salesItems, salesLoading, error } = useSelector((state) => state.stockOut);
  const { storageLocations } = useSelector((state) => state.organization);
  const { user, permissionCodes } = useSelector((state) => state.auth);

  const [expandedSaleId, setExpandedSaleId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [authChecked, setAuthChecked] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee && permissionCodes && permissionCodes.includes('warehouse-sales'));

  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) {
      navigate('/', { replace: true });
    }
  }, [user, permissionCodes, hasPermission, navigate]);

  const loadSales = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        await dispatch(fetchWarehouseSales()).unwrap();
      } catch {
        /* error in redux */
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [dispatch]
  );

  useEffect(() => {
    if (hasPermission && (user?.is_seller || user?.is_employee) && user.organization_id) {
      loadSales();
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, user, hasPermission, loadSales]);

  const getStorageAddress = useCallback(
    (locationId) => {
      if (!locationId) return '—';
      const loc = storageLocations.find((l) => l.id === locationId);
      return loc ? loc.address || `Склад #${locationId}` : `Склад #${locationId}`;
    },
    [storageLocations]
  );

  const filteredSales = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/\s+/g, '');
    return salesItems.filter((sale) => {
      if (!matchesSaleSourceFilter(sale, sourceFilter)) return false;
      if (!q) return true;
      const product = sale.product || {};
      return (
        (product.article && product.article.toLowerCase().replace(/\s+/g, '').includes(q)) ||
        (product.internal_code && product.internal_code.toLowerCase().replace(/\s+/g, '').includes(q)) ||
        (product.name && product.name.toLowerCase().includes(q)) ||
        (product.brand && product.brand.toLowerCase().includes(q))
      );
    });
  }, [salesItems, searchQuery, sourceFilter]);

  const stats = useMemo(() => {
    let totalRevenue = 0;
    let totalQuantity = 0;
    filteredSales.forEach((sale) => {
      const qty = Number(sale.quantity || 0);
      const price = Number(sale.sale_price || 0);
      totalQuantity += qty;
      totalRevenue += price * qty;
    });
    return { count: filteredSales.length, totalRevenue, totalQuantity };
  }, [filteredSales]);

  const toggleExpand = (id) => {
    setExpandedSaleId((prev) => (prev === id ? null : id));
  };

  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  const totalInList = salesItems.length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || sourceFilter !== 'all';

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white via-white to-amber-50/80 p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-amber-400/15 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Продажи</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">
              Продажи со склада
            </h1>
            <p className="mt-2 max-w-xl text-sm text-gray-600">
              Фактические продажи после списания: ручные продажи, Авито и заказы с сайта. Активные заказы
              Авито — в разделе «Заказы».
            </p>
          </div>
          <button
            type="button"
            onClick={() => loadSales(true)}
            disabled={salesLoading || refreshing}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:opacity-60"
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
        </div>

        {!salesLoading && !error && (
          <dl className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Записей</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{stats.count}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Продано, шт.</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-amber-700">{stats.totalQuantity}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Выручка</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">
                {formatWarehouseMoney(stats.totalRevenue)}
              </dd>
            </div>
          </dl>
        )}
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-1 shadow-sm">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="relative min-w-0 flex-1">
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
              placeholder="Артикул, код, название, бренд…"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-amber-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500/20"
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
          {SALE_SOURCE_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSourceFilter(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sourceFilter === opt.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {salesLoading && (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
          <AuthLoadingScreen className="h-24" />
          <p className="mt-4 text-sm text-gray-600">Загружаем продажи…</p>
        </div>
      )}

      {error && !salesLoading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">
            {typeof error === 'object' ? JSON.stringify(error) : error}
          </p>
          <button
            type="button"
            onClick={() => loadSales()}
            className="mt-4 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {!salesLoading && !error && (
        <>
          {totalInList > 0 && filteredSales.length !== totalInList && (
            <p className="text-sm text-gray-500">
              Показано {filteredSales.length} из {totalInList} записей
              {hasActiveFilters ? ' (с учётом фильтров)' : ''}
            </p>
          )}

          <div className="space-y-4">
            {filteredSales.map((sale) => (
              <WarehouseSaleCard
                key={sale.id}
                sale={sale}
                isExpanded={expandedSaleId === sale.id}
                onToggle={toggleExpand}
                storageAddress={getStorageAddress(sale.storage_location_id)}
              />
            ))}
          </div>

          {filteredSales.length === 0 && (
            <WarehouseSalesEmptyState hasSearch={hasActiveFilters} searchQuery={searchQuery.trim()} />
          )}
        </>
      )}
    </div>
  );
};

export default WarehouseSalesPage;
