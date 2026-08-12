import React, { useMemo, useCallback } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectRosskoItems, selectSearchQuery, selectRosskoStatus } from '../../../redux/slices/RosskoSlice';
import NewPartsEmptyResults from './NewPartsEmptyResults';
import NewPartsFiltersForm from './NewPartsFiltersForm';
import UsedPartsSearchCount from './UsedPartsSearchCount';
import VinCatalogOffersTable from '../VinCatalog/VinCatalogOffersTable';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import {
  getRosskoStockCount,
  getRosskoMinPrice,
  getRosskoEarliestDelivery,
} from './rosskoHelpers';

const toSafeText = (value, fallback = '') => {
  if (typeof value === 'string') return value.trim() || fallback;
  if (typeof value === 'number') return String(value);
  if (!value) return fallback;
  if (typeof value === 'object') {
    if (typeof value.msg === 'string' && value.msg.trim()) return value.msg.trim();
    if (typeof value.input === 'string' && value.input.trim()) return value.input.trim();
    return fallback;
  }
  return fallback;
};

const NewPartsResults = ({ updateNewPartsUrl, onSearch }) => {
  const location = useLocation();
  const navigate = useNavigate();
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
  const safeSearchQuery = toSafeText(searchQuery, '');
  const safeUrlQuery = toSafeText(searchParams.get('q'), '');

  const backToListPath = `/autoparts/new${location.search || ''}`;

  const handleOpenPart = useCallback(({ part, brand, number, detailHref }) => {
    const href = detailHref || buildNewPartOpenPath({
      brand,
      article: number,
      backTo: backToListPath,
    });
    navigate(href, {
      state: {
        backTo: backToListPath,
        rosskoPart: part,
      },
    });
  }, [backToListPath, navigate]);

  const renderPartsTable = (parts, emptyText) => (
    <VinCatalogOffersTable
      parts={parts}
      emptyText={emptyText}
      onOpenPart={handleOpenPart}
    />
  );

  const renderSection = (title, parts, accentClass, emptyText) => (
    <>
      <div className="my-4 text-lg font-medium">
        <h2 className={`inline-block border-b-4 pb-2 ${accentClass}`}>{title}</h2>
      </div>
      {renderPartsTable(parts, emptyText)}
    </>
  );

  if (status === 'succeeded' && !hasResults) {
    return <NewPartsEmptyResults query={searchQuery} onSearch={onSearch} />;
  }

  return (
    <div className="mt-0 w-full px-0 max-md:pb-2">
      <h1 className="sr-only">
        {safeSearchQuery ? `Результаты поиска: ${safeSearchQuery}` : 'Новые запчасти с доставкой'}
      </h1>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-0">
        <p className="text-sm text-gray-600">
          Найдено: <span className="font-semibold text-gray-900">{filteredRosskoParts.length}</span>
          {showAnalogs && filteredCrossParts.length > 0 && (
            <span className="text-gray-500"> · аналогов: {filteredCrossParts.length}</span>
          )}
          <UsedPartsSearchCount query={safeSearchQuery || safeUrlQuery} />
        </p>
        <Link
          to={{ pathname: '/autoparts/new/filters', search: location.search }}
          className="rounded-full bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 lg:hidden"
        >
          Фильтры
        </Link>
      </div>

      <div className="flex flex-col gap-4 px-3 sm:gap-6 sm:px-0 lg:flex-row">
        <aside className="hidden w-full flex-shrink-0 lg:block lg:w-64">
          <div className="rounded-lg border border-gray-200 bg-white p-4 lg:sticky lg:top-[calc(var(--sg-desktop-header-h)+1rem)]">
            <h3 className="mb-3 font-semibold text-gray-900">Фильтры</h3>
            <NewPartsFiltersForm updateNewPartsUrl={updateNewPartsUrl} showClearInPanel />
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {filteredRosskoParts.length > 0 && (
            renderSection(
              'По вашему запросу',
              filteredRosskoParts,
              'border-indigo-500',
              'Нет предложений по запросу',
            )
          )}

          {showAnalogs && filteredCrossParts.length > 0 && (
            renderSection(
              'Аналоги',
              filteredCrossParts,
              'border-blue-500',
              'Нет аналогов',
            )
          )}
        </div>
      </div>
    </div>
  );
};

export default NewPartsResults;
