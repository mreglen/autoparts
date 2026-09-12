export const warehousePageClass = 'mt-4 sm:mt-5';

/** Layout aligned with /autoservice/orders list pages */
export const autoserviceListPageClass = 'w-full min-w-0';

export const autoserviceListTableWrapClass = 'hidden md:block min-w-0';

export const autoserviceListMobileWrapClass = 'md:hidden';

export const autoserviceListTableClass = 'min-w-full table-fixed divide-y divide-line text-sm';

export const autoserviceListTheadRowClass =
  'text-left text-xs font-semibold uppercase tracking-wide text-ink-muted';

export const autoserviceListThClass = 'py-2 pr-3';

export const autoserviceListThRightClass = 'py-2 pr-3 text-right';

export const autoserviceListThActionsClass = 'w-28 py-2 text-right';

export const autoserviceListTbodyClass = 'divide-y divide-line-soft';

export const autoserviceListTrClickableClass =
  'group cursor-pointer transition-colors hover:bg-surface-muted/70';

export const autoserviceListTrClass = 'group transition-colors hover:bg-surface-muted/70';

export const autoserviceListTdClass = 'py-2 pr-3 align-middle';

export const autoserviceListTdRightClass = 'py-2 pr-3 text-right align-middle';

export const autoserviceListTdActionsClass = 'py-2 text-right align-middle';

export const autoserviceListErrorClass =
  'mb-4 rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-700';

export const autoserviceListHeaderTitleClass = 'text-xl font-bold text-ink sm:text-2xl';

export const autoserviceListHeaderSubtitleClass = 'mt-0.5 text-sm text-ink-muted';

export const autoserviceListPrimaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 sm:h-10 sm:min-h-10';

export const autoserviceListActionsButtonClass =
  'inline-flex min-h-11 items-center gap-1.5 rounded-sg-sm border border-line-strong bg-surface px-2.5 text-sm font-medium text-ink-soft transition hover:bg-surface-muted focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-1 sm:min-h-9';

export const warehousePillControlClass =
  'h-10 w-full rounded-full border border-transparent bg-surface-subtle px-4 text-sm text-ink shadow-none transition hover:bg-surface-muted focus:border-brand-400 focus:bg-surface focus:outline-none focus:ring-0 disabled:cursor-not-allowed disabled:opacity-60';

export const warehousePillButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-surface-muted px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-subtle focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30';

export const warehousePrimaryButtonClass =
  'inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-5 text-sm font-semibold text-white transition hover:bg-brand-700 sm:min-h-10';

export const warehouseSecondaryButtonClass =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 sm:min-h-10';

export const warehouseToolbarClass =
  'flex flex-wrap items-center gap-2 rounded-sg bg-surface-subtle px-3 py-2 sm:gap-3';

export const warehouseListShellClass =
  'overflow-hidden rounded-sg border border-line bg-surface divide-y divide-line-soft';

export const warehouseEmptyShellClass =
  'rounded-sg border border-dashed border-line-strong bg-surface px-6 py-14 text-center';

export function mapIdOptionsForPillDropdown(options) {
  return options.map(({ id, label }) => ({ value: id, label }));
}

export function mapValueOptionsForPillDropdown(options) {
  return options.map(({ value, label }) => ({ value, label }));
}
