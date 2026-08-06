function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function SectionHeader({
  title,
  subtitle,
  action,
  eyebrow,
  className = '',
}) {
  return (
    <div className={cx('flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        {eyebrow ? (
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-brand-600">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="text-sg-title text-ink">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  title,
  subtitle,
  action,
  className = '',
}) {
  return (
    <header className={cx('mb-6 flex flex-wrap items-end justify-between gap-3', className)}>
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export default SectionHeader;
