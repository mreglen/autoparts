function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export default function Card({
  as: Component = 'div',
  children,
  className = '',
  padding = 'md',
  hover = false,
  ...props
}) {
  return (
    <Component
      className={cx(
        'rounded-sg-lg border border-line bg-surface shadow-sg',
        PADDING[padding] ?? PADDING.md,
        hover ? 'transition-shadow hover:shadow-sg-md' : '',
        className,
      )}
      {...props}
    >
      {children}
    </Component>
  );
}
