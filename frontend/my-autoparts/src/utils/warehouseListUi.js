export const warehousePageClass = 'mt-4 sm:mt-5 px-4 sm:px-0';

export const warehousePillControlClass =
  'h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

export const warehousePillButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30';

export const warehousePrimaryButtonClass =
  'inline-flex min-h-10 items-center justify-center rounded-lg bg-indigo-600 px-5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60';

export const warehouseSecondaryButtonClass =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60';

export const warehouseToolbarClass =
  'flex flex-wrap items-center gap-2 rounded-xl bg-gray-100 px-3 py-2 sm:gap-3';

export const warehouseListShellClass =
  'overflow-hidden rounded-xl border border-gray-200 bg-white divide-y divide-gray-100';

export const warehouseEmptyShellClass =
  'rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center';

export function mapIdOptionsForPillDropdown(options) {
  return options.map(({ id, label }) => ({ value: id, label }));
}

export function mapValueOptionsForPillDropdown(options) {
  return options.map(({ value, label }) => ({ value, label }));
}
