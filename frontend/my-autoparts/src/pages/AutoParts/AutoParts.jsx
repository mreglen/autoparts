// src/components/AutoParts.js
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams, useNavigate, useLocation } from 'react-router-dom';
import {
  selectRosskoItems,
  selectRosskoStatus,
  selectRosskoError,
  selectSearchQuery
} from '../../redux/slices/RosskoSlice';
import {
  searchUsedParts,
  fetchCatalogProducts,
  fetchCatalogFacets,
  fetchPublicPartTypes,
} from '../../redux/slices/ProductSlice';
import { fetchCart } from '../../redux/slices/CartSlice';
import CardPart from './CardPart/CardPart';
import UsedPartsList from './UsedParts/UsedPartsList';

const apiSortToUi = (sort) => {
  if (sort === 'price_asc' || sort === 'price_desc') return sort;
  return 'date';
};

const uiSortToApi = (sort) => (sort === 'date' ? 'created_at_desc' : sort);

const getRosskoStockCount = (part) => {
  const stocks = part?.stocks?.stock;
  if (!stocks) return 0;
  const arr = Array.isArray(stocks) ? stocks : [stocks];
  return arr.reduce((sum, s) => sum + (parseInt(s?.count, 10) || 0), 0);
};

const getRosskoMinPrice = (part) => {
  const stocks = part?.stocks?.stock;
  if (!stocks) return 0;
  const arr = Array.isArray(stocks) ? stocks : [stocks];
  return arr.reduce((min, s) => {
    const p = parseFloat(s?.price) || 0;
    if (!p) return min;
    return min === 0 ? p : Math.min(min, p);
  }, 0);
};

const EmptySearchState = ({ query }) => (
  <div className="mt-12 sm:mt-16 flex flex-col items-center text-center max-w-2xl mx-auto px-4">
    <div className="bg-gray-100 p-6 rounded-full mb-8">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 sm:h-12 sm:w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <h2 className="text-2xl sm:text-2xl font-bold text-gray-800 mb-3">Ничего не найдено</h2>
    {query ? (
      <p className="text-gray-600 text-base sm:text-base leading-relaxed">
        По запросу <span className="font-semibold text-indigo-600">«{query}»</span> не найдено ни одной запчасти.
      </p>
    ) : (
      <p className="text-gray-600 text-base sm:text-base leading-relaxed">
        Введите артикул, бренд или наименование запчасти в строку поиска.
      </p>
    )}
    <p className="text-sm text-gray-500 mt-4 max-w-md">
      Попробуйте изменить поисковый запрос или проверьте правильность написания.
    </p>
  </div>
);



