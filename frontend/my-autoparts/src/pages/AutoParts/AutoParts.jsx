// src/components/AutoParts.js
import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
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
import { searchAllProducts, fetchAllProducts } from '../../redux/slices/ProductSlice';
import { fetchCart } from '../../redux/slices/CartSlice';
import CardPart from './CardPart/CardPart';
import UsedPartsList from './UsedParts/UsedPartsList';

const EmptySearchState = ({ query }) => (
  <div className="mt-8 sm:mt-16 flex flex-col items-center text-center max-w-2xl mx-auto px-4">
    <div className="bg-gray-100 p-4 rounded-full mb-6">
      <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    </div>
    <h2 className="text-xl sm:text-2xl font-bold text-gray-800 mb-2">Ничего не найдено</h2>
    {query ? (
      <p className="text-gray-600 text-sm sm:text-base">
        По запросу <span className="font-medium text-indigo-600">«{query}»</span> не найдено ни одной запчасти.
      </p>
    ) : (
      <p className="text-gray-600 text-sm sm:text-base">
        Введите артикул, бренд или наименование запчасти в строку поиска.
      </p>
    )}
  </div>
);



function AutoParts() {
  const dispatch = useDispatch();
  const partsData = useSelector(selectRosskoItems);
  const status = useSelector(selectRosskoStatus);
  const error = useSelector(selectRosskoError);
  const searchQuery = useSelector(selectSearchQuery);

  // Состояние для переключения вкладок
  const [activeTab, setActiveTab] = useState('rossko');

  // Состояние для раскрытия карточек
  const [expandedPartId, setExpandedPartId] = useState(null);

  // Функция для переключения раскрытия карточки
  const handleToggleExpand = (partId) => {
    setExpandedPartId(expandedPartId === partId ? null : partId);
  };

  // При изменении searchQuery — обновляем "Мои запчасти"
  useEffect(() => {
    if (activeTab === 'my') {
      if (searchQuery) {
        dispatch(searchAllProducts(searchQuery));
      } else {
        // Загружаем все продукты если нет поискового запроса
        dispatch(fetchAllProducts());
      }
    }
  }, [searchQuery, activeTab, dispatch]);

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
    <div className="mt-5 px-4 sm:px-0">
      <h1 className="font-bold text-xl sm:text-2xl my-5">
        {/* {searchQuery || 'Результаты поиска'} */}
        Автозапчасти
      </h1>

      {/* Переключатель вкладок */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-4 mb-6">
        <button
          onClick={() => setActiveTab('rossko')}
          className={`px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors ${
            activeTab === 'rossko'
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
              dispatch(searchAllProducts(searchQuery));
            } else {
              dispatch(fetchAllProducts());
            }
          }}
          className={`px-4 py-2 rounded-lg font-medium text-sm sm:text-base transition-colors ${
            activeTab === 'my'
              ? 'bg-indigo-500 text-white'
              : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          Б/У запчасти
        </button>
      </div>

      {/* Отображение контента в зависимости от вкладки */}
      {activeTab === 'my' ? (
        <UsedPartsList />
      ) : (
        <>

          {hasRosskoResults ? (
            <>
              <div className="font-medium text-base sm:text-lg my-6 sm:my-10">
                <h2 className="border-b-4 border-blue-500 pb-2 inline-block">В наличии</h2>
              </div>

              {/* Десктопная версия - таблица */}
              <div className="hidden md:block">
                <table className="min-w-full divide-y divide-gray-200 table-fixed">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Бренд</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Номер</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">Наименование</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Поставка</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Остаток</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Цена, ₽</th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">К заказу</th>
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
              <div className="md:hidden space-y-4">
                {allParts.map((part, idx) => {
                  const uniqueId = `mobile-available-${part.guid || part.id || idx}`;
                  let stocksData = [];
                  if (part.stocks && part.stocks.stock) {
                    const stocksArray = Array.isArray(part.stocks.stock) ? part.stocks.stock : [part.stocks.stock];
                    stocksData = stocksArray.filter(stock => stock && typeof stock === 'object').map(stock => ({
                      stock_id: stock.id,
                      stock_id: stock.id,
                      price: parseFloat(stock.price) || 0,
                      available_count: parseInt(stock.count) || 0,
                      delivery_start: stock.deliveryStart,
                      delivery_end: stock.deliveryEnd,
                      description: stock.description
                    }));
                  }

                  const mainStock = stocksData.find(stock => stock.price && stock.price !== '0' && stock.price !== 0 && stock.available_count > 0);

                  if (!mainStock) return null;

                  return (
                    <div key={uniqueId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                      <div className="flex justify-between items-start mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900">{part.brand || '—'}</span>
                            <span className="text-xs text-gray-500">•</span>
                            <span className="text-xs text-gray-500">{part.partnumber || '—'}</span>
                          </div>
                          <h3 className="text-sm font-medium text-gray-900 mb-2">{part.name || '—'}</h3>
                        </div>
                        <div className="text-right">
                          <div className="text-sm font-semibold text-gray-900">
                            {mainStock.price ? `${(parseFloat(mainStock.price) * 1.15).toFixed(2)} ₽` : '—'}
                          </div>
                          <div className="text-xs text-gray-500">{mainStock.available_count} шт.</div>
                        </div>
                      </div>

                      <div className="flex justify-between items-center">
                        <div className="text-xs text-gray-500">
                          {mainStock.delivery_start && mainStock.delivery_end ? (
                            `Доставка: ${new Date(mainStock.delivery_start).toLocaleDateString('ru-RU')}`
                          ) : '—'}
                        </div>
                        <button
                          onClick={() => handleToggleExpand(uniqueId)}
                          className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700 transition-colors"
                        >
                          В корзину
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>

              {allCrossParts.length > 0 && (
                <>
                  <div className="font-medium text-base sm:text-lg my-6 sm:my-10">
                    <h2 className="border-b-4 border-blue-500 pb-2 inline-block">Аналоги</h2>
                  </div>

                  {/* Десктопная версия аналогов */}
                  <div className="hidden md:block">
                    <table className="min-w-full divide-y divide-gray-200 table-fixed">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Бренд</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Номер</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-64">Наименование</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-36">Поставка</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">Остаток</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">Цена, ₽</th>
                          <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">К заказу</th>
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
                  <div className="md:hidden space-y-4">
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

                      const mainStock = stocksData.find(stock => stock.price && stock.price !== '0' && stock.price !== 0 && stock.available_count > 0);

                      if (!mainStock) return null;

                      return (
                        <div key={uniqueId} className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm">
                          <div className="flex justify-between items-start mb-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-medium text-gray-900">{part.brand || '—'}</span>
                                <span className="text-xs text-gray-500">•</span>
                                <span className="text-xs text-gray-500">{part.partnumber || '—'}</span>
                              </div>
                              <h3 className="text-sm font-medium text-gray-900 mb-2">{part.name || '—'}</h3>
                              <div className="text-xs text-orange-600 font-medium">Аналог</div>
                            </div>
                            <div className="text-right">
                              <div className="text-sm font-semibold text-gray-900">
                                {mainStock.price ? `${(parseFloat(mainStock.price) * 1.15).toFixed(2)} ₽` : '—'}
                              </div>
                              <div className="text-xs text-gray-500">{mainStock.available_count} шт.</div>
                            </div>
                          </div>

                          <div className="flex justify-between items-center">
                            <div className="text-xs text-gray-500">
                              {mainStock.delivery_start && mainStock.delivery_end ? (
                                `Доставка: ${new Date(mainStock.delivery_start).toLocaleDateString('ru-RU')}`
                              ) : '—'}
                            </div>
                            <button
                              onClick={() => handleToggleExpand(uniqueId)}
                              className="px-3 py-1 bg-orange-600 text-white text-xs rounded-md hover:bg-orange-700 transition-colors"
                            >
                              В корзину
                            </button>
                          </div>
                        </div>
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