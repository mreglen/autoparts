import { forwardRef } from 'react';

const VARIANT_CLASS = {
  primary:
    'bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-500 shadow-sg-sm',
  secondary:
    'border border-line bg-white text-ink-soft hover:bg-surface-muted focus-visible:ring-brand-500',
  ghost:
    'bg-transparent text-ink-soft hover:bg-surface-subtle focus-visible:ring-brand-500',
  danger:
    'bg-danger-600 text-white hover:bg-danger-700 focus-visible:ring-danger-600 shadow-sg-sm',
  accent:
    'bg-accent-600 text-white hover:bg-accent-700 focus-visible:ring-accent-500 shadow-sg-sm',
  soft:
    'bg-brand-50 text-brand-700 hover:bg-brand-100 focus-visible:ring-brand-500',
  softAccent:
    'bg-accent-50 text-accent-700 hover:bg-accent-100 focus-visible:ring-accent-500',
  softAccent:
    'bg-accent-50 text-accent-700 hover:bg-accent-100 focus-visible:ring-accent-500',
};

const SIZE_CLASS = {
  sm: 'min-h-9 px-3 py-1.5 text-sm',
  md: 'min-h-10 px-4 py-2.5 text-sm',
  lg: 'min-h-12 px-5 py-3 text-base',
};

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const Button = forwardRef(function Button(
  {
    as: Component = 'button',
    variant = 'primary',
    size = 'md',
    className = '',
    disabled = false,
    loading = false,
    type,
    children,
    ...props
  },
  ref,
) {
  const isButton = Component === 'button';
  return (
    <Component
      ref={ref}
      type={isButton ? type || 'button' : undefined}
      disabled={isButton ? disabled || loading : undefined}
      aria-busy={loading || undefined}
      className={cx(
        'inline-flex items-center justify-center gap-2 rounded-sg font-semibold transition-colors',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        VARIANT_CLASS[variant] || VARIANT_CLASS.primary,
        SIZE_CLASS[size] || SIZE_CLASS.md,
        className,
      )}
      {...props}
    >
      {loading ? (
        <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent" />
      ) : null}
      {children}
    </Component>
  );
});

export default Button;
