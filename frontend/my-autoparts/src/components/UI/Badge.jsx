function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const TONE = {
  neutral: 'bg-surface-subtle text-ink-soft ring-line',
  brand: 'bg-brand-50 text-brand-700 ring-brand-100',
  accent: 'bg-accent-50 text-accent-700 ring-accent-100',
  success: 'bg-success-50 text-success-700 ring-success-100',
  warning: 'bg-warning-50 text-warning-700 ring-warning-100',
  danger: 'bg-danger-50 text-danger-700 ring-danger-100',
};

export function Badge({ children, tone = 'neutral', className = '' }) {
  return (
    <span
      className={cx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset',
        TONE[tone] || TONE.neutral,
        className,
      )}
    >
      {children}
    </span>
  );
}

export function StatusBadge({ label, tone = 'neutral', className = '' }) {
  return <Badge tone={tone} className={className}>{label}</Badge>;
}

export default Badge;
