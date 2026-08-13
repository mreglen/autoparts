import { Link, NavLink } from 'react-router-dom';
import { PWA_START_PATH, usePwaStandalone } from '../../utils/pwaStandalone';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

/** Same content column as the public site (Main, landings). */
export const HEADER_CONTENT_CLASS = 'mx-auto w-full max-w-sg-content px-4 sm:px-6 lg:px-8';

export function HeaderBadge({ count }) {
  if (!count || count <= 0) return null;
  return (
    <span className="absolute -right-1 -top-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-danger px-1 text-[10px] font-bold text-white">
      {count > 99 ? '99+' : count}
    </span>
  );
}

export function HeaderIconButton({
  onClick,
  to,
  label,
  children,
  accent = false,
  badge = 0,
  className = '',
}) {
  const classes = cx(
    'relative flex h-10 w-10 shrink-0 items-center justify-center rounded-sg border transition active:scale-[0.97]',
    accent
      ? 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
      : 'border-line bg-surface-muted text-ink-muted hover:border-brand-200 hover:bg-brand-50/50 hover:text-brand-600',
    className,
  );

  const content = (
    <>
      {children}
      <HeaderBadge count={badge} />
    </>
  );

  if (to) {
    return (
      <Link to={to} aria-label={label} className={classes}>
        {content}
      </Link>
    );
  }

  return (
    <button type="button" onClick={onClick} aria-label={label} className={classes}>
      {content}
    </button>
  );
}

export function HeaderAvatar({ initial, size = 'md', className = '' }) {
  const sizeClass = size === 'lg' ? 'h-12 w-12 text-lg' : size === 'sm' ? 'h-8 w-8 text-sm' : 'h-10 w-10 text-sm';
  return (
    <span
      className={cx(
        'flex shrink-0 items-center justify-center rounded-sg bg-brand-600 font-semibold text-white',
        sizeClass,
        className,
      )}
    >
      {String(initial || 'П').charAt(0).toUpperCase()}
    </span>
  );
}

export function HeaderLogo({ showWordmark = true, wordmarkClassName = '' }) {
  const isPwa = usePwaStandalone();
  const homeTo = isPwa ? PWA_START_PATH : '/';
  return (
    <NavLink
      to={homeTo}
      className="flex min-w-0 shrink-0 items-center gap-2.5 rounded-sg py-1 pr-1"
      aria-label={isPwa ? 'В каталог' : 'На главную'}
    >
      <img
        src="/img/LogoWithoutBg.png"
        alt=""
        className="h-9 w-auto shrink-0 object-contain"
        width={144}
        height={36}
        fetchPriority="high"
      />
      {showWordmark ? (
        <div className={cx('min-w-0 leading-tight text-ink', wordmarkClassName)}>
          <span className="block truncate text-sm font-bold">Свой</span>
          <span className="block truncate text-sm font-bold">Гараж</span>
        </div>
      ) : null}
    </NavLink>
  );
}

export function HeaderCityChip({ city, onClick, isOpen, className = '' }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        'inline-flex max-w-full items-center gap-1.5 rounded-sg px-1.5 py-1 text-left text-xs font-medium text-ink-muted transition hover:bg-surface-subtle hover:text-ink',
        className,
      )}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      aria-label={`Город: ${city}`}
    >
      <svg className="h-3.5 w-3.5 shrink-0 text-brand-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      <span className="truncate">г. {city}</span>
      <svg className="h-3 w-3 shrink-0 text-ink-faint" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
      </svg>
    </button>
  );
}
