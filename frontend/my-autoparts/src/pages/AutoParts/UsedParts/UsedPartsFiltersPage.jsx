import React, { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { selectSearchQuery } from '../../../redux/slices/RosskoSlice';
import {
  searchUsedParts,
  fetchCatalogProducts,
  fetchCatalogFacets,
  fetchPublicPartTypes,
} from '../../../redux/slices/ProductSlice';
import { fetchCart } from '../../../redux/slices/CartSlice';
import UsedPartsFiltersForm from './UsedPartsFiltersForm';
import { usedHasActiveFilters } from '../../../utils/autopartsFilters';
import { Z_MOBILE_STICKY_FOOTER } from '../../../constants/mobileTokens';

export default function UsedPartsFiltersPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const searchQuery = useSelector(selectSearchQuery);

  const updateCatalogUrl = useCallback((updates) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      params.delete(key);
      if (value === null || value === undefined || value === '') {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (item !== null && item !== undefined && item !== '') {
            params.append(key, String(item));
          }
        });
      } else {
        params.set(key, String(value));
      }
    });
    const qs = params.toString();
    navigate(`/autoparts/used/filters${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate]);

  const clearFilters = useCallback(() => {
    updateCatalogUrl({
      part_type: null,
      brand: null,
      vmin: null,
      vmax: null,
      vb: null,
      vm: null,
      vehicle_id: null,
      has_photos: null,
      page: 1,
    });
  }, [updateCatalogUrl]);

  const goToResults = useCallback(() => {
    const qs = searchParams.toString();
    navigate(`/autoparts/used${qs ? `?${qs}` : ''}`);
  }, [navigate, searchParams]);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  useEffect(() => {
    dispatch(fetchCatalogFacets({ is_new: false }));
    dispatch(fetchPublicPartTypes());

    const trimmed = (searchQuery || '').trim();
    if (trimmed) {
      dispatch(searchUsedParts(trimmed));
      return;
    }

    const params = {
      page: parseInt(searchParams.get('page') || '1', 10),
      page_size: 20,
      sort: searchParams.get('sort') || 'created_at_desc',
      is_new: false,
    };
    const partTypes = searchParams.getAll('part_type').map((value) => parseInt(value, 10)).filter(Number.isFinite);
    if (partTypes.length) params.part_type_id = partTypes;
    const brands = searchParams.getAll('brand').filter(Boolean);
    if (brands.length) params.brand = brands;
    const vmin = searchParams.get('vmin');
    if (vmin) params.price_min = parseFloat(vmin);
    const vmax = searchParams.get('vmax');
    if (vmax) params.price_max = parseFloat(vmax);
    const vehicleBrands = searchParams.getAll('vb').filter(Boolean);
    if (vehicleBrands.length) params.vehicle_brand = vehicleBrands;
    const vehicleModels = searchParams.getAll('vm').filter(Boolean);
    if (vehicleModels.length) params.vehicle_model = vehicleModels;
    const vehicleId = searchParams.get('vehicle_id');
    if (vehicleId) params.vehicle_id = parseInt(vehicleId, 10);
    if (searchParams.get('has_photos') === '1') params.has_photos = true;

    dispatch(fetchCatalogProducts(params));
  }, [searchQuery, searchParams, dispatch]);

  const hasFilters = usedHasActiveFilters(searchParams);

  return (
    <div className="mt-0 w-full px-0 pb-40 sm:pb-8">
      <div className="px-3 sm:px-0">
        <h1 className="text-lg font-semibold text-gray-900 mb-3 md:hidden">Фильтры</h1>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900 mb-3 hidden md:block">Фильтры</h2>
          <UsedPartsFiltersForm updateCatalogUrl={updateCatalogUrl} showClearInPanel={false} />
        </div>
      </div>

      <div
        className="md:hidden fixed inset-x-0 border-t border-gray-200 bg-white/95 px-3 pt-2 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-[0_-6px_24px_rgba(0,0,0,0.06)]"
        style={{
          zIndex: Z_MOBILE_STICKY_FOOTER,
          bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))',
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom))',
        }}
      >
        <div className="mx-auto flex max-w-4xl flex-col gap-2">
          {hasFilters ? (
            <button
              type="button"
              onClick={clearFilters}
              className="min-h-11 w-full rounded-lg border border-gray-300 px-3 text-base font-medium text-gray-800 active:bg-gray-50"
            >
              Сбросить фильтры
            </button>
          ) : null}
          <button
            type="button"
            onClick={goToResults}
            className="min-h-11 w-full rounded-lg bg-indigo-600 px-4 text-base font-semibold text-white active:bg-indigo-700"
          >
            Показать товары
          </button>
        </div>
      </div>
    </div>
  );
}
