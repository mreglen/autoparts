import { Link } from 'react-router-dom';
import ProductCard from '../AutoParts/ProductCard';
import { ProductCardSkeletonGrid } from '../../components/skeletons/ProductCardSkeleton';
import { engagementItemKey } from '../../utils/favoriteKeys';

export function ChevronRight({ className = 'h-4 w-4 text-gray-300' }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
    </svg>
  );
}

export function ProfileBlock({ title, children, className = '' }) {
  return (
    <div className={className}>
      {title ? (
        <p className="mb-1.5 px-1 text-xs font-medium uppercase tracking-wide text-gray-500 lg:px-0">{title}</p>
      ) : null}
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">{children}</div>
    </div>
  );
}

export function ProfileSectionHeader({ title, actionLabel, to, onAction }) {
  const actionClass =
    'inline-flex items-center gap-0.5 text-sm font-medium text-indigo-600 hover:text-indigo-700';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3">
      <h3 className="text-sm font-semibold text-gray-900">{title}</h3>
      {to ? (
        <Link to={to} className={actionClass}>
          {actionLabel || 'Все'}
          <ChevronRight className="h-4 w-4 text-indigo-400" />
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

export function ProfileShowMoreButton({ to, visible = true }) {
  if (!visible || !to) return null;
  return (
    <div className="border-t border-gray-100 px-4 py-3">
      <Link
        to={to}
        className="flex w-full items-center justify-center rounded-lg border border-gray-200 bg-gray-50 px-4 py-2.5 text-sm font-medium text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50"
      >
        Показать больше
      </Link>
    </div>
  );
}

export function ProfileEmptyLine({ children, catalogTo = '/autoparts/used' }) {
  return (
    <p className="px-4 py-8 text-center text-sm text-gray-500">
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

export function ProfilePreviewGrid({ items, loading }) {
  if (loading) {
    return (
      <div className="px-4 pb-4">
        <ProductCardSkeletonGrid count={3} />
      </div>
    );
  }

  if (!items?.length) {
    return <ProfileEmptyLine />;
  }

  return (
    <div className="grid grid-cols-3 gap-2 px-4 pb-4 pt-1">
      {items.map((part) => (
        <div key={engagementItemKey(part)} className="min-w-0">
          <ProductCard part={part} showFavorite listPriority={false} />
        </div>
      ))}
    </div>
  );
}

export function ProfileProductGrid({ items, loading }) {
  if (loading) {
    return (
      <div className="py-2">
        <ProductCardSkeletonGrid count={8} />
      </div>
    );
  }

  if (!items?.length) {
    return <ProfileEmptyLine />;
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {items.map((part) => (
        <ProductCard key={engagementItemKey(part)} part={part} showFavorite />
      ))}
    </div>
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
      {icon ? <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-500">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug">{label}</span>
        {hint ? <span className="mt-0.5 block truncate text-sm text-gray-400">{hint}</span> : null}
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

export const profilePageShell = 'w-full space-y-3 pb-6';

export const profileFullPageShell = 'w-full pb-6';

export const profileInputClass =
  'w-full rounded-lg border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20';

export const profilePrimaryBtn =
  'inline-flex items-center justify-center rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50';

export const profileSecondaryBtn =
  'inline-flex items-center justify-center rounded-lg border border-gray-300 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50';
