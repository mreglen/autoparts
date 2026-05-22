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
