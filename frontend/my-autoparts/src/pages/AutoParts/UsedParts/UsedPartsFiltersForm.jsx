import React, { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import { trackFormField } from '../../../utils/siteAnalytics';
import {
  usedDraftFromSearchParams,
  usedDraftHasActiveFilters,
  usedDraftsEqual,
  usedDraftToUrlUpdates,
  usedEmptyDraft,
  usedHasActiveFilters,
} from '../../../utils/autopartsFilters';
import {
  selectCatalogFacets,
  selectPublicPartTypes,
} from '../../../redux/slices/ProductSlice';
import {
  isUsedCatalogBrowseMode,
  USED_SORT_OPTIONS,
  getUsedUiSort,
  uiSortToApi,
} from '../../../utils/autopartsPublic';
import SortFilterSection from '../../../components/Autoparts/SortFilterSection';

const COLLAPSED_FILTER_LIMIT = 3;

/**
 * Содержимое панели фильтров б/у (каталог и поиск).
 * @param {function} props.updateCatalogUrl
 * @param {boolean} [props.showClearInPanel=true] — кнопка «Сбросить» внутри панели (десктоп).
 * @param {boolean} [props.deferApply=false] — на десктопе: применять фильтры по кнопке.
 */
function UsedPartsFiltersForm({
  updateCatalogUrl,
  showClearInPanel = true,
  deferApply = false,
}) {
  const [searchParams] = useSearchParams();
  const [expandedFilterGroups, setExpandedFilterGroups] = useState({});
  const [draftFilters, setDraftFilters] = useState(() => usedDraftFromSearchParams(searchParams));

  useEffect(() => {
    if (!deferApply) return;
    setDraftFilters(usedDraftFromSearchParams(searchParams));
  }, [searchParams, deferApply]);

  const catalogFacets = useSelector(selectCatalogFacets);
  const publicPartTypes = useSelector(selectPublicPartTypes);
  const isCatalogMode = isUsedCatalogBrowseMode(searchParams);

  const legacyAvailableParts = useSelector((state) => (
    isCatalogMode ? null : (state.products.usedPartsData?.available_parts || [])
  ));
  const legacyAnalogParts = useSelector((state) => (
    isCatalogMode ? null : (state.products.usedPartsData?.analog_parts || [])
  ));

  const availableParts = useMemo(
    () => (isCatalogMode ? [] : (legacyAvailableParts || [])),
    [isCatalogMode, legacyAvailableParts],
  );
  const analogParts = useMemo(
    () => (isCatalogMode ? [] : (legacyAnalogParts || [])),
    [isCatalogMode, legacyAnalogParts],
  );

  const appliedFilters = useMemo(() => usedDraftFromSearchParams(searchParams), [searchParams]);
  const activeFilters = deferApply ? draftFilters : appliedFilters;

  const hasPendingChanges = deferApply
    && !usedDraftsEqual(draftFilters, appliedFilters);
  const hasDraftFilters = deferApply && usedDraftHasActiveFilters(draftFilters);
  const hasAppliedFilters = usedHasActiveFilters(searchParams);

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

  const draftFieldByUrlKey = {
    part_type: 'partTypes',
    brand: 'brands',
    vb: 'vehicleBrands',
    vm: 'vehicleModels',
    vmin: 'priceMin',
    vmax: 'priceMax',
    has_photos: 'hasPhotos',
  };

  const updateDraftField = (field, value) => {
    setDraftFilters((prev) => ({ ...prev, [field]: value }));
  };

  const setFilter = (key, value) => {
    trackFormField('used_parts_filters', key);
    if (deferApply) {
      const field = draftFieldByUrlKey[key];
      if (field === 'hasPhotos') {
        updateDraftField('hasPhotos', value === '1');
        return;
      }
      if (field) {
        updateDraftField(field, value ?? (key === 'vmin' || key === 'vmax' ? '' : []));
      }
      return;
    }
    if (!updateCatalogUrl) return;
    updateCatalogUrl({ [key]: value });
  };

  const toggleMultiFilter = (key, value) => {
    trackFormField('used_parts_filters', key);
    const field = draftFieldByUrlKey[key];
    if (deferApply && field) {
      setDraftFilters((prev) => {
        const currentValues = prev[field];
        const nextValues = currentValues.includes(String(value))
          ? currentValues.filter((item) => item !== String(value))
          : [...currentValues, String(value)];
        return { ...prev, [field]: nextValues };
      });
      return;
    }
    const currentValues = searchParams.getAll(key);
    const nextValues = currentValues.includes(String(value))
      ? currentValues.filter((item) => item !== String(value))
      : [...currentValues, String(value)];
    setFilter(key, nextValues);
  };

  const currentSort = deferApply ? draftFilters.sort : getUsedUiSort(searchParams);

  const setSort = (uiSort) => {
    if (deferApply) {
      updateDraftField('sort', uiSort);
      return;
    }
    const apiValue = uiSortToApi(uiSort);
    setFilter('sort', apiValue === 'created_at_desc' ? null : apiValue);
  };

  const clearFilters = () => {
    if (deferApply) {
      const empty = usedEmptyDraft();
      setDraftFilters(empty);
      if (!updateCatalogUrl) return;
      updateCatalogUrl({
        ...usedDraftToUrlUpdates(empty),
        vehicle_id: null,
      });
      return;
    }
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
      sort: null,
    });
  };

  const applyFilters = () => {
    if (!updateCatalogUrl || !deferApply) return;
    updateCatalogUrl(usedDraftToUrlUpdates(draftFilters));
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
      <SortFilterSection
        options={USED_SORT_OPTIONS}
        value={currentSort}
        defaultValue="date"
        onChange={setSort}
      />
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
        <input type="number" placeholder="Цена от" value={activeFilters.priceMin} onChange={(e) => setFilter('vmin', e.target.value || null)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <input type="number" placeholder="Цена до" value={activeFilters.priceMax} onChange={(e) => setFilter('vmax', e.target.value || null)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
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
        <input type="checkbox" checked={activeFilters.hasPhotos} onChange={(e) => setFilter('has_photos', e.target.checked ? '1' : null)} />
        Только с фото
      </label>
      {deferApply ? (
        <div className="space-y-2 border-t border-gray-100 pt-3">
          {hasPendingChanges ? (
            <button
              type="button"
              onClick={applyFilters}
              className="w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
            >
              Применить фильтры
            </button>
          ) : null}
          {(hasDraftFilters || hasAppliedFilters) ? (
            <button
              type="button"
              onClick={clearFilters}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-800 transition-colors hover:bg-gray-50"
            >
              Сбросить фильтры
            </button>
          ) : null}
        </div>
      ) : null}
      {!deferApply && showClearInPanel && (
        <button type="button" onClick={clearFilters} className="w-full text-sm text-indigo-600 hover:text-indigo-800 font-medium">Сбросить фильтры</button>
      )}
    </div>
  );
}

export default React.memo(UsedPartsFiltersForm);
