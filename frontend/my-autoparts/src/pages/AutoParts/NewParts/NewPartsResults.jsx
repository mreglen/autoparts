import React, { useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectRosskoItems, selectSearchQuery, selectRosskoStatus } from '../../../redux/slices/RosskoSlice';
import CardPart from '../CardPart/CardPart';
import NewPartsEmptyResults from './NewPartsEmptyResults';
import {
  getRosskoStockCount,
  getRosskoMinPrice,
  getRosskoEarliestDelivery,
  mapPartToStocksData,
} from './rosskoHelpers';

const COLLAPSED_FILTER_LIMIT = 3;

const NewPartsResults = ({ updateNewPartsUrl, onSearch, expandedPartId, onToggleExpand }) => {
  const [searchParams] = useSearchParams();
  const [expandedBrandFilters, setExpandedBrandFilters] = useState(false);
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

  const rosskoBrands = useMemo(() => {
    const brands = new Set();
    allParts.forEach((p) => {
      if (p?.brand) brands.add(p.brand);
    });
    [...allParts].forEach((part) => {
      let crossParts = part?.crosses?.Part;
      if (crossParts) {
        if (!Array.isArray(crossParts)) crossParts = [crossParts];
        crossParts.forEach((cp) => {
          if (cp?.brand) brands.add(cp.brand);
        });
      }
    });
    return Array.from(brands).sort((a, b) => a.localeCompare(b, 'ru')).map((value) => ({ value, label: value }));
  }, [allParts]);

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

  const setFilter = (key, value) => {
    if (!updateNewPartsUrl) return;
    updateNewPartsUrl({ [key]: value });
  };

  const toggleBrand = (brand) => {
    const next = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];
    setFilter('brand', next.length ? next : null);
  };

  const visibleBrands = useMemo(() => {
    const selectedSet = new Set(selectedBrands);
    if (expandedBrandFilters) return rosskoBrands;
    const visible = [];
    const seen = new Set();
    rosskoBrands.forEach((option) => {
      const v = option.value;
      if ((visible.length < COLLAPSED_FILTER_LIMIT || selectedSet.has(v)) && !seen.has(v)) {
        visible.push(option);
        seen.add(v);
      }
    });
    selectedSet.forEach((v) => {
      if (!seen.has(v)) {
        visible.push({ value: v, label: v });
      }
    });
    return visible;
  }, [rosskoBrands, selectedBrands, expandedBrandFilters]);

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
      <p className="text-sm text-gray-600 mb-4">
        Найдено: <span className="font-semibold text-gray-900">{filteredRosskoParts.length}</span>
        {showAnalogs && filteredCrossParts.length > 0 && (
          <span className="text-gray-500"> · аналогов: {filteredCrossParts.length}</span>
        )}
      </p>

      <div className="mb-4 p-4 bg-white rounded-lg border border-gray-200 space-y-4">
        <div>
          <p className="text-xs font-medium text-gray-600 mb-2">Бренды</p>
          <div className="space-y-2 max-h-40 overflow-y-auto">
            {visibleBrands.map((b) => (
              <label key={b.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.value)}
                  onChange={() => toggleBrand(b.value)}
                  className="rounded border-gray-300 text-indigo-600"
                />
                <span>{b.label}</span>
              </label>
            ))}
          </div>
          {rosskoBrands.length > COLLAPSED_FILTER_LIMIT && (
            <button
              type="button"
              onClick={() => setExpandedBrandFilters((prev) => !prev)}
              className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
            >
              {expandedBrandFilters ? 'Скрыть' : 'Показать больше'}
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="number"
            placeholder="Цена от"
            value={priceMin}
            onChange={(e) => setFilter('vmin', e.target.value || null)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <input
            type="number"
            placeholder="Цена до"
            value={priceMax}
            onChange={(e) => setFilter('vmax', e.target.value || null)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          />
          <select
            value={rosskoSort}
            onChange={(e) => setFilter('sort', e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm"
          >
            <option value="price_asc">Дешевле</option>
            <option value="price_desc">Дороже</option>
            <option value="delivery_asc">Быстрее по поставке</option>
            <option value="brand">По бренду</option>
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setFilter('in_stock', e.target.checked ? '1' : null)}
            />
            Только в наличии
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={showAnalogs}
            onChange={(e) => setFilter('show_analogs', e.target.checked ? null : '0')}
          />
          Показать аналоги
        </label>
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