function AutoParts() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const showNewAutoparts = useSelector((state) => state.publicInfo.showNewAutoparts !== false);
  const partsData = useSelector(selectRosskoItems);
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
      const qOnly = searchParams.get('q');
      navigate(`/autoparts/new${qOnly ? `?q=${encodeURIComponent(qOnly)}` : ''}`, { replace: true });
    }
  }, [activeTab, navigate, showNewAutoparts]);
  
  // Состояние для переключения вида карточек в б/у запчастях
  const [usedPartsView, setUsedPartsView] = useState('grid'); // 'grid' or 'list'
  
  const [usedPartsSort, setUsedPartsSort] = useState(
    () => apiSortToUi(searchParams.get('sort') || 'created_at_desc')
  );
  const [showSortDropdown, setShowSortDropdown] = useState(false);

  const [rosskoBrandFilter, setRosskoBrandFilter] = useState('');
  const [rosskoPriceMin, setRosskoPriceMin] = useState('');
  const [rosskoPriceMax, setRosskoPriceMax] = useState('');
  const [rosskoInStockOnly, setRosskoInStockOnly] = useState(false);
  const [rosskoSort, setRosskoSort] = useState('price_asc');

  const updateCatalogUrl = useCallback((updates) => {
    const params = new URLSearchParams(searchParams);
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null || value === undefined || value === '') {
        params.delete(key);
      } else {
        params.set(key, String(value));
      }
    });
    const qs = params.toString();
    navigate(`${location.pathname}${qs ? `?${qs}` : ''}`, { replace: true });
  }, [searchParams, navigate, location.pathname]);

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

  // Initialize search query from URL if present and not already set
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && !searchQuery) {
      dispatch({ type: 'rossko/setSearchQuery', payload: decodeURIComponent(urlQuery) });
    }
  }, [searchParams, searchQuery, dispatch]);

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
    const trimmed = (searchQuery || '').trim();
    if (trimmed) {
      dispatch(searchUsedParts(trimmed));
      return;
    }
    if (activeTab !== 'my') return;

    const params = {
      page: parseInt(searchParams.get('page') || '1', 10),
      page_size: 20,
      sort: searchParams.get('sort') || 'created_at_desc',
      is_new: false,
    };
    const partType = searchParams.get('part_type');
    if (partType) params.part_type_id = parseInt(partType, 10);
    const brand = searchParams.get('brand');
    if (brand) params.brand = brand;
    const vmin = searchParams.get('vmin');
    if (vmin) params.price_min = parseFloat(vmin);
    const vmax = searchParams.get('vmax');
    if (vmax) params.price_max = parseFloat(vmax);
    const vb = searchParams.get('vb');
    if (vb) params.vehicle_brand = vb;
    const vm = searchParams.get('vm');
    if (vm) params.vehicle_model = vm;
    const vehicleId = searchParams.get('vehicle_id');
    if (vehicleId) params.vehicle_id = parseInt(vehicleId, 10);
    if (searchParams.get('has_photos') === '1') params.has_photos = true;

    dispatch(fetchCatalogProducts(params));
    dispatch(fetchCatalogFacets({ is_new: false, vehicle_brand: vb || undefined }));
    dispatch(fetchPublicPartTypes());
  }, [searchQuery, activeTab, searchParams, dispatch]);

  // Загружаем корзину при монтировании компонента
  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  // Нормализация Rossko
  let rawParts = partsData?.PartsList?.Part;
  if (!Array.isArray(rawParts)) {
    rawParts = rawParts ? [rawParts] : [];
  }
  const allParts = rawParts;

  const rosskoBrands = useMemo(() => {
    const brands = new Set();
    allParts.forEach((p) => {
      if (p?.brand) brands.add(p.brand);
    });
    return Array.from(brands).sort();
  }, [allParts]);

  const filterRosskoPart = useCallback((part) => {
    if (rosskoBrandFilter && part?.brand !== rosskoBrandFilter) return false;
    const price = getRosskoMinPrice(part);
    if (rosskoPriceMin && price < parseFloat(rosskoPriceMin)) return false;
    if (rosskoPriceMax && price > parseFloat(rosskoPriceMax)) return false;
    if (rosskoInStockOnly && getRosskoStockCount(part) <= 0) return false;
    return true;
  }, [rosskoBrandFilter, rosskoPriceMin, rosskoPriceMax, rosskoInStockOnly]);

  const sortRosskoParts = useCallback((parts) => {
    const sorted = [...parts];
    sorted.sort((a, b) => {
      if (rosskoSort === 'price_desc') {
        return getRosskoMinPrice(b) - getRosskoMinPrice(a);
      }
      if (rosskoSort === 'brand') {
        return String(a?.brand || '').localeCompare(String(b?.brand || ''), 'ru');
      }
      return getRosskoMinPrice(a) - getRosskoMinPrice(b);
    });
    return sorted;
  }, [rosskoSort]);

  const filteredRosskoParts = useMemo(
    () => sortRosskoParts(allParts.filter(filterRosskoPart)),
    [allParts, filterRosskoPart, sortRosskoParts]
  );

  const allCrossParts = useMemo(() => {
    const crosses = [];
    allParts.forEach((part) => {
      let crossParts = part?.crosses?.Part;
      if (crossParts) {
        if (!Array.isArray(crossParts)) crossParts = [crossParts];
        crosses.push(...crossParts);
      }
    });
    return crosses;
  }, [allParts]);

  const filteredCrossParts = useMemo(
    () => sortRosskoParts(allCrossParts.filter(filterRosskoPart)),
    [allCrossParts, filterRosskoPart, sortRosskoParts]
  );

  const hasRosskoResults = filteredRosskoParts.length > 0 || filteredCrossParts.length > 0;

  if (status === 'loading' && activeTab === 'rossko') {
    return (
      <div className="mt-5 text-center py-10 px-4">
        <p className="text-base sm:text-lg text-gray-600">Загрузка данных...</p>
      </div>
    );
  }

  if (status === 'failed' && activeTab === 'rossko') {
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
      ) : (
        <>

          {hasRosskoResults ? (
            <>
              <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                <select
                  value={rosskoBrandFilter}
                  onChange={(e) => setRosskoBrandFilter(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="">Все бренды</option>
                  {rosskoBrands.map((b) => (
                    <option key={b} value={b}>{b}</option>
                  ))}
                </select>
                <input
                  type="number"
                  placeholder="Цена от"
                  value={rosskoPriceMin}
                  onChange={(e) => setRosskoPriceMin(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  placeholder="Цена до"
                  value={rosskoPriceMax}
                  onChange={(e) => setRosskoPriceMax(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                />
                <select
                  value={rosskoSort}
                  onChange={(e) => setRosskoSort(e.target.value)}
                  className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
                >
                  <option value="price_asc">Дешевле</option>
                  <option value="price_desc">Дороже</option>
                  <option value="brand">По бренду</option>
                </select>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={rosskoInStockOnly}
                    onChange={(e) => setRosskoInStockOnly(e.target.checked)}
                  />
                  Только в наличии
                </label>
              </div>

              {/* Десктопная версия - таблица */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-20">Бренд</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">Номер</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-64">Наименование</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-36">Поставка</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">Остаток</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-20">Цена, ₽</th>
                      <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">К заказу</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {filteredRosskoParts.map((part, idx) => {
                      const uniqueId = `available-${part.guid || part.id || idx}`;
                      // Преобразуем данные складов из API формата в формат для CardPart
                      let stocksData = [];
                      if (part.stocks && part.stocks.stock) {
                        const stocksArray = Array.isArray(part.stocks.stock) ? part.stocks.stock : [part.stocks.stock];
                        stocksData = stocksArray.filter(stock => stock && typeof stock === 'object').map(stock => ({
                          stock_id: stock.id,
                          price: parseFloat(stock.price) || 0,
                          available_count: parseInt(stock.count) || 0,
                          delivery_start: stock.deliveryStart,
                          delivery_end: stock.deliveryEnd,
                          description: stock.description
                        }));
                      }

                      return (
                        <CardPart
                          key={uniqueId}
                          part={part}
                          stocksData={stocksData}
                          showAllStocks
                          sectionType="available"
                          uniqueId={uniqueId}
                          expandedPartId={expandedPartId}
                          onToggleExpand={handleToggleExpand}
                        />
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {/* Мобильная версия - карточки */}
              <div className="md:hidden space-y-5">
                {filteredRosskoParts.map((part, idx) => {
                  const uniqueId = `mobile-available-${part.guid || part.id || idx}`;
                  let stocksData = [];
                  if (part.stocks && part.stocks.stock) {
                    const stocksArray = Array.isArray(part.stocks.stock) ? part.stocks.stock : [part.stocks.stock];
                    stocksData = stocksArray.filter(stock => stock && typeof stock === 'object').map(stock => ({
                      stock_id: stock.id,
                      price: parseFloat(stock.price) || 0,
                      available_count: parseInt(stock.count) || 0,
                      delivery_start: stock.deliveryStart,
                      delivery_end: stock.deliveryEnd,
                      description: stock.description
                    }));
                  }

                  return (
                    <CardPart
                      key={uniqueId}
                      part={part}
                      stocksData={stocksData}
                      showAllStocks
                      sectionType="available"
                      uniqueId={uniqueId}
                      expandedPartId={expandedPartId}
                      onToggleExpand={handleToggleExpand}
                      isMobile={true}
                    />
                  );
                })}
              </div>

              {filteredCrossParts.length > 0 && (
                <>
                  <div className="font-medium text-xl sm:text-xl my-6 sm:my-10 px-4 sm:px-0">
                    <h2 className="border-b-4 border-blue-500 pb-2 inline-block">Аналоги</h2>
                  </div>

                  {/* Десктопная версия аналогов */}
                  <div className="hidden md:block">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-20">Бренд</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">Номер</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-64">Наименование</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-36">Поставка</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">Остаток</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-20">Цена, ₽</th>
                          <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase tracking-wider w-24">К заказу</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredCrossParts.map((part, idx) => {
                          const uniqueId = `analog-${part.guid || part.id || idx}`;
                          let stocksData = [];
                          if (part.stocks && part.stocks.stock) {
                            const stocksArray = Array.isArray(part.stocks.stock) ? part.stocks.stock : [part.stocks.stock];
                            stocksData = stocksArray.filter(stock => stock && typeof stock === 'object').map(stock => ({
                              stock_id: stock.id,
                              price: parseFloat(stock.price) || 0,
                              available_count: parseInt(stock.count) || 0,
                              delivery_start: stock.deliveryStart,
                              delivery_end: stock.deliveryEnd,
                              description: stock.description
                            }));
                          }

                          return (
                            <CardPart
                              key={uniqueId}
                              part={part}
                              stocksData={stocksData}
                              showAllStocks
                              sectionType="analog"
                              uniqueId={uniqueId}
                              expandedPartId={expandedPartId}
                              onToggleExpand={handleToggleExpand}
                            />
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Мобильная версия аналогов */}
                  <div className="md:hidden space-y-5">
                    {filteredCrossParts.map((part, idx) => {
                      const uniqueId = `mobile-analog-${part.guid || part.id || idx}`;
                      let stocksData = [];
                      if (part.stocks && part.stocks.stock) {
                        const stocksArray = Array.isArray(part.stocks.stock) ? part.stocks.stock : [part.stocks.stock];
                        stocksData = stocksArray.filter(stock => stock && typeof stock === 'object').map(stock => ({
                          stock_id: stock.id,
                          price: parseFloat(stock.price) || 0,
                          available_count: parseInt(stock.count) || 0,
                          delivery_start: stock.deliveryStart,
                          delivery_end: stock.deliveryEnd,
                          description: stock.description
                        }));
                      }

                      return (
                        <CardPart
                          key={uniqueId}
                          part={part}
                          stocksData={stocksData}
                          showAllStocks
                          sectionType="analog"
                          uniqueId={uniqueId}
                          expandedPartId={expandedPartId}
                          onToggleExpand={handleToggleExpand}
                          isMobile={true}
                        />
                      );
                    })}
                  </div>
                </>
              )}
            </>
          ) : (
            <EmptySearchState query={searchQuery} />
          )}
        </>
      )}
    </div>
  );
}

export default AutoParts;
