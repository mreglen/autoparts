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

export function isUsedCatalogBrowseMode(searchParams) {
  return !getUsedPartsUrlQuery(searchParams);
}

/** Параметры GET /catalog/products для вкладки «Б/у» (локальный склад, без фильтра is_new). */
export function buildUsedCatalogParams(searchParams) {
  const params = {
    page: parseInt(searchParams.get('page') || '1', 10),
    page_size: 20,
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
  return params;
}
