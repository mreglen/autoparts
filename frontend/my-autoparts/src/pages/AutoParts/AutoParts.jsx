// src/components/AutoParts.js
import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  selectRosskoStatus,
  selectRosskoError,
  selectSearchQuery,
  fetchSearchResults,
  setSearchQuery,
} from '../../redux/slices/RosskoSlice';
import {
  searchUsedParts,
  fetchCatalogProducts,
  fetchCatalogFacets,
  fetchPublicPartTypes,
} from '../../redux/slices/ProductSlice';
import { fetchCart } from '../../redux/slices/CartSlice';
import UsedPartsList from './UsedParts/UsedPartsList';
import NewPartsLanding from './NewParts/NewPartsLanding';
import NewPartsResults from './NewParts/NewPartsResults';

const NEW_PARTS_URL_KEYS = ['q', 'brand', 'vmin', 'vmax', 'in_stock', 'sort', 'show_analogs'];

const apiSortToUi = (sort) => {
  if (sort === 'price_asc' || sort === 'price_desc') return sort;
  return 'date';
};

const uiSortToApi = (sort) => (sort === 'date' ? 'created_at_desc' : sort);

function AutoParts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const status = useSelector(selectRosskoStatus);
  const error = useSelector(selectRosskoError);
  const searchQuery = useSelector(selectSearchQuery);
  
  // Determine active tab from URL path
  const isUsedTab = !showNewAutoparts || location.pathname.includes('/autoparts/used');
  const [activeTab, setActiveTab] = useState(isUsedTab ? 'my' : 'rossko');
  
  useEffect(() => {
    const qs = searchParams.toString();
    if (!showNewAutoparts || activeTab !== 'rossko') {
      navigate(`/autoparts/used${qs ? `?${qs}` : ''}`, { replace: true });
    } else {
      const params = new URLSearchParams();
      NEW_PARTS_URL_KEYS.forEach((key) => {
        if (key === 'brand') {
          searchParams.getAll('brand').forEach((v) => params.append('brand', v));
        } else if (searchParams.has(key)) {
          params.set(key, searchParams.get(key));
        }
      });
      const qs = params.toString();
      navigate(`/autoparts/new${qs ? `?${qs}` : ''}`, { replace: true });
    }
  }, [activeTab, navigate, searchParams, showNewAutoparts]);
  
  // Состояние для переключения вида карточек в б/у запчастях
  const [usedPartsView, setUsedPartsView] = useState('grid'); // 'grid' or 'list'
  
  const [usedPartsSort, setUsedPartsSort] = useState(
    () => apiSortToUi(searchParams.get('sort') || 'created_at_desc')
  );
  const [showSortDropdown, setShowSortDropdown] = useState(false);

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
    navigate(`/autoparts/new${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate]);

  const handleNewPartsSearch = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    dispatch(setSearchQuery(trimmed));
    await dispatch(fetchSearchResults({ text: trimmed }));
    navigate(`/autoparts/new?q=${encodeURIComponent(trimmed)}`);
  }, [dispatch, navigate]);

  const applyUsedSort = useCallback((uiSort) => {
    setUsedPartsSort(uiSort);
    updateCatalogUrl({ sort: uiSortToApi(uiSort), page: 1 });
    setShowSortDropdown(false);
  }, [updateCatalogUrl]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSortDropdown && !event.target.closest('.relative')) {
        setShowSortDropdown(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSortDropdown]);

  // Состояние для раскрытия карточек
  const [expandedPartId, setExpandedPartId] = useState(null);

  // Функция для переключения раскрытия карточки
  const handleToggleExpand = (partId) => {
    setExpandedPartId(expandedPartId === partId ? null : partId);
  };

  const urlQuery = searchParams.get('q');
  const effectiveQuery = (urlQuery ? decodeURIComponent(urlQuery) : searchQuery || '').trim();

  // Sync activeTab with URL on initial load
  useEffect(() => {
    if (!showNewAutoparts) {
      setActiveTab('my');
      return;
    }
    setActiveTab(isUsedTab ? 'my' : 'rossko');
  }, [isUsedTab, showNewAutoparts]);

  useEffect(() => {
    setUsedPartsSort(apiSortToUi(searchParams.get('sort') || 'created_at_desc'));
  }, [searchParams]);

  useEffect(() => {
    if (activeTab !== 'my') return;

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
  }, [searchQuery, activeTab, searchParams, dispatch]);

  useEffect(() => {
    if (activeTab !== 'rossko') return;
    const trimmed = (urlQuery ? decodeURIComponent(urlQuery) : '').trim();
    if (!trimmed) return;
    dispatch(setSearchQuery(trimmed));
    dispatch(fetchSearchResults({ text: trimmed }));
  }, [activeTab, urlQuery, dispatch]);

  // Загружаем корзину при монтировании компонента
  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  if (status === 'loading' && activeTab === 'rossko' && effectiveQuery) {
    return (
      <div className="mt-5 text-center py-10 px-4">
        <p className="text-base sm:text-lg text-gray-600">Загрузка данных...</p>
      </div>
    );
  }

  if (status === 'failed' && activeTab === 'rossko' && effectiveQuery) {
    return (
      <div className="mt-5 text-center py-10 px-4">
        <p className="text-base sm:text-lg text-red-600">Ошибка загрузки данных</p>
        <p className="text-sm text-gray-500 mt-2">{error}</p>
      </div>
    );
  }

  return (
    <div className="mt-4 sm:mt-5 px-0 w-full">

      {/* Переключатель вкладок */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        {showNewAutoparts && (
          <button
            onClick={() => setActiveTab('rossko')}
            className={`px-6 py-4 sm:px-4 sm:py-2 rounded-lg font-medium text-base sm:text-sm md:text-base transition-colors min-h-[48px] sm:min-h-0 ${activeTab === 'rossko'
                ? 'bg-indigo-500 text-white'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
          >
            Новые запчасти
          </button>
        )}
        <button
          onClick={() => setActiveTab('my')}
          className={`px-6 py-4 sm:px-4 sm:py-2 rounded-lg font-medium text-base sm:text-sm md:text-base transition-colors min-h-[48px] sm:min-h-0 ${activeTab === 'my'
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          Б/У запчасти
        </button>
        
        {/* View toggle buttons - only show when on Used Parts tab */}
        {activeTab === 'my' && (
          <div className="flex gap-2 ml-auto items-center">
            {/* Sort dropdown */}
            <div className="relative">
              <button
                onClick={() => setShowSortDropdown(!showSortDropdown)}
                className="px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 bg-gray-200 text-gray-700 hover:bg-gray-300"
                title="Сортировка"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4h13M3 8h9m-9 4h6m4 0l4-4m0 0l4 4m-4-4v12" />
                </svg>
                <span className="hidden sm:inline">Сортировка</span>
                <svg className={`w-4 h-4 transition-transform ${showSortDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showSortDropdown && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-30">
                  <button
                    onClick={() => applyUsedSort('price_asc')}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${usedPartsSort === 'price_asc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
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
                    onClick={() => applyUsedSort('price_desc')}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${usedPartsSort === 'price_desc' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
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
                    onClick={() => applyUsedSort('date')}
                    className={`w-full text-left px-4 py-2 hover:bg-gray-100 transition-colors ${usedPartsSort === 'date' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-700'}`}
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
            
            {/* View mode toggle */}
            <button
              onClick={() => setUsedPartsView('grid')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center ${usedPartsView === 'grid'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              title="Вид карточками"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2v-2z" />
              </svg>
            </button>
            <button
              onClick={() => setUsedPartsView('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center justify-center ${usedPartsView === 'list'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              title="Вид списком"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Отображение контента в зависимости от вкладки */}
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
    </div>
  );
}

export default AutoParts;
