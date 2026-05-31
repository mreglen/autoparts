import React, { useMemo, useCallback } from 'react';
import { Link, useLocation, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectRosskoItems, selectSearchQuery, selectRosskoStatus } from '../../../redux/slices/RosskoSlice';
import CardPart from '../CardPart/CardPart';
import NewPartsEmptyResults from './NewPartsEmptyResults';
import NewPartsFiltersForm from './NewPartsFiltersForm';
import {
  getRosskoStockCount,
  getRosskoMinPrice,
  getRosskoEarliestDelivery,
  mapPartToStocksData,
} from './rosskoHelpers';

const NewPartsResults = ({ updateNewPartsUrl, onSearch, expandedPartId, onToggleExpand }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const partsData = useSelector(selectRosskoItems);
  const searchQuery = useSelector(selectSearchQuery);
  const status = useSelector(selectRosskoStatus);

  const selectedBrands = searchParams.getAll('brand');
  const priceMin = searchParams.get('vmin') || '';
  const priceMax = searchParams.get('vmax') || '';
  const inStockOnly = searchParams.get('in_stock') === '1';
  const rosskoSort = searchParams.get('sort') || 'price_asc';
  const showAnalogs = searchParams.get('show_analogs') !== '0';

  let rawParts = partsData?.PartsList?.Part;
  if (!Array.isArray(rawParts)) {
    rawParts = rawParts ? [rawParts] : [];
  }
  const allParts = rawParts;

  const filterRosskoPart = useCallback((part) => {
    if (selectedBrands.length > 0 && !selectedBrands.includes(part?.brand)) return false;
    const price = getRosskoMinPrice(part);
    if (priceMin && price < parseFloat(priceMin)) return false;
    if (priceMax && price > parseFloat(priceMax)) return false;
    if (inStockOnly && getRosskoStockCount(part) <= 0) return false;
    return true;
  }, [selectedBrands, priceMin, priceMax, inStockOnly]);

  const sortRosskoParts = useCallback((parts) => {
    const sorted = [...parts];
    sorted.sort((a, b) => {
      if (rosskoSort === 'price_desc') {
        return getRosskoMinPrice(b) - getRosskoMinPrice(a);
      }
      if (rosskoSort === 'brand') {
        return String(a?.brand || '').localeCompare(String(b?.brand || ''), 'ru');
      }
      if (rosskoSort === 'delivery_asc') {
        return getRosskoEarliestDelivery(a) - getRosskoEarliestDelivery(b);
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

  const hasResults = filteredRosskoParts.length > 0 || filteredCrossParts.length > 0;

  const renderPartRows = (parts, idPrefix, sectionType, isMobile) => {
    const Container = isMobile ? 'div' : 'tbody';
    const containerProps = isMobile ? { className: 'space-y-5' } : { className: 'bg-white divide-y divide-gray-200' };

    return (
      <Container {...containerProps}>
        {parts.map((part, idx) => {
          const uniqueId = `${idPrefix}-${part.guid || part.id || idx}`;
          const stocksData = mapPartToStocksData(part);
          return (
            <CardPart
              key={uniqueId}
              part={part}
              stocksData={stocksData}
              showAllStocks
              sectionType={sectionType}
              uniqueId={uniqueId}
              expandedPartId={expandedPartId}
              onToggleExpand={onToggleExpand}
              isMobile={isMobile}
            />
          );
        })}
      </Container>
    );
  };

  if (status === 'succeeded' && !hasResults) {
    return <NewPartsEmptyResults query={searchQuery} onSearch={onSearch} />;
  }

  return (
    <>
      <h1 className="sr-only">
        {searchQuery ? `Результаты поиска: ${searchQuery}` : 'Новые запчасти с доставкой'}
      </h1>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-0 md:hidden">
        <p className="text-sm text-gray-600">
          Найдено: <span className="font-semibold text-gray-900">{filteredRosskoParts.length}</span>
          {showAnalogs && filteredCrossParts.length > 0 && (
            <span className="text-gray-500"> · аналогов: {filteredCrossParts.length}</span>
          )}
        </p>
        <Link
          to={{ pathname: '/autoparts/new/filters', search: location.search }}
          className="rounded-full bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800"
        >
          Фильтры
        </Link>
      </div>

      <p className="mb-4 hidden px-3 text-sm text-gray-600 sm:px-0 md:block">
        Найдено: <span className="font-semibold text-gray-900">{filteredRosskoParts.length}</span>
        {showAnalogs && filteredCrossParts.length > 0 && (
          <span className="text-gray-500"> · аналогов: {filteredCrossParts.length}</span>
        )}
      </p>

      <div className="mx-3 mb-4 hidden space-y-4 rounded-lg border border-gray-200 bg-white p-4 sm:mx-0 md:block">
        <NewPartsFiltersForm updateNewPartsUrl={updateNewPartsUrl} />
      </div>

      {filteredRosskoParts.length > 0 && (
        <>
          <div className="font-medium text-lg my-4">
            <h2 className="border-b-4 border-indigo-500 pb-2 inline-block">По вашему запросу</h2>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-20">Бренд</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-24">Номер</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-64">Наименование</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-36">Поставка</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-24">Остаток</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-20">Цена, ₽</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-24">К заказу</th>
                </tr>
              </thead>
              {renderPartRows(filteredRosskoParts, 'available', 'available', false)}
            </table>
          </div>
          <div className="md:hidden space-y-5">
            {renderPartRows(filteredRosskoParts, 'mobile-available', 'available', true)}
          </div>
        </>
      )}

      {showAnalogs && filteredCrossParts.length > 0 && (
        <>
          <div className="font-medium text-lg my-6">
            <h2 className="border-b-4 border-blue-500 pb-2 inline-block">Аналоги</h2>
          </div>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 table-fixed">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-20">Бренд</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-24">Номер</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-64">Наименование</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-36">Поставка</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-24">Остаток</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-20">Цена, ₽</th>
                  <th className="px-4 py-2 text-left text-sm font-medium text-gray-500 uppercase w-24">К заказу</th>
                </tr>
              </thead>
              {renderPartRows(filteredCrossParts, 'analog', 'analog', false)}
            </table>
          </div>
          <div className="md:hidden space-y-5">
            {renderPartRows(filteredCrossParts, 'mobile-analog', 'analog', true)}
          </div>
        </>
      )}
    </>
  );
};

export default NewPartsResults;
