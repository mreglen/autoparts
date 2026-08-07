import React, { useCallback, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  fetchCatalogProducts,
  fetchCatalogFacets,
  fetchPublicPartTypes,
  resetCatalogCatalog,
} from '../../../redux/slices/ProductSlice';
import { fetchCart } from '../../../redux/slices/CartSlice';
import UsedPartsFiltersForm from './UsedPartsFiltersForm';
import { usedHasActiveFilters } from '../../../utils/autopartsFilters';
import { buildUsedCatalogParams } from '../../../utils/autopartsPublic';
import { Z_MOBILE_STICKY_FOOTER } from '../../../constants/mobileTokens';
import {
  autopartsFilterPanelClass,
  autopartsFilterPrimaryButtonClass,
  autopartsFilterSecondaryButtonClass,
  autopartsFilterTitleClass,
} from '../../../utils/autopartsFilterUi';

export default function UsedPartsFiltersPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const updateCatalogUrl = useCallback((updates) => {
    const params = new URLSearchParams(searchParams);
    params.delete('page');
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
      sort: null,
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
    dispatch(fetchCatalogFacets({}));
    dispatch(fetchPublicPartTypes());
    dispatch(resetCatalogCatalog());
    dispatch(fetchCatalogProducts(buildUsedCatalogParams(searchParams, 1)));
  }, [searchParams, dispatch]);

  const hasFilters = usedHasActiveFilters(searchParams);

  return (
    <div className="mt-0 w-full px-0 pb-[calc(11rem+env(safe-area-inset-bottom,0px))] sm:pb-8">
      <Helmet>
        <title>Фильтры — Свой Гараж</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://svoygarage.ru/autoparts/used" />
      </Helmet>
      <div className="px-3 sm:px-0">
        <h1 className="mb-3 text-lg font-semibold text-gray-900 md:hidden">Фильтры</h1>
        <div className={`relative z-10 ${autopartsFilterPanelClass}`}>
          <h2 className={`${autopartsFilterTitleClass} hidden md:block`}>Фильтры</h2>
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
              className={`${autopartsFilterSecondaryButtonClass} min-h-11 w-full text-base`}
            >
              Сбросить фильтры
            </button>
          ) : null}
          <button
            type="button"
            onClick={goToResults}
            className={`${autopartsFilterPrimaryButtonClass} min-h-11 w-full text-base`}
          >
            Показать товары
          </button>
        </div>
      </div>
    </div>
  );
}
