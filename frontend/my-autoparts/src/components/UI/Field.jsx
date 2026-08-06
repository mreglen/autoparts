import { forwardRef } from 'react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export const fieldClass =
  'block w-full rounded-sg border border-line bg-white px-3 py-2.5 text-sm text-ink shadow-sg-sm transition-colors placeholder:text-ink-faint focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed disabled:bg-surface-subtle disabled:text-ink-muted';

export const FieldLabel = ({ children, htmlFor, required = false, className = '' }) => (
  <label
    htmlFor={htmlFor}
    className={cx('mb-1.5 block text-sm font-medium text-ink-soft', className)}
  >
    {children}
    {required ? <span className="ml-0.5 text-danger-600">*</span> : null}
  </label>
);

export const FieldHint = ({ children, error = false, className = '' }) => (
  <p className={cx('mt-1.5 text-xs', error ? 'text-danger-600' : 'text-ink-muted', className)}>
    {children}
  </p>
);

export const Input = forwardRef(function Input({ className = '', error = false, ...props }, ref) {
  return (
    <input
      ref={ref}
      className={cx(fieldClass, error ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600/20' : '', className)}
      {...props}
    />
  );
});

export const Select = forwardRef(function Select({ className = '', error = false, children, ...props }, ref) {
  return (
    <select
      ref={ref}
      className={cx(fieldClass, error ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600/20' : '', className)}
      {...props}
    >
      {children}
    </select>
  );
});

export const Textarea = forwardRef(function Textarea({ className = '', error = false, rows = 3, ...props }, ref) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cx(fieldClass, 'resize-y', error ? 'border-danger-600 focus:border-danger-600 focus:ring-danger-600/20' : '', className)}
      {...props}
    />
  );
});

export const Checkbox = forwardRef(function Checkbox({ className = '', label, id, ...props }, ref) {
  const inputId = id || props.name;
  return (
    <label htmlFor={inputId} className={cx('inline-flex items-start gap-2.5 text-sm text-ink-soft', className)}>
      <input
        ref={ref}
        id={inputId}
        type="checkbox"
        className="mt-0.5 h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
        {...props}
      />
      {label ? <span>{label}</span> : null}
    </label>
  );
});
