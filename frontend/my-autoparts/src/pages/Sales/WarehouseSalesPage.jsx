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
import {
  warehousePageClass,
  warehousePillControlClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

const sourceFilterButtonClass = (active) =>
  `inline-flex h-9 shrink-0 items-center rounded-full px-4 text-sm font-medium transition ${
    active
      ? 'bg-white text-gray-900 shadow-sm ring-1 ring-gray-200'
      : 'text-gray-600 hover:bg-white/60 hover:text-gray-900'
  }`;

function WarehouseSalesHeaderStats({ stats, formatPrice }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:flex sm:shrink-0 sm:gap-8">
      <div className="text-center">
        <div className="text-2xl font-bold tabular-nums text-gray-900 leading-none sm:text-[1.75rem]">{stats.count}</div>
        <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Записей</div>
      </div>
      <div className="text-center">
        <div className="text-2xl font-bold tabular-nums text-indigo-600 leading-none sm:text-[1.75rem]">{stats.totalQuantity}</div>
        <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Продано, шт.</div>
      </div>
      <div className="text-center">
        <div className="text-xl font-bold tabular-nums text-gray-900 leading-none sm:text-[1.75rem]">{formatPrice(stats.totalRevenue)}</div>
        <div className="mt-1.5 text-xs text-gray-500 sm:text-sm">Выручка</div>
      </div>
    </div>
  );
}

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

  const loadSales = useCallback(async () => {
    try {
      await dispatch(fetchWarehouseSales()).unwrap();
    } catch {
      /* error in redux */
    }
  }, [dispatch]);

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
    salesItems.forEach((sale) => {
      const qty = Number(sale.quantity || 0);
      const price = Number(sale.sale_price || 0);
      totalQuantity += qty;
      totalRevenue += price * qty;
    });
    return { count: salesItems.length, totalRevenue, totalQuantity };
  }, [salesItems]);

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
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Продажи со склада</h1>
        {!salesLoading && !error ? (
          <WarehouseSalesHeaderStats stats={stats} formatPrice={formatWarehouseMoney} />
        ) : null}
      </div>

      <div className="space-y-3">
        <div className="relative min-w-0 rounded-full transition focus-within:bg-white focus-within:ring-2 focus-within:ring-indigo-400/70">
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Артикул, код, название, бренд…"
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

        <div className={warehouseToolbarClass} aria-label="Фильтр по источнику">
          {SALE_SOURCE_FILTERS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSourceFilter(opt.id)}
              className={sourceFilterButtonClass(sourceFilter === opt.id)}
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
