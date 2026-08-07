import {
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
} from './warehouseListUi';

export const autopartsFilterPanelClass =
  'rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5';

export const autopartsFilterTitleClass = 'mb-4 text-base font-semibold text-gray-900';

export const autopartsFilterSectionTitleClass =
  'mb-2 block text-xs font-medium uppercase tracking-wide text-gray-500';

export const autopartsFilterOptionClass =
  'flex min-h-10 cursor-pointer items-center gap-2.5 rounded-full bg-gray-100 px-3 py-2 text-sm text-gray-800 transition hover:bg-gray-50 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-800 has-[:checked]:ring-1 has-[:checked]:ring-indigo-200';

export const autopartsFilterCheckboxClass =
  'h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500';

export const autopartsFilterToggleClass =
  'mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800';

export const autopartsFilterMobileButtonClass =
  'inline-flex h-9 items-center rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-800 transition hover:bg-gray-200 lg:hidden';

export const autopartsFilterPriceInputClass = `${warehousePillControlClass} text-center`;

export {
  warehousePrimaryButtonClass as autopartsFilterPrimaryButtonClass,
  warehouseSecondaryButtonClass as autopartsFilterSecondaryButtonClass,
};
