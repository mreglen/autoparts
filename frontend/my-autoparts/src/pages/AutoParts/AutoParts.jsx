// src/components/AutoParts.js
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  selectRosskoItems,
  selectRosskoStatus,
  selectRosskoError,
  selectSearchQuery
} from '../../redux/slices/RosskoSlice';
import {
  selectItems as selectMyParts,
  selectStatus as selectMyPartsStatus,
  selectError as selectMyPartsError,
  selectMyParts as selectMyPartsItems
} from '../../redux/slices/ProductSlice';
import { searchAllProducts, searchUsedParts, fetchAllProducts } from '../../redux/slices/ProductSlice';
import { fetchCart } from '../../redux/slices/CartSlice';
import CardPart from './CardPart/CardPart';
import UsedPartsList from './UsedParts/UsedPartsList';

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
  const dispatch = useDispatch();
  const partsData = useSelector(selectRosskoItems);
  const status = useSelector(selectRosskoStatus);
  const error = useSelector(selectRosskoError);
  const searchQuery = useSelector(selectSearchQuery);
  
  // Initialize search query from URL if present and not already set
  useEffect(() => {
    const urlQuery = searchParams.get('q');
    if (urlQuery && !searchQuery) {
      dispatch({ type: 'rossko/setSearchQuery', payload: decodeURIComponent(urlQuery) });
    }
  }, [searchParams, searchQuery, dispatch]);

  // Состояние для переключения вкладок
  const [activeTab, setActiveTab] = useState('rossko');
  
  // Состояние для переключения вида карточек в б/у запчастях
  const [usedPartsView, setUsedPartsView] = useState('grid'); // 'grid' or 'list'

  // Состояние для раскрытия карточек
  const [expandedPartId, setExpandedPartId] = useState(null);

  // Функция для переключения раскрытия карточки
  const handleToggleExpand = (partId) => {
    setExpandedPartId(expandedPartId === partId ? null : partId);
  };

  // При изменении searchQuery — обновляем б/у запчасти
  useEffect(() => {
    if (searchQuery) {
      dispatch(searchUsedParts(searchQuery));
    } else {
      // Для б/у запчастей без поискового запроса показываем все б/у запчасти
      dispatch(fetchAllProducts());
    }
  }, [searchQuery, dispatch]);

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

  const allCrossParts = [];
  allParts.forEach(part => {
    let crosses = part?.crosses?.Part;
    if (crosses) {
      if (!Array.isArray(crosses)) crosses = [crosses];
      allCrossParts.push(...crosses);
    }
  });

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

  const hasRosskoResults = allParts.length > 0 || allCrossParts.length > 0;

  return (
    <div className="mt-4 sm:mt-5 px-0 w-full">
      <h1 className="font-bold text-2xl sm:text-2xl my-4 sm:my-5 px-4 sm:px-0">
        {/* {searchQuery || 'Результаты поиска'} */}
        Автозапчасти
      </h1>

      {/* Переключатель вкладок */}
      <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mb-6">
        <button
          onClick={() => setActiveTab('rossko')}
          className={`px-6 py-4 sm:px-4 sm:py-2 rounded-lg font-medium text-base sm:text-sm md:text-base transition-colors min-h-[48px] sm:min-h-0 ${activeTab === 'rossko'
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          Новые запчасти
        </button>
        <button
          onClick={() => {
            setActiveTab('my');
            if (searchQuery) {
              dispatch(searchUsedParts(searchQuery));
            } else {
              // Для б/у запчастей без поискового запроса показываем все б/у запчасти
              dispatch(fetchAllProducts());
            }
          }}
          className={`px-6 py-4 sm:px-4 sm:py-2 rounded-lg font-medium text-base sm:text-sm md:text-base transition-colors min-h-[48px] sm:min-h-0 ${activeTab === 'my'
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
        >
          Б/У запчасти
        </button>
        
        {/* View toggle buttons - only show when on Used Parts tab */}
        {activeTab === 'my' && (
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setUsedPartsView('grid')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${usedPartsView === 'grid'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              title="Вид карточками"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
              </svg>
              <span className="hidden sm:inline">Карточки</span>
            </button>
            <button
              onClick={() => setUsedPartsView('list')}
              className={`px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 ${usedPartsView === 'list'
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
              title="Вид списком"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
              <span className="hidden sm:inline">Список</span>
            </button>
          </div>
        )}
      </div>

      {/* Отображение контента в зависимости от вкладки */}
      {activeTab === 'my' ? (
        <UsedPartsList viewMode={usedPartsView} />
      ) : (
        <>

          {hasRosskoResults ? (
            <>
              <div className="font-medium text-xl sm:text-xl my-6 sm:my-10 px-4 sm:px-0">
                <h2 className="border-b-4 border-blue-500 pb-2 inline-block">В наличии</h2>
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
                    {allParts.map((part, idx) => {
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
                {allParts.map((part, idx) => {
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

              {allCrossParts.length > 0 && (
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
                        {allCrossParts.map((part, idx) => {
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
                    {allCrossParts.map((part, idx) => {
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
