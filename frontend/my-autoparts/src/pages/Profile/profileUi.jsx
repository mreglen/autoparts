import { Link } from 'react-router-dom';

export function ChevronRight({ className = 'h-5 w-5 text-gray-300' }) {
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
        <p className="mb-1.5 px-4 text-xs font-medium uppercase tracking-wide text-gray-500">{title}</p>
      ) : null}
      <div className="overflow-hidden bg-white sm:rounded-xl">{children}</div>
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
  const className = `flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-gray-50 active:bg-gray-100 ${
    destructive ? 'text-red-600' : 'text-gray-900'
  }`;

  const content = (
    <>
      {icon ? <span className="flex h-6 w-6 shrink-0 items-center justify-center text-gray-500">{icon}</span> : null}
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] leading-snug">{label}</span>
        {hint ? <span className="mt-0.5 block truncate text-sm text-gray-400">{hint}</span> : null}
      </span>
      {trailing || <ChevronRight />}
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

export const profilePageShell = 'mx-auto max-w-2xl space-y-2 pb-6 max-lg:-mx-3 max-lg:bg-[#ebebeb] lg:space-y-3';

export const profileInputClass =
  'w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-[15px] text-gray-900 focus:border-[#00aaff] focus:outline-none focus:ring-1 focus:ring-[#00aaff]';

export const profilePrimaryBtn =
  'inline-flex items-center justify-center rounded-lg bg-[#141414] px-5 py-2.5 text-[15px] font-medium text-white hover:bg-black disabled:opacity-50';

export const profileSecondaryBtn =
  'inline-flex items-center justify-center rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-[15px] font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50';
