/** Запас под мобильное нижнее меню (pb-[4.5rem]) */
export const MOBILE_BOTTOM_NAV_OFFSET = 80;

export function getActionsDropdownPlacementClasses(openUp) {
  return openUp ? 'bottom-full mb-2' : 'top-full mt-2';
}

export function buildActionsDropdownMenuClassName(openUp, extraClasses = '') {
  const base =
    'absolute right-0 bg-white rounded-xl shadow-lg border border-gray-200 py-1 actions-dropdown';
  return `${base} ${getActionsDropdownPlacementClasses(openUp)} ${extraClasses}`.trim();
}
