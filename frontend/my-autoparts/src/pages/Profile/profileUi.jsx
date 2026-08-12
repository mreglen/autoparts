import { Link } from 'react-router-dom';
import ProductCard from '../AutoParts/ProductCard';
import { engagementItemKey } from '../../utils/favoriteKeys';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

export function ChevronRight({ className = 'h-5 w-5 shrink-0 text-gray-300' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ProfileBlock({ title, children, className = '', padded = false }) {
  return (
    <section className={className}>
      {title ? (
        <h2 className="mb-2 text-sm font-semibold text-gray-900 sm:text-base">{title}</h2>
      ) : null}
      <div
        className={`overflow-hidden rounded-xl border border-gray-200 bg-white ${
          padded ? 'p-4 sm:p-5' : ''
        }`}
      >
        {children}
      </div>
    </section>
  );
}

export function ProfileSectionHeader({
  title,
  actionLabel,
  to,
  onAction,
  showChevron = true,
}) {
  const actionClass =
    'inline-flex items-center gap-0.5 text-sm font-medium text-indigo-600 hover:text-indigo-700';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
      <h3 className="text-sm font-semibold text-gray-900 sm:text-base">{title}</h3>
      {to ? (
        <Link to={to} className={actionClass}>
          {actionLabel || 'Все'}
          {showChevron ? <ChevronRight className="h-4 w-4 text-indigo-400" /> : null}
        </Link>
      ) : null}
      {!to && onAction && actionLabel ? (
        <button type="button" onClick={onAction} className={actionClass}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}

export function ProfileEmptyLine({ children, catalogTo = '/autoparts/used' }) {
  return (
    <p className="px-4 py-10 text-center text-sm text-gray-500">
      {children || (
        <>
          Пока пусто.{' '}
          <Link to={catalogTo} className="font-medium text-indigo-600 hover:text-indigo-700">
            Каталог
          </Link>
        </>
      )}
    </p>
  );
}

export const profileProductCardProps = {
  variant: 'profile',
  showFavorite: true,
  hideConditionAndQuantity: true,
  hideWarehouse: true,
  showNewBadge: false,
};

function ProfileProductCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-gray-100 bg-white">
      <div className="aspect-square w-full bg-gray-100" />
      <div className="space-y-2 p-2.5">
        <div className="h-4 w-2/3 rounded bg-gray-100" />
        <div className="h-3 w-1/2 rounded bg-gray-100" />
        <div className="h-3 w-3/4 rounded bg-gray-100" />
      </div>
    </div>
  );
}

export function ProfilePreviewGrid({ items, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 gap-2.5 px-4 pb-4 pt-1 sm:gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <ProfileProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!items?.length) {
    return <ProfileEmptyLine />;
  }

  return (
    <div className="grid grid-cols-3 gap-2.5 px-4 pb-4 pt-1 sm:gap-3">
      {items.map((part) => (
        <div key={engagementItemKey(part)} className="min-w-0">
          <ProductCard part={part} listPriority={false} {...profileProductCardProps} />
        </div>
      ))}
    </div>
  );
}

export function ProfileProductGrid({ items, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {Array.from({ length: 8 }, (_, index) => (
          <ProfileProductCardSkeleton key={index} />
        ))}
      </div>
    );
  }

  if (!items?.length) {
    return <ProfileEmptyLine />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((part) => (
        <ProductCard key={engagementItemKey(part)} part={part} {...profileProductCardProps} />
      ))}
    </div>
  );
}

export function ProfileQuickAction({ to, onClick, label, icon }) {
  const className =
    'flex min-h-[4.75rem] flex-col items-center justify-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-3 text-center transition hover:border-gray-300 hover:bg-gray-50 active:bg-gray-100';

  const content = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-gray-100 text-gray-700">
        {icon}
      </span>
      <span className="text-sm font-medium leading-tight text-gray-900">{label}</span>
    </>
  );

  if (to) {
    return (
      <Link to={to} className={className}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

export function ProfileRow({
  to,
  onClick,
  label,
  hint,
  icon,
  destructive = false,
  trailing,
}) {
  const className = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-50 ${
    destructive ? 'text-red-600' : 'text-gray-900'
  }`;

  const content = (
    <>
      {icon ? (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
            destructive ? 'bg-red-50 text-red-500' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug sm:text-[15px]">{label}</span>
        {hint ? <span className="mt-0.5 block truncate text-sm text-gray-500">{hint}</span> : null}
      </span>
      {trailing !== undefined ? trailing : <ChevronRight />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${className} border-b border-gray-100 last:border-b-0`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${className} border-b border-gray-100 last:border-b-0`}>
      {content}
    </button>
  );
}

export const profilePageShell = `${warehousePageClass} space-y-4 pb-8 sm:space-y-5`;

export const profileFullPageShell = `${warehousePageClass} pb-8`;

export const profileInputClass =
  'block w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 disabled:opacity-60';

export const profilePrimaryBtn = warehousePrimaryButtonClass;

export const profileSecondaryBtn = warehouseSecondaryButtonClass;

export const profilePillControlClass = warehousePillControlClass;
