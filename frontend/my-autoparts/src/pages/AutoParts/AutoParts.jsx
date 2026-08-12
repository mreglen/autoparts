// src/components/AutoParts.js
import React, { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  selectRosskoStatus,
  selectRosskoError,
  selectSearchQuery,
  fetchSearchResults,
  setSearchQuery,
  clearSearch,
} from '../../redux/slices/RosskoSlice';
import {
  searchUsedAnalogs,
  fetchCatalogProducts,
  fetchCatalogFacets,
  fetchPublicPartTypes,
  resetCatalogCatalog,
  clearUsedPartsSearch,
  selectCatalogFilterKey,
  selectCatalogLoading,
  selectCatalogItems,
} from '../../redux/slices/ProductSlice';
import NewPartsLanding from './NewParts/NewPartsLanding';
import MobileCompactSearch from '../../components/MobileCompactSearch/MobileCompactSearch';
import ScrollToTopButton from '../../components/ScrollToTopButton/ScrollToTopButton';
import CatalogViewModeToggle from '../../components/CatalogViewModeToggle/CatalogViewModeToggle';
import {
  buildUsedCatalogParams,
  buildUsedCatalogFilterParams,
  getUsedPartsUrlQuery,
  isUsedCatalogQueryOnlyPage,
  stripEmptyUsedQueryParam,
  apiSortToUi,
  uiSortToApi,
  getNewUiSort,
} from '../../utils/autopartsPublic';
import { buildAutoPartsSeo, PageSeoHelmet } from '../../utils/pageSeo';
import { apiAxiosUnauth } from '../../utils/apiClient';
import SoftServiceNotice from '../../components/SoftServiceNotice/SoftServiceNotice';
import { looksLikeVin, normalizeVinOrNull } from '../../utils/laximoVin';
import { fetchPublicSiteConfig } from '../../redux/slices/PublicInfoSlice';

const UsedPartsList = React.lazy(() => import('./UsedParts/UsedPartsList'));
const NewPartsResults = React.lazy(() => import('./NewParts/NewPartsResults'));

const NEW_PARTS_URL_KEYS = ['q', 'brand', 'vmin', 'vmax', 'in_stock', 'sort', 'show_analogs', 'vin_unavailable'];

