import { useSelector } from 'react-redux';

export const AUTOPARTS_NEW = '/autoparts/new';
export const AUTOPARTS_USED = '/autoparts/used';

/** Куда вести «Автозапчасти» с учётом флага с бэкенда. */
export function getAutopartsLandingPath(showNewAutoparts) {
  return showNewAutoparts ? AUTOPARTS_NEW : AUTOPARTS_USED;
}

/** Подсветка пункта «Автозапчасти» в шапке. */
export function isAutopartsNavActive(pathname, showNewAutoparts) {
  if (!pathname.startsWith('/autoparts')) return false;
  if (showNewAutoparts) {
    return pathname.startsWith('/autoparts/new') || pathname === '/autoparts';
  }
  return true;
}

export function useShowNewAutoparts() {
  return useSelector((state) => state.publicInfo.showNewAutoparts !== false);
}

export function useAutopartsLandingPath() {
  const showNew = useShowNewAutoparts();
  return getAutopartsLandingPath(showNew);
}

/** Поисковый запрос б/у каталога — только из URL (без «залипшего» Redux). */
export function getUsedPartsUrlQuery(searchParams) {
  return (searchParams.get('q') || '').trim();
}

/** Убрать пустой ?q= из параметров URL (пробелы и пустая строка). */
export function stripEmptyUsedQueryParam(searchParams) {
  const params = new URLSearchParams(searchParams);
  if (!params.has('q')) {
    return { params, stripped: false };
  }
  const trimmed = (params.get('q') || '').trim();
  if (trimmed) {
    if (trimmed !== params.get('q')) {
      params.set('q', trimmed);
      return { params, stripped: false, normalized: true };
    }
    return { params, stripped: false };
  }
  params.delete('q');
  return { params, stripped: true };
}

/** Страница /autoparts/used только с параметром ?q= (без других фильтров). */
export function isUsedCatalogQueryOnlyPage(searchParams) {
  if (!searchParams) return false;
  if (!getUsedPartsUrlQuery(searchParams)) return false;
  const allowedKeys = new Set(['q']);
  return [...searchParams.keys()].every((key) => allowedKeys.has(key));
}

/** Основной список б/у всегда из быстрого каталога (в т.ч. при ?q=). */
export function isUsedCatalogBrowseMode() {
  return true;
}

const CATALOG_PAGE_SIZE = 20;

/** Фильтры и сортировка каталога (без номера страницы — для бесконечной прокрутки). */
export const USED_SORT_OPTIONS = [
  { value: 'date', label: 'По дате' },
  { value: 'price_asc', label: 'Цена: по возрастанию' },
  { value: 'price_desc', label: 'Цена: по убыванию' },
];

export const NEW_SORT_OPTIONS = [
  { value: 'price_asc', label: 'Цена: по возрастанию' },
  { value: 'price_desc', label: 'Цена: по убыванию' },
  { value: 'delivery_asc', label: 'По дате поставки' },
];

export function apiSortToUi(sort) {
  if (sort === 'price_asc' || sort === 'price_desc') return sort;
  return 'date';
}

export function uiSortToApi(sort) {
  return sort === 'date' ? 'created_at_desc' : sort;
}

export function getUsedUiSort(searchParams) {
  return apiSortToUi(searchParams.get('sort') || 'created_at_desc');
}

export function getNewUiSort(searchParams) {
  return searchParams.get('sort') || 'price_asc';
}

export function buildUsedCatalogFilterParams(searchParams) {
  const params = {
    page_size: CATALOG_PAGE_SIZE,
    sort: searchParams.get('sort') || 'created_at_desc',
  };
  const partTypes = searchParams.getAll('part_type').map((value) => parseInt(value, 10)).filter(Number.isFinite);
  if (partTypes.length) params.part_type_id = partTypes;
  const brands = searchParams.getAll('brand').filter(Boolean);
  if (brands.length) params.brand = brands;
  const vmin = searchParams.get('vmin');
  if (vmin) params.price_min = parseFloat(vmin);
  const vmax = searchParams.get('vmax');
  if (vmax) params.price_max = parseFloat(vmax);
  const vehicleBrands = searchParams.getAll('vb').filter(Boolean);
  if (vehicleBrands.length) params.vehicle_brand = vehicleBrands;
  const vehicleModels = searchParams.getAll('vm').filter(Boolean);
  if (vehicleModels.length) params.vehicle_model = vehicleModels;
  const vehicleId = searchParams.get('vehicle_id');
  if (vehicleId) params.vehicle_id = parseInt(vehicleId, 10);
  if (searchParams.get('has_photos') === '1') params.has_photos = true;
  const urlQ = getUsedPartsUrlQuery(searchParams);
  if (urlQ) params.q = urlQ;
  const organizationId = (searchParams.get('organization_id') || '').trim();
  if (organizationId) params.organization_id = organizationId;
  return params;
}

/** Параметры запроса каталога с номером страницы. */
export function buildUsedCatalogParams(searchParams, page = 1) {
  return {
    ...buildUsedCatalogFilterParams(searchParams),
    page,
  };
}

export { CATALOG_PAGE_SIZE };
