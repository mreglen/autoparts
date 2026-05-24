import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { fetchVehicles } from '../../redux/slices/ProductSlice';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import VehicleCard, { VehiclesEmptyState } from '../../components/Vehicles/VehicleCard';

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

  if (!authChecked) {
    return <AuthLoadingScreen />;
  }

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasPermission) return <Navigate to="/" replace />;

  const totalInList = sortedVehicles.length;
  const hasActiveFilters = Boolean(searchQuery.trim()) || Boolean(selectedStorageLocation);

  return (
    <div className="min-w-0 space-y-6">
      <header className="relative overflow-hidden rounded-2xl border border-white/80 bg-gradient-to-br from-white via-white to-slate-100/90 p-5 shadow-sm ring-1 ring-gray-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-slate-400/10 blur-2xl" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-600">Склад</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Автомобили</h1>
            <p className="mt-2 max-w-xl text-sm text-gray-600">
              Учёт автомобилей на складах: привязка к запчастям, VIN, пробег и описание для разборки.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              type="button"
              onClick={() => loadVehicles(true)}
              disabled={vehiclesLoading || refreshing}
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
              onClick={() => navigate('/vehicles/add')}
              className="inline-flex items-center justify-center rounded-xl bg-slate-800 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-900"
            >
              Добавить автомобиль
            </button>
          </div>
        </div>

        {!vehiclesLoading && !error && totalInList > 0 && (
          <dl className="relative mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Автомобилей</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{stats.count}</dd>
            </div>
            <div className="rounded-xl border border-gray-100 bg-white/80 px-4 py-3 backdrop-blur-sm">
              <dt className="text-xs font-medium text-gray-500">Марок</dt>
              <dd className="mt-1 text-2xl font-bold tabular-nums text-slate-700">{stats.brands}</dd>
            </div>
          </dl>
        )}
      </header>

      <div className="rounded-2xl border border-gray-200/80 bg-white p-1 shadow-sm">
        <div className="flex flex-col gap-3 p-3 lg:flex-row lg:items-end">
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
              placeholder="Марка, модель, поколение, VIN…"
              autoComplete="off"
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20"
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

          <div className="w-full lg:w-56">
            <label htmlFor="vehicles-storage-filter" className="sr-only">
              Склад
            </label>
            <select
              id="vehicles-storage-filter"
              value={selectedStorageLocation}
              onChange={(e) => setSelectedStorageLocation(e.target.value)}
              className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 px-3 text-sm text-gray-900 focus:border-slate-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-500/20"
            >
              <option value="">Все склады</option>
              {storageLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.address}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-t border-gray-100 px-3 py-3">
          {SORT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              onClick={() => setSortOrder(opt.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                sortOrder === opt.id
                  ? 'bg-gray-900 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {vehiclesLoading && (
        <div className="rounded-2xl border border-gray-200 bg-white py-16 text-center">
          <AuthLoadingScreen className="h-24" />
          <p className="mt-4 text-sm text-gray-600">Загружаем автомобили…</p>
        </div>
      )}

      {error && !vehiclesLoading && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-5 py-8 text-center">
          <p className="text-sm font-medium text-red-800">{error}</p>
          <button
            type="button"
            onClick={() => loadVehicles()}
            className="mt-4 inline-flex rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700"
          >
            Попробовать снова
          </button>
        </div>
      )}

      {!vehiclesLoading && !error && (
        <>
          {totalInList > 0 && displayVehicles.length !== totalInList && (
            <p className="text-sm text-gray-500">
              Показано {displayVehicles.length} из {totalInList} автомобилей
              {hasActiveFilters ? ' (с учётом фильтров)' : ''}
            </p>
          )}

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

          {displayVehicles.length === 0 && (
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
