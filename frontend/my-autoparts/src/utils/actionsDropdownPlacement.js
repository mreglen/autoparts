/** Запас под мобильное нижнее меню (pb-[4.5rem]) */
export const MOBILE_BOTTOM_NAV_OFFSET = 80;

export function getActionsDropdownPlacementClasses(openUp, { tight = false } = {}) {
  if (tight) {
    return openUp ? 'bottom-full mb-0.5' : 'top-full mt-0.5';
  }
  return openUp ? 'bottom-full mb-2' : 'top-full mt-2';
}

export function buildActionsDropdownMenuClassName(openUp, extraClasses = '', { tight = false } = {}) {
  const base = tight
    ? 'absolute right-0 z-50 min-w-[9.5rem] rounded-lg border border-gray-200 bg-white py-0.5 shadow-lg actions-dropdown'
    : 'absolute right-0 bg-white rounded-xl shadow-lg border border-gray-200 py-1 actions-dropdown';
  return `${base} ${getActionsDropdownPlacementClasses(openUp, { tight })} ${extraClasses}`.trim();
}
