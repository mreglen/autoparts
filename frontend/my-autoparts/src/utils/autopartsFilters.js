import { getUsedUiSort, uiSortToApi } from './autopartsPublic';

function arraysEqual(a, b) {
  if (a.length !== b.length) return false;
  const sortedA = [...a].map(String).sort();
  const sortedB = [...b].map(String).sort();
  return sortedA.every((value, index) => value === sortedB[index]);
}

export function usedEmptyDraft() {
  return {
    partTypes: [],
    brands: [],
    priceMin: '',
    priceMax: '',
    vehicleBrands: [],
    vehicleModels: [],
    hasPhotos: false,
    sort: 'date',
  };
}

export function usedDraftFromSearchParams(searchParams) {
  return {
    partTypes: searchParams.getAll('part_type'),
    brands: searchParams.getAll('brand'),
    priceMin: searchParams.get('vmin') || '',
    priceMax: searchParams.get('vmax') || '',
    vehicleBrands: searchParams.getAll('vb'),
    vehicleModels: searchParams.getAll('vm'),
    hasPhotos: searchParams.get('has_photos') === '1',
    sort: getUsedUiSort(searchParams),
  };
}

export function usedDraftHasActiveFilters(draft) {
  if (draft.partTypes.length) return true;
  if (draft.brands.length) return true;
  if (draft.priceMin) return true;
  if (draft.priceMax) return true;
  if (draft.vehicleBrands.length) return true;
  if (draft.vehicleModels.length) return true;
  if (draft.hasPhotos) return true;
  return false;
}

export function usedDraftsEqual(a, b) {
  return (
    arraysEqual(a.partTypes, b.partTypes)
    && arraysEqual(a.brands, b.brands)
    && a.priceMin === b.priceMin
    && a.priceMax === b.priceMax
    && arraysEqual(a.vehicleBrands, b.vehicleBrands)
    && arraysEqual(a.vehicleModels, b.vehicleModels)
    && a.hasPhotos === b.hasPhotos
    && a.sort === b.sort
  );
}

export function usedDraftToUrlUpdates(draft) {
  const apiSort = uiSortToApi(draft.sort);
  return {
    part_type: draft.partTypes.length ? draft.partTypes : null,
    brand: draft.brands.length ? draft.brands : null,
    vmin: draft.priceMin || null,
    vmax: draft.priceMax || null,
    vb: draft.vehicleBrands.length ? draft.vehicleBrands : null,
    vm: draft.vehicleModels.length ? draft.vehicleModels : null,
    has_photos: draft.hasPhotos ? '1' : null,
    sort: apiSort === 'created_at_desc' ? null : apiSort,
  };
}

/** Есть ли на б/у-каталоге выбранные фильтры (кроме сортировки и страницы). */
export function usedHasActiveFilters(searchParams) {
  if (searchParams.getAll('part_type').length) return true;
  if (searchParams.getAll('brand').length) return true;
  if (searchParams.get('vmin')) return true;
  if (searchParams.get('vmax')) return true;
  if (searchParams.getAll('vb').length) return true;
  if (searchParams.getAll('vm').length) return true;
  if (searchParams.get('has_photos') === '1') return true;
  if (searchParams.get('vehicle_id')) return true;
  return false;
}

/** Есть ли на новых запчастях выбранные фильтры (отличные от значений по умолчанию). */
export function newHasActiveFilters(searchParams) {
  if (searchParams.getAll('brand').length) return true;
  if (searchParams.get('vmin')) return true;
  if (searchParams.get('vmax')) return true;
  if (searchParams.get('in_stock') === '1') return true;
  if ((searchParams.get('sort') || 'price_asc') !== 'price_asc') return true;
  if (searchParams.get('show_analogs') === '0') return true;
  return false;
}
