import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchVehicles } from '../../redux/slices/ProductSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import VehicleCard, { VehiclesEmptyState } from '../../components/Vehicles/VehicleCard';
import PillDropdown from '../../components/PillDropdown/PillDropdown';
import {
  mapIdOptionsForPillDropdown,
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

const SORT_OPTIONS = [
  { id: 'brand_asc', label: 'Марка А–Я' },
  { id: 'brand_desc', label: 'Марка Я–А' },
];

function VehiclesList() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const { vehicles, vehiclesLoading, error } = useSelector((state) => state.products);
  const { storageLocations } = useSelector((state) => state.organization);

  const [authChecked, setAuthChecked] = useState(false);
  const [expandedId, setExpandedId] = useState(null);
  const [sortOrder, setSortOrder] = useState('brand_asc');
  const [refreshing, setRefreshing] = useState(false);
  const [selectedStorageLocation, setSelectedStorageLocation] = useState(
    () => searchParams.get('storage') || ''
  );
  const [searchQuery, setSearchQuery] = useState(() => searchParams.get('q') || '');
  const [openFilterDropdown, setOpenFilterDropdown] = useState(null);

  const hasPermission =
    user?.is_admin ||
    user?.is_seller ||
    (user?.is_employee &&
      permissionCodes &&
      (permissionCodes.includes('vehicles') ||
        permissionCodes.includes('my-parts') ||
        permissionCodes.includes('stock-in')));

  const fetchParams = useMemo(
    () => (selectedStorageLocation ? { storage_location_id: selectedStorageLocation } : {}),
    [selectedStorageLocation]
  );

  const loadVehicles = useCallback(
    async (isRefresh = false) => {
      if (isRefresh) setRefreshing(true);
      try {
        await dispatch(fetchVehicles(fetchParams)).unwrap();
      } catch {
        /* error in redux */
      } finally {
        if (isRefresh) setRefreshing(false);
      }
    },
    [dispatch, fetchParams]
  );

  useEffect(() => {
    if (authChecked && hasPermission) {
      loadVehicles();
    }
  }, [authChecked, hasPermission, loadVehicles]);

  useEffect(() => {
    if (authChecked && hasPermission && user?.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
    }
  }, [dispatch, authChecked, hasPermission, user?.organization_id]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (selectedStorageLocation) next.set('storage', selectedStorageLocation);
    const q = searchQuery.trim();
    if (q) next.set('q', q);
    setSearchParams(next);
  }, [selectedStorageLocation, searchQuery, setSearchParams]);

  useEffect(() => {
    if (user === undefined || user === null) {
      const token = localStorage.getItem('token');
      if (token) return;
    }
    setAuthChecked(true);
    if (!hasPermission) navigate('/', { replace: true });
  }, [user, permissionCodes, hasPermission, navigate]);

  const sortedVehicles = useMemo(() => {
    const list = Array.isArray(vehicles) ? [...vehicles] : [];
    const key = (v) =>
      `${(v.brand || '').toLowerCase()}\0${(v.model || '').toLowerCase()}\0${(v.generation || '').toLowerCase()}`;
    list.sort((a, b) => {
      const cmp = key(a).localeCompare(key(b), 'ru');
      return sortOrder === 'brand_desc' ? -cmp : cmp;
    });
    return list;
  }, [vehicles, sortOrder]);

  const displayVehicles = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return sortedVehicles;
    return sortedVehicles.filter((v) => {
      const hay = [
        v.brand,
        v.model,
        v.generation,
        v.engine,
        v.vin,
        v.description,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [sortedVehicles, searchQuery]);

  const stats = useMemo(() => {
    const brands = new Set(displayVehicles.map((v) => (v.brand || '').trim()).filter(Boolean));
    return { count: displayVehicles.length, brands: brands.size };
  }, [displayVehicles]);

  const getStorageLabel = useCallback(
    (id) => {
      if (id == null || id === '') return null;
      const loc = storageLocations.find((l) => String(l.id) === String(id));
      return loc?.address || `Склад #${id}`;
    },
    [storageLocations]
  );

  const toggleExpand = (id) => {
    setExpandedId((prev) => (prev === id ? null : id));
  };

  const storageFilterOptions = useMemo(
    () => [
      { value: '', label: 'Склад' },
      ...storageLocations.map((location) => ({
        value: String(location.id),
        label: location.address || `Склад #${location.id}`,
      })),
    ],
    [storageLocations],
  );

  const sortFilterOptions = useMemo(() => mapIdOptionsForPillDropdown(SORT_OPTIONS), []);

  const setFilterDropdownOpen = (key) => (open) => {
    setOpenFilterDropdown(open ? key : null);
  };

  const totalInList = sortedVehicles.length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || Boolean(selectedStorageLocation);

  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  return (
    <div className={warehousePageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 sm:text-[1.75rem]">Автомобили</h1>
          <p className="mt-1 text-sm text-gray-500">
            Учёт автомобилей на складах для разборки и привязки запчастей
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          {!vehiclesLoading && !error && totalInList > 0 && (
            <div className="mr-1 hidden items-center gap-4 text-right sm:flex">
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.count}</div>
                <div className="text-[11px] text-gray-500">Автомобилей</div>
              </div>
              <div>
                <div className="text-base font-bold tabular-nums text-gray-900 leading-tight">{stats.brands}</div>
                <div className="text-[11px] text-gray-500">Марок</div>
              </div>
            </div>
          )}
          <button
            type="button"
            onClick={() => loadVehicles(true)}
            disabled={vehiclesLoading || refreshing}
            className={warehouseSecondaryButtonClass}
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
          <button type="button" onClick={() => navigate('/vehicles/add')} className={warehousePrimaryButtonClass}>
            Добавить автомобиль
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
              placeholder="Марка, модель, поколение, VIN…"
              autoComplete="off"
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
          <div className="w-full sm:w-64">
            <PillDropdown
              ariaLabel="Склад"
              placeholder="Склад"
              value={selectedStorageLocation ? String(selectedStorageLocation) : ''}
              options={storageFilterOptions}
              isOpen={openFilterDropdown === 'storage'}
              onOpenChange={setFilterDropdownOpen('storage')}
              onChange={(nextValue) => setSelectedStorageLocation(nextValue)}
            />
          </div>
        </div>

        <div className={warehouseToolbarClass}>
          <PillDropdown
            ariaLabel="Сортировка"
            placeholder="Марка А–Я"
            value={sortOrder}
            options={sortFilterOptions}
            isOpen={openFilterDropdown === 'sort'}
            onOpenChange={setFilterDropdownOpen('sort')}
            onChange={setSortOrder}
            fullWidth={false}
            triggerClassName="h-9 rounded-xl bg-white px-3 ring-1 ring-gray-200 hover:bg-gray-50"
            menuClassName="min-w-[12rem]"
          />
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => {
                setSearchQuery('');
                setSelectedStorageLocation('');
              }}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline"
            >
              <span aria-hidden>×</span>
              Сбросить фильтры
            </button>
          )}
        </div>

        {!vehiclesLoading && !error && totalInList > 0 && (
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm sm:hidden">
            <span className="font-semibold tabular-nums text-gray-900">{stats.count} авто</span>
            <span className="tabular-nums text-gray-500">{stats.brands} марок</span>
          </div>
        )}
      </div>

      {vehiclesLoading && (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center">
          <AuthLoadingScreen className="h-24" />
          <p className="mt-4 text-sm text-gray-500">Загружаем автомобили…</p>
        </div>
      )}

      {error && !vehiclesLoading && (
        <div className="rounded-xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button type="button" onClick={() => loadVehicles()} className={`mt-4 ${warehousePrimaryButtonClass}`}>
            Попробовать снова
          </button>
        </div>
      )}

      {!vehiclesLoading && !error && (
        <>
          {totalInList > 0 && displayVehicles.length !== totalInList && (
            <p className="mb-3 text-sm text-gray-500">
              Показано {displayVehicles.length} из {totalInList} автомобилей
              {hasActiveFilters ? ' (с учётом фильтров)' : ''}
            </p>
          )}

          {displayVehicles.length > 0 ? (
            <div className="space-y-4">
              {displayVehicles.map((v) => (
                <VehicleCard
                  key={v.id}
                  vehicle={v}
                  storageLabel={getStorageLabel(v.storage_location_id)}
                  isExpanded={expandedId === v.id}
                  onToggle={toggleExpand}
                />
              ))}
            </div>
          ) : (
            <VehiclesEmptyState
              searchQuery={searchQuery}
              hasStorageFilter={Boolean(selectedStorageLocation)}
              onAdd={() => navigate('/vehicles/add')}
            />
          )}
        </>
      )}
    </div>
  );
}

export default VehiclesList;
