import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import {
  selectCatalogItems,
  selectCatalogFacets,
  selectPublicPartTypes,
} from '../../../redux/slices/ProductSlice';
import { isUsedCatalogBrowseMode } from '../../../utils/autopartsPublic';

const selectUsedPartsData = (state) => state.products.usedPartsData;

const COLLAPSED_FILTER_LIMIT = 3;

/**
 * Содержимое панели фильтров б/у (каталог и поиск).
 * @param {function} props.updateCatalogUrl
 * @param {boolean} [props.showClearInPanel=true] — кнопка «Сбросить» внутри панели (десктоп).
 */
export default function UsedPartsFiltersForm({ updateCatalogUrl, showClearInPanel = true }) {
  const [searchParams] = useSearchParams();
  const [expandedFilterGroups, setExpandedFilterGroups] = useState({});

  const usedPartsData = useSelector(selectUsedPartsData);
  const catalogItems = useSelector(selectCatalogItems);
  const catalogFacets = useSelector(selectCatalogFacets);
  const publicPartTypes = useSelector(selectPublicPartTypes);
  const isCatalogMode = isUsedCatalogBrowseMode(searchParams);

  const availableParts = useMemo(
    () => (isCatalogMode ? catalogItems : (usedPartsData?.available_parts || [])),
    [isCatalogMode, catalogItems, usedPartsData]
  );
  const analogParts = useMemo(
    () => (isCatalogMode ? [] : (usedPartsData?.analog_parts || [])),
    [isCatalogMode, usedPartsData]
  );

  const activeFilters = useMemo(() => ({
    partTypes: searchParams.getAll('part_type'),
    brands: searchParams.getAll('brand'),
    priceMin: searchParams.get('vmin') || '',
    priceMax: searchParams.get('vmax') || '',
    vehicleBrands: searchParams.getAll('vb'),
    vehicleModels: searchParams.getAll('vm'),
    hasPhotos: searchParams.get('has_photos') === '1',
  }), [searchParams]);

  const searchFacets = useMemo(() => {
    const countValues = (values) => {
      const counts = new Map();
      values.filter(Boolean).forEach((value) => {
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => String(a.value).localeCompare(String(b.value), 'ru'));
    };

    const parts = [...availableParts, ...analogParts];
    const vehicleBrands = [];
    const vehicleModels = [];

    parts.forEach((part) => {
      (part.compatible_vehicles || []).forEach((vehicle) => {
        vehicleBrands.push(vehicle.brand);
        vehicleModels.push(vehicle.model);
      });
    });

    return {
      brands: countValues(parts.map((part) => part.brand)),
      vehicle_brands: countValues(vehicleBrands),
      vehicle_models: countValues(vehicleModels),
    };
  }, [availableParts, analogParts]);

  const brandOptions = isCatalogMode ? (catalogFacets?.brands || []) : searchFacets.brands;
  const vehicleBrandOptions = isCatalogMode ? (catalogFacets?.vehicle_brands || []) : searchFacets.vehicle_brands;
  const vehicleModelOptions = isCatalogMode ? (catalogFacets?.vehicle_models || []) : searchFacets.vehicle_models;

  const setFilter = (key, value) => {
    if (!updateCatalogUrl) return;
    updateCatalogUrl({ [key]: value });
  };

  const toggleMultiFilter = (key, value) => {
    const currentValues = searchParams.getAll(key);
    const nextValues = currentValues.includes(String(value))
      ? currentValues.filter((item) => item !== String(value))
      : [...currentValues, String(value)];
    setFilter(key, nextValues);
  };

  const clearFilters = () => {
    if (!updateCatalogUrl) return;
    updateCatalogUrl({
      part_type: null,
      brand: null,
      vmin: null,
      vmax: null,
      vb: null,
      vm: null,
      vehicle_id: null,
      has_photos: null,
    });
  };

  const toggleFilterGroup = (groupKey) => {
    setExpandedFilterGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const buildFilterOptionsList = (options, selectedValues) => {
    const selectedSet = new Set(selectedValues.map(String));
    const withSelectedValues = [...options];
    const knownValues = new Set(options.map((option) => String(option.value)));

    selectedSet.forEach((value) => {
      if (!knownValues.has(value)) {
        withSelectedValues.push({ value, label: value });
      }
    });

    return withSelectedValues;
  };

  const getCollapsedFilterOptions = (allOptions, selectedValues) => {
    const selectedSet = new Set(selectedValues.map(String));
    const visible = [];
    const seen = new Set();

    allOptions.forEach((option) => {
      const optionValue = String(option.value);
      if ((visible.length < COLLAPSED_FILTER_LIMIT || selectedSet.has(optionValue)) && !seen.has(optionValue)) {
        visible.push(option);
        seen.add(optionValue);
      }
    });

    return visible;
  };

  const renderCheckboxGroup = ({ title, groupKey, options, selectedValues, urlKey }) => {
    const allOptions = buildFilterOptionsList(options, selectedValues);
    const collapsedOptions = getCollapsedFilterOptions(allOptions, selectedValues);
    const isExpanded = Boolean(expandedFilterGroups[groupKey]);
    const visibleOptions = isExpanded ? allOptions : collapsedOptions;
    const showToggle = allOptions.length > COLLAPSED_FILTER_LIMIT;

    return (
      <div>
        <p className="block text-xs font-medium text-gray-600 mb-2">{title}</p>
        <div className="space-y-2">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => {
              const value = String(option.value);
              return (
                <label key={value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(value)}
                    onChange={() => toggleMultiFilter(urlKey, value)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label || option.value}</span>
                  {typeof option.count === 'number' && (
                    <span className="text-xs text-gray-400">{option.count}</span>
                  )}
                </label>
              );
            })
          ) : (
            <p className="text-xs text-gray-400">Нет вариантов</p>
          )}
        </div>
        {showToggle && (
          <button
            type="button"
            onClick={() => toggleFilterGroup(groupKey)}
            className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            {isExpanded ? 'Скрыть' : 'Показать больше'}
          </button>
        )}
      </div>
    );
  };

  const partTypeOptions = publicPartTypes.map((partType) => ({
    value: String(partType.id),
    label: partType.name,
  }));

  return (
    <div className="space-y-4">
      {renderCheckboxGroup({
        title: 'Категории',
        groupKey: 'partTypes',
        options: partTypeOptions,
        selectedValues: activeFilters.partTypes,
        urlKey: 'part_type',
      })}
      {renderCheckboxGroup({
        title: 'Бренды',
        groupKey: 'brands',
        options: brandOptions,
        selectedValues: activeFilters.brands,
        urlKey: 'brand',
      })}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Цена от" value={searchParams.get('vmin') || ''} onChange={(e) => setFilter('vmin', e.target.value || null)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <input type="number" placeholder="Цена до" value={searchParams.get('vmax') || ''} onChange={(e) => setFilter('vmax', e.target.value || null)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      {renderCheckboxGroup({
        title: 'Марки авто',
        groupKey: 'vehicleBrands',
        options: vehicleBrandOptions,
        selectedValues: activeFilters.vehicleBrands,
        urlKey: 'vb',
      })}
      {renderCheckboxGroup({
        title: 'Модели',
        groupKey: 'vehicleModels',
        options: vehicleModelOptions,
        selectedValues: activeFilters.vehicleModels,
        urlKey: 'vm',
      })}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={searchParams.get('has_photos') === '1'} onChange={(e) => setFilter('has_photos', e.target.checked ? '1' : null)} />
        Только с фото
      </label>
      {showClearInPanel && (
        <button type="button" onClick={clearFilters} className="w-full text-sm text-indigo-600 hover:text-indigo-800 font-medium">Сбросить фильтры</button>
      )}
    </div>
  );
}
