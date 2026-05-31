import React, { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { selectRosskoItems } from '../../../redux/slices/RosskoSlice';
import { trackFormField } from '../../../utils/siteAnalytics';

const COLLAPSED_FILTER_LIMIT = 3;

/**
 * Фильтры результатов Rossko (новые запчасти).
 * @param {function} props.updateNewPartsUrl
 * @param {boolean} [props.showClearInPanel=true] — кнопка «Сбросить» внутри панели (десктоп).
 */
export default function NewPartsFiltersForm({ updateNewPartsUrl, showClearInPanel = true }) {
  const [searchParams] = useSearchParams();
  const [expandedBrandFilters, setExpandedBrandFilters] = useState(false);
  const partsData = useSelector(selectRosskoItems);

  const selectedBrands = searchParams.getAll('brand');
  const priceMin = searchParams.get('vmin') || '';
  const priceMax = searchParams.get('vmax') || '';
  const inStockOnly = searchParams.get('in_stock') === '1';
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
    allParts.forEach((part) => {
      let crossParts = part?.crosses?.Part;
      if (crossParts) {
        if (!Array.isArray(crossParts)) crossParts = [crossParts];
        crossParts.forEach((cp) => {
          if (cp?.brand) brands.add(cp.brand);
        });
      }
    });
    return Array.from(brands)
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((value) => ({ value, label: value }));
  }, [allParts]);

  const setFilter = (key, value) => {
    if (!updateNewPartsUrl) return;
    trackFormField('new_parts_filters', key);
    updateNewPartsUrl({ [key]: value });
  };

  const toggleBrand = (brand) => {
    trackFormField('new_parts_filters', 'brand');
    const next = selectedBrands.includes(brand)
      ? selectedBrands.filter((b) => b !== brand)
      : [...selectedBrands, brand];
    setFilter('brand', next.length ? next : null);
  };

  const clearFilters = () => {
    if (!updateNewPartsUrl) return;
    updateNewPartsUrl({
      brand: null,
      vmin: null,
      vmax: null,
      in_stock: null,
      show_analogs: null,
    });
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

  return (
    <div className="space-y-4">
      <div>
        <p className="mb-2 block text-xs font-medium text-gray-600">Бренды</p>
        <div className="space-y-2">
          {visibleBrands.length > 0 ? (
            visibleBrands.map((b) => (
              <label key={b.value} className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={selectedBrands.includes(b.value)}
                  onChange={() => toggleBrand(b.value)}
                  className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                />
                <span className="min-w-0 flex-1 truncate">{b.label}</span>
              </label>
            ))
          ) : (
            <p className="text-xs text-gray-400">Нет вариантов</p>
          )}
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
      <div className="grid grid-cols-2 gap-2">
        <input
          type="number"
          placeholder="Цена от"
          value={priceMin}
          onChange={(e) => setFilter('vmin', e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          type="number"
          placeholder="Цена до"
          value={priceMax}
          onChange={(e) => setFilter('vmax', e.target.value || null)}
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
      </div>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={inStockOnly}
          onChange={(e) => setFilter('in_stock', e.target.checked ? '1' : null)}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Только в наличии
      </label>
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={showAnalogs}
          onChange={(e) => setFilter('show_analogs', e.target.checked ? null : '0')}
          className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
        />
        Показать аналоги
      </label>
      {showClearInPanel && (
        <button
          type="button"
          onClick={clearFilters}
          className="w-full text-sm font-medium text-indigo-600 hover:text-indigo-800"
        >
          Сбросить фильтры
        </button>
      )}
    </div>
  );
}