function AutoParts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const status = useSelector(selectRosskoStatus);

  useEffect(() => {
    if (!showNewAutoparts || !location.pathname.includes('/autoparts/new')) return;
    dispatch(fetchPublicSiteConfig(true));
  }, [dispatch, showNewAutoparts, location.pathname]);
  const error = useSelector(selectRosskoError);
  const searchQuery = useSelector(selectSearchQuery);
  
  const catalogFilterKey = useSelector(selectCatalogFilterKey);
  const catalogLoading = useSelector(selectCatalogLoading);
  const catalogItems = useSelector(selectCatalogItems);
  const catalogError = useSelector((state) => state.products.error);
  
  // Determine active tab from URL path
  const isUsedTab = !showNewAutoparts || location.pathname.includes('/autoparts/used');
  const [activeTab, setActiveTab] = useState(isUsedTab ? 'my' : 'rossko');
  
  useEffect(() => {
    const qs = searchParams.toString();
    const filtersSuffix = location.pathname.endsWith('/filters') ? '/filters' : '';
    const onUsedPath = location.pathname.includes('/autoparts/used');
    const onNewPath = location.pathname.includes('/autoparts/new');
    const keepFiltersPath = Boolean(filtersSuffix) && (
      (!showNewAutoparts || activeTab !== 'rossko') ? onUsedPath : onNewPath
    );
    const suffix = keepFiltersPath ? '/filters' : '';

    if (!showNewAutoparts || activeTab !== 'rossko') {
      navigate(`/autoparts/used${suffix}${qs ? `?${qs}` : ''}`, { replace: true });
    } else {
      const params = new URLSearchParams();
      NEW_PARTS_URL_KEYS.forEach((key) => {
        if (key === 'brand') {
          searchParams.getAll('brand').forEach((v) => params.append('brand', v));
        } else if (searchParams.has(key)) {
          params.set(key, searchParams.get(key));
        }
      });
      const nextQs = params.toString();
      navigate(`/autoparts/new${suffix}${nextQs ? `?${nextQs}` : ''}`, { replace: true });
    }
  }, [activeTab, navigate, searchParams, showNewAutoparts, location.pathname]);
  
  // Состояние для переключения вида карточек в б/у запчастях
  const [usedPartsView, setUsedPartsView] = useState('grid'); // 'grid' or 'list'
  
  const [usedPartsSort, setUsedPartsSort] = useState(
    () => apiSortToUi(searchParams.get('sort') || 'created_at_desc')
  );
  const [newPartsSort, setNewPartsSort] = useState(() => getNewUiSort(searchParams));
  const [showSortDropdown, setShowSortDropdown] = useState(false);
  const sortMenuRef = useRef(null);

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
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate, location.pathname]);

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
    const basePath = location.pathname.includes('/new/filters')
      ? '/autoparts/new/filters'
      : '/autoparts/new';
    navigate(`${basePath}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate, location.pathname]);

  const handleVinScanConfirm = useCallback((vin) => {
    navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
  }, [navigate]);

  const handleNewPartsSearch = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    const vin = normalizeVinOrNull(trimmed);
    if (vin) {
      navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`);
      return;
    }
    dispatch(setSearchQuery(trimmed));
    await dispatch(fetchSearchResults({ text: trimmed }));
    navigate(`/autoparts/new?q=${encodeURIComponent(trimmed)}`);
  }, [dispatch, navigate]);

  const applyUsedQueryToUrl = useCallback((text, { replace = true } = {}) => {
    const params = new URLSearchParams(searchParams);
    params.delete('page');
    params.delete('vin_unavailable');
    const trimmed = text.trim();
    const vin = normalizeVinOrNull(trimmed);
    if (vin) {
      navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`, { replace });
      return;
    }
    if (trimmed) {
      params.set('q', trimmed);
      dispatch(setSearchQuery(trimmed));
    } else {
      params.delete('q');
      dispatch(setSearchQuery(''));
    }
    const basePath = location.pathname.includes('/autoparts/used')
      ? location.pathname.replace(/\/filters$/, '')
      : '/autoparts/used';
    const qs = params.toString();
    navigate(`${basePath}${qs ? `?${qs}` : ''}`, { replace });
  }, [searchParams, navigate, location.pathname, dispatch]);

  const handleUsedLiveQueryChange = useCallback((text) => {
    if (looksLikeVin(text.trim())) {
      return;
    }
    applyUsedQueryToUrl(text, { replace: true });
  }, [applyUsedQueryToUrl]);

  const handleUsedPartsSearch = useCallback((text) => {
    applyUsedQueryToUrl(text, { replace: true });
  }, [applyUsedQueryToUrl]);

  const handleUsedPartsClear = useCallback(() => {
    applyUsedQueryToUrl('', { replace: true });
  }, [applyUsedQueryToUrl]);

  const handleNewPartsClear = useCallback(() => {
    const params = new URLSearchParams(searchParams);
    params.delete('q');
    params.delete('page');
    const qs = params.toString();
    navigate(`/autoparts/new${qs ? `?${qs}` : ''}`, { replace: true });
    dispatch(clearSearch());
  }, [searchParams, navigate, dispatch]);

  const applyUsedSort = useCallback((uiSort) => {
    setUsedPartsSort(uiSort);
    updateCatalogUrl({ sort: uiSortToApi(uiSort) });
    setShowSortDropdown(false);
  }, [updateCatalogUrl]);

  const applyNewPartsSort = useCallback((sort) => {
    setNewPartsSort(sort);
    updateNewPartsUrl({ sort: sort === 'price_asc' ? null : sort });
    setShowSortDropdown(false);
  }, [updateNewPartsUrl]);
  
  useEffect(() => {
    if (!showSortDropdown) return undefined;

    const handlePointerDown = (event) => {
      if (sortMenuRef.current?.contains(event.target)) return;
      setShowSortDropdown(false);
    };

    document.addEventListener('pointerdown', handlePointerDown, true);
    return () => document.removeEventListener('pointerdown', handlePointerDown, true);
  }, [showSortDropdown]);

  // Состояние для раскрытия карточек
  const [expandedPartId, setExpandedPartId] = useState(null);

  // Функция для переключения раскрытия карточки
  const handleToggleExpand = (partId) => {
    setExpandedPartId(expandedPartId === partId ? null : partId);
  };

  const urlQuery = searchParams.get('q');
  const effectiveQuery = (urlQuery ? decodeURIComponent(urlQuery) : searchQuery || '').trim();

  // VIN in listing query → OEM catalog page (same as header search)
  useEffect(() => {
    const vin = normalizeVinOrNull(urlQuery || '');
    if (!vin) return;
    navigate(`/autoparts/vin?vin=${encodeURIComponent(vin)}`, { replace: true });
  }, [urlQuery, navigate]);

  // Sync activeTab with URL on initial load
  useEffect(() => {
    if (!showNewAutoparts) {
      setActiveTab('my');
      return;
    }
    setActiveTab(isUsedTab ? 'my' : 'rossko');
  }, [isUsedTab, showNewAutoparts]);

  useEffect(() => {
    setShowSortDropdown(false);
  }, [activeTab]);

  useEffect(() => {
    setUsedPartsSort(apiSortToUi(searchParams.get('sort') || 'created_at_desc'));
  }, [searchParams]);

  useEffect(() => {
    setNewPartsSort(getNewUiSort(searchParams));
  }, [searchParams]);

  const usedCatalogFilterKey = useMemo(
    () => JSON.stringify(buildUsedCatalogFilterParams(searchParams)),
    [searchParams]
  );

  useEffect(() => {
    if (!location.pathname.includes('/autoparts/used')) return;
    const { params, stripped, normalized } = stripEmptyUsedQueryParam(searchParams);
    if (stripped || normalized) {
      const qs = params.toString();
      navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
      if (stripped) {
        dispatch(setSearchQuery(''));
      }
    }
  }, [location.pathname, searchParams, navigate, dispatch]);

  useEffect(() => {
    if (activeTab !== 'my') return;

    dispatch(fetchCatalogFacets({}));
    dispatch(fetchPublicPartTypes());

    const urlQ = getUsedPartsUrlQuery(searchParams);
    if (urlQ && (searchQuery || '').trim() !== urlQ) {
      dispatch(setSearchQuery(urlQ));
    }
    if (!urlQ && (searchQuery || '').trim()) {
      dispatch(setSearchQuery(''));
    }

    const catalogAlreadyLoaded = catalogFilterKey === usedCatalogFilterKey
      && catalogFilterKey !== null
      && catalogItems.length > 0;
    if (!catalogAlreadyLoaded) {
      dispatch(fetchCatalogProducts(buildUsedCatalogParams(searchParams, 1)));
    }
  }, [searchQuery, activeTab, usedCatalogFilterKey, searchParams, dispatch, catalogFilterKey, catalogItems.length]);

  useEffect(() => {
    if (activeTab !== 'my') return;

    const urlQ = getUsedPartsUrlQuery(searchParams);
    if (!urlQ) {
      dispatch(clearUsedPartsSearch());
      return undefined;
    }

    dispatch(clearUsedPartsSearch());
    const timer = setTimeout(() => {
      dispatch(searchUsedAnalogs(urlQ));
    }, 650);

    return () => clearTimeout(timer);
  }, [activeTab, usedCatalogFilterKey, searchParams, dispatch]);

  useEffect(() => {
    if (activeTab !== 'rossko') return;
    const trimmed = (urlQuery ? decodeURIComponent(urlQuery) : '').trim();
    if (!trimmed) return;
    dispatch(setSearchQuery(trimmed));
    dispatch(fetchSearchResults({ text: trimmed }));
  }, [activeTab, urlQuery, dispatch]);

  useEffect(() => {
    if (activeTab !== 'rossko') return;
    const trimmed = (urlQuery ? decodeURIComponent(urlQuery) : '').trim();
    if (!trimmed) {
      dispatch(resetCatalogCatalog());
      dispatch(clearUsedPartsSearch());
      return undefined;
    }

    dispatch(resetCatalogCatalog());
    dispatch(fetchCatalogProducts({
      q: trimmed,
      page: 1,
      page_size: 1,
      sort: 'created_at_desc',
    }));

    dispatch(clearUsedPartsSearch());
    const timer = setTimeout(() => {
      dispatch(searchUsedAnalogs(trimmed));
    }, 650);

    return () => clearTimeout(timer);
  }, [activeTab, urlQuery, dispatch]);

  const handleCatalogRetry = useCallback(() => {
    if (activeTab === 'my') {
      dispatch(fetchCatalogFacets({}));
      dispatch(fetchPublicPartTypes());
      dispatch(fetchCatalogProducts(buildUsedCatalogParams(searchParams, 1)));
      return;
    }
    const trimmed = (urlQuery ? decodeURIComponent(urlQuery) : '').trim();
    if (trimmed) {
      dispatch(fetchSearchResults({ text: trimmed }));
    }
  }, [activeTab, dispatch, searchParams, urlQuery]);

  const fallbackSeo = useMemo(
    () => buildAutoPartsSeo(location.pathname, searchParams),
    [location.pathname, searchParams]
  );

  const usedQueryOnlyPage = location.pathname === '/autoparts/used'
    && isUsedCatalogQueryOnlyPage(searchParams);
  const [usedQueryPageSeo, setUsedQueryPageSeo] = useState(null);

  useEffect(() => {
    if (!usedQueryOnlyPage) {
      setUsedQueryPageSeo(null);
      return undefined;
    }

    const path = `${location.pathname}${location.search}`;
    let cancelled = false;

    apiAxiosUnauth
      .get('/public/page-meta', { params: { path } })
      .then((response) => {
        if (cancelled) return;
        setUsedQueryPageSeo({
          title: response.data.title,
          description: response.data.description,
          canonicalUrl: response.data.canonical_url,
          robots: response.data.robots,
          keywords: response.data.keywords || '',
        });
      })
      .catch(() => {
        if (!cancelled) setUsedQueryPageSeo(null);
      });

    return () => {
      cancelled = true;
    };
  }, [usedQueryOnlyPage, location.pathname, location.search]);

  const seo = usedQueryPageSeo || fallbackSeo;

  if (status === 'loading' && activeTab === 'rossko' && effectiveQuery) {
    return (
      <div className="mt-5 text-center py-10 px-4">
        <PageSeoHelmet seo={seo} />
        <p className="text-base sm:text-lg text-gray-600">Загрузка данных...</p>
      </div>
    );
  }

  if (status === 'failed' && activeTab === 'rossko' && effectiveQuery) {
    return (
      <div className="mt-5 text-center py-10 px-4">
        <PageSeoHelmet seo={seo} />
        <p className="text-base sm:text-lg text-red-600">Ошибка загрузки данных</p>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-0 sm:mt-5 px-0 w-full">
      <PageSeoHelmet seo={seo} />
      {searchParams.get('vin_unavailable') === '1' ? (
        <div className="mb-4 max-lg:px-3">
          <SoftServiceNotice variant="unavailable" />
        </div>
      ) : null}
      <div className="max-lg:sticky max-lg:top-[var(--sg-mobile-header-h)] max-lg:z-20 max-lg:bg-gray-50">
        {activeTab === 'my' && (
          <MobileCompactSearch
            onSearch={handleUsedPartsSearch}
            onQueryChange={handleUsedLiveQueryChange}
            onClear={handleUsedPartsClear}
            liveSearch
            sticky={false}
            enableVinScan
            onVinScanConfirm={handleVinScanConfirm}
          />
        )}
        {activeTab === 'rossko' && (
          <MobileCompactSearch
            onSearch={handleNewPartsSearch}
            onClear={handleNewPartsClear}
            sticky={false}
            placeholder="Артикул, бренд или наименование"
            enableVinScan
            onVinScanConfirm={handleVinScanConfirm}
          />
        )}

        {/* Переключатель вкладок */}
        <div className="mb-3 sm:mb-6 max-lg:px-3 max-lg:py-2">
        <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 snap-x snap-mandatory items-center gap-2 overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {showNewAutoparts && (
            <button
              type="button"
              onClick={() => setActiveTab('rossko')}
              className={`min-h-11 shrink-0 snap-start touch-manipulation rounded-full px-4 py-2 text-sm font-medium transition-colors sm:rounded-lg sm:px-6 sm:py-4 sm:text-base ${activeTab === 'rossko'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
            >
              Новые
            </button>
          )}
          <button
            type="button"
            onClick={() => setActiveTab('my')}
            className={`min-h-11 shrink-0 snap-start touch-manipulation rounded-full px-4 py-2 text-sm font-medium transition-colors sm:rounded-lg sm:px-6 sm:py-4 sm:text-base ${activeTab === 'my'
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Б/У
          </button>
        </div>

          {activeTab === 'rossko' && showNewAutoparts && (
            <div ref={sortMenuRef} className="relative shrink-0">
              <button
                type="button"
                onClick={() => setShowSortDropdown((prev) => !prev)}
                className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg bg-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-300 active:bg-gray-300 sm:px-4 sm:py-2"
                title="Сортировка"
                aria-expanded={showSortDropdown}
                aria-haspopup="menu"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
              </button>

              {showSortDropdown && (
                <div className="absolute right-0 z-50 mt-2 w-56 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => applyNewPartsSort('price_asc')}
                    className={`min-h-11 w-full touch-manipulation px-4 py-2 text-left transition-colors hover:bg-gray-100 active:bg-gray-100 ${newPartsSort === 'price_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Дешевле</span>
                      {newPartsSort === 'price_asc' && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNewPartsSort('price_desc')}
                    className={`min-h-11 w-full touch-manipulation px-4 py-2 text-left transition-colors hover:bg-gray-100 active:bg-gray-100 ${newPartsSort === 'price_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Дороже</span>
                      {newPartsSort === 'price_desc' && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNewPartsSort('delivery_asc')}
                    className={`min-h-11 w-full touch-manipulation px-4 py-2 text-left transition-colors hover:bg-gray-100 active:bg-gray-100 ${newPartsSort === 'delivery_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Быстрее по поставке</span>
                      {newPartsSort === 'delivery_asc' && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyNewPartsSort('brand')}
                    className={`min-h-11 w-full touch-manipulation px-4 py-2 text-left transition-colors hover:bg-gray-100 active:bg-gray-100 ${newPartsSort === 'brand' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>По бренду</span>
                      {newPartsSort === 'brand' && (
                        <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>
          )}

          {activeTab === 'my' && (
            <div className="flex shrink-0 items-center gap-1 sm:gap-2">
              <div ref={sortMenuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setShowSortDropdown((prev) => !prev)}
                  className="flex min-h-11 min-w-11 touch-manipulation items-center justify-center rounded-lg bg-gray-200 p-2 text-gray-700 transition-colors hover:bg-gray-300 active:bg-gray-300 sm:px-4 sm:py-2"
                  title="Сортировка"
                  aria-expanded={showSortDropdown}
                  aria-haspopup="menu"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                  </svg>
                </button>

                {showSortDropdown && (
                  <div className="absolute right-0 z-50 mt-2 w-48 rounded-lg border border-gray-200 bg-white py-2 shadow-lg">
                  <button
                    type="button"
                    onClick={() => applyUsedSort('price_asc')}
                    className={`min-h-11 w-full touch-manipulation text-left px-4 py-2 hover:bg-gray-100 active:bg-gray-100 transition-colors ${usedPartsSort === 'price_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Дешевле</span>
                      {usedPartsSort === 'price_asc' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUsedSort('price_desc')}
                    className={`min-h-11 w-full touch-manipulation text-left px-4 py-2 hover:bg-gray-100 active:bg-gray-100 transition-colors ${usedPartsSort === 'price_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>Дороже</span>
                      {usedPartsSort === 'price_desc' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => applyUsedSort('date')}
                    className={`min-h-11 w-full touch-manipulation text-left px-4 py-2 hover:bg-gray-100 active:bg-gray-100 transition-colors ${usedPartsSort === 'date' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
                  >
                    <div className="flex items-center justify-between">
                      <span>По дате</span>
                      {usedPartsSort === 'date' && (
                        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  </button>
                </div>
              )}
            </div>
            
            <CatalogViewModeToggle
              value={usedPartsView}
              onChange={setUsedPartsView}
              className="min-h-11"
            />
          </div>
          )}
        </div>
      </div>
      </div>

      {catalogError && activeTab === 'my' && !catalogLoading ? (
        <div className="mx-3 mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 sm:mx-0">
          <p>{String(catalogError)}</p>
          <button
            type="button"
            onClick={handleCatalogRetry}
            className="mt-2 font-semibold text-indigo-700 underline hover:text-indigo-900"
          >
            Повторить загрузку
          </button>
        </div>
      ) : null}

      {/* Отображение контента в зависимости от вкладки */}
      <Suspense fallback={<div className="py-12 text-center text-gray-500">Загрузка каталога…</div>}>
      {activeTab === 'my' ? (
        <UsedPartsList
          viewMode={usedPartsView}
          sortBy={usedPartsSort}
          updateCatalogUrl={updateCatalogUrl}
        />
      ) : !effectiveQuery ? (
        <NewPartsLanding onSearch={handleNewPartsSearch} />
      ) : (
        <NewPartsResults
          updateNewPartsUrl={updateNewPartsUrl}
          onSearch={handleNewPartsSearch}
          expandedPartId={expandedPartId}
          onToggleExpand={handleToggleExpand}
        />
      )}
      </Suspense>
      <ScrollToTopButton />
    </div>
  );
}

export default AutoParts;
