import React, { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import {
  selectRosskoStatus,
  selectSearchQuery,
  fetchSearchResults,
  setSearchQuery,
} from '../../../redux/slices/RosskoSlice';
import { fetchCart } from '../../../redux/slices/CartSlice';
import NewPartsFiltersForm from './NewPartsFiltersForm';
import { newHasActiveFilters } from '../../../utils/autopartsFilters';
import { Z_MOBILE_STICKY_FOOTER } from '../../../constants/mobileTokens';

const NEW_PARTS_URL_KEYS = ['q', 'brand', 'vmin', 'vmax', 'in_stock', 'sort', 'show_analogs'];

export default function NewPartsFiltersPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const status = useSelector(selectRosskoStatus);
  const searchQuery = useSelector(selectSearchQuery);

  const urlQuery = searchParams.get('q');

  const updateNewPartsUrl = useCallback((updates) => {
    const params = new URLSearchParams();
    const current = new URLSearchParams(searchParams);
    NEW_PARTS_URL_KEYS.forEach((key) => {
      if (key === 'brand') {
        current.getAll('brand').forEach((v) => params.append('brand', v));
      } else if (current.has(key)) {
        params.set(key, current.get(key));
      }
    });
    Object.entries(updates).forEach(([key, value]) => {
      params.delete(key);
      if (value === null || value === undefined || value === '') return;
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
    navigate(`/autoparts/new/filters${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate]);

  const clearFilters = useCallback(() => {
    updateNewPartsUrl({
      brand: null,
      vmin: null,
      vmax: null,
      in_stock: null,
      sort: 'price_asc',
      show_analogs: null,
    });
  }, [updateNewPartsUrl]);

  const goToResults = useCallback(() => {
    const qs = searchParams.toString();
    navigate(`/autoparts/new${qs ? `?${qs}` : ''}`);
  }, [navigate, searchParams]);

  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  useEffect(() => {
    const trimmed = (urlQuery ? decodeURIComponent(urlQuery) : '').trim();
    if (!trimmed) {
      navigate('/autoparts/new', { replace: true });
      return;
    }
    dispatch(setSearchQuery(trimmed));
    dispatch(fetchSearchResults({ text: trimmed }));
  }, [urlQuery, dispatch, navigate]);

  const hasFilters = newHasActiveFilters(searchParams);

  if (status === 'loading' && (urlQuery || '').trim()) {
    return (
      <div className="mt-5 text-center py-10 px-4">
        <p className="text-base sm:text-lg text-gray-600">Загрузка данных...</p>
      </div>
    );
  }

  return (
    <div className="mt-0 w-full px-0 pb-40 sm:pb-8">
      <Helmet>
        <title>Фильтры — Свой Гараж</title>
        <meta name="robots" content="noindex, nofollow" />
        <link rel="canonical" href="https://svoygarage.ru/autoparts/new" />
      </Helmet>
      <div className="px-3 sm:px-0">
        <h1 className="text-lg font-semibold text-gray-900 mb-3 md:hidden">Фильтры</h1>
        <p className="text-sm text-gray-600 mb-3 truncate" title={searchQuery || urlQuery}>
          Запрос: <span className="font-medium text-gray-900">{searchQuery || decodeURIComponent(urlQuery || '')}</span>
        </p>
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900 mb-3 hidden md:block">Фильтры</h2>
          <NewPartsFiltersForm updateNewPartsUrl={updateNewPartsUrl} />
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
