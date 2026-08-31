import { Link } from 'react-router-dom';
import ProductCard from '../AutoParts/ProductCard';
import { engagementItemKey } from '../../utils/favoriteKeys';
import {
  warehousePageClass,
  warehousePillControlClass,
} from '../../utils/warehouseListUi';

export const profileCardClass = 'rounded-sg-lg border border-line bg-surface shadow-sg';

export const profilePageShell = `${warehousePageClass} space-y-4 pb-8 sm:space-y-5`;

export const profileFullPageShell = `${warehousePageClass} pb-8`;

export function ChevronRight({ className = 'h-5 w-5 shrink-0 text-ink-faint' }) {
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
        <h2 className="mb-2 text-sm font-semibold text-ink sm:text-base">{title}</h2>
      ) : null}
      <div className={`overflow-hidden ${profileCardClass} ${padded ? 'p-4 sm:p-5' : ''}`}>
        {children}
      </div>
    </section>
  );
}

export function ProfileNavLink({ to, onClick, label, hint, icon }) {
  const className =
    'flex items-center gap-3 rounded-sg-lg border border-line bg-surface p-4 shadow-sg-sm transition hover:border-brand-200 hover:shadow-sg active:bg-surface-muted/40';

  const content = (
    <>
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-brand-600">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        {hint ? <span className="mt-0.5 block text-xs text-ink-muted">{hint}</span> : null}
      </span>
      <ChevronRight />
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
    <button type="button" onClick={onClick} className={`${className} w-full text-left`}>
      {content}
    </button>
  );
}

export function ProfileShortcutCard({ to, label, hint, icon }) {
  return (
    <Link
      to={to}
      className="flex min-h-[5.5rem] flex-col justify-between rounded-sg-lg border border-line bg-surface p-3.5 shadow-sg-sm transition hover:border-brand-200 hover:shadow-sg active:bg-surface-muted/30 sm:min-h-[6rem] sm:p-4"
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-sg bg-surface-muted text-brand-600">
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold leading-tight text-ink">{label}</span>
        {hint ? <span className="mt-1 block text-xs leading-snug text-ink-muted">{hint}</span> : null}
      </span>
    </Link>
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
    'inline-flex items-center gap-0.5 text-sm font-medium text-brand-600 hover:text-brand-700';

  return (
    <div className="flex items-center justify-between gap-3 border-b border-line px-4 py-3">
      <h3 className="text-sm font-semibold text-ink sm:text-base">{title}</h3>
      {to ? (
        <Link to={to} className={actionClass}>
          {actionLabel || 'Все'}
          {showChevron ? <ChevronRight className="h-4 w-4 text-brand-400" /> : null}
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
    <p className="px-4 py-10 text-center text-sm text-ink-muted">
      {children || (
        <>
          Пока пусто.{' '}
          <Link to={catalogTo} className="font-medium text-brand-600 hover:text-brand-700">
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
    <div className="animate-pulse overflow-hidden rounded-sg-lg border border-line bg-surface">
      <div className="aspect-square w-full bg-surface-muted" />
      <div className="space-y-2 p-2.5">
        <div className="h-4 w-2/3 rounded-sg bg-surface-subtle" />
        <div className="h-3 w-1/2 rounded-sg bg-surface-subtle" />
        <div className="h-3 w-3/4 rounded-sg bg-surface-subtle" />
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
    'flex min-h-[4.75rem] flex-col items-center justify-center gap-2 rounded-sg-lg border border-line bg-surface px-3 py-3 text-center shadow-sg-sm transition hover:border-brand-200 hover:shadow-sg active:bg-surface-muted/40';

  const content = (
    <>
      <span className="flex h-9 w-9 items-center justify-center rounded-sg bg-surface-muted text-brand-600">
        {icon}
      </span>
      <span className="text-sm font-medium leading-tight text-ink">{label}</span>
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
  const className = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-surface-muted/60 ${
    destructive ? 'text-danger-600' : 'text-ink'
  }`;

  const content = (
    <>
      {icon ? (
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-sg ${
            destructive ? 'bg-danger-50 text-danger-600' : 'bg-brand-50 text-brand-600'
          }`}
        >
          {icon}
        </span>
      ) : null}
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium leading-snug sm:text-[15px]">{label}</span>
        {hint ? <span className="mt-0.5 block truncate text-sm text-ink-muted">{hint}</span> : null}
      </span>
      {trailing !== undefined ? trailing : <ChevronRight />}
    </>
  );

  if (to) {
    return (
      <Link to={to} className={`${className} border-b border-line last:border-b-0`}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} className={`${className} border-b border-line last:border-b-0`}>
      {content}
    </button>
  );
}

export function formatProfileItemCount(count) {
  const n = Number(count) || 0;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 14) return `${n} товаров`;
  if (mod10 === 1) return `${n} товар`;
  if (mod10 >= 2 && mod10 <= 4) return `${n} товара`;
  return `${n} товаров`;
}

export const profileInputClass =
  'block w-full rounded-sg border border-line bg-surface px-3 py-2.5 text-sm text-ink shadow-sg-sm outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 disabled:opacity-60';

export const profilePrimaryBtn =
  'inline-flex min-h-10 items-center justify-center rounded-sg bg-brand-600 px-5 text-sm font-semibold text-white shadow-sg-sm transition hover:bg-brand-700 disabled:opacity-60';

export const profileSecondaryBtn =
  'inline-flex min-h-10 items-center justify-center gap-2 rounded-sg border border-line bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60';

export const profilePillControlClass = warehousePillControlClass;
