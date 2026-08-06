import Button from './Button';
import {
  EmptyGarage,
  EmptyOrders,
  EmptySearch,
  ErrorWarn,
  SuccessCheck,
} from '../illustrations/BrandIllustrations';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const ILLUSTRATIONS = {
  empty: <EmptyOrders className="h-10 w-10" />,
  search: <EmptySearch className="h-10 w-10" />,
  success: <SuccessCheck className="h-10 w-10" />,
  error: <ErrorWarn className="h-10 w-10" />,
  garage: <EmptyGarage className="h-10 w-10" />,
};

export default function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  actionHref,
  illustration = 'empty',
  icon,
  className = '',
}) {
  const resolvedIcon = icon ?? (ILLUSTRATIONS[illustration] || ILLUSTRATIONS.empty);
  return (
    <div className={cx('rounded-sg-lg border border-dashed border-line bg-surface px-6 py-10 text-center', className)}>
      <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-surface-subtle text-ink-muted">
        {resolvedIcon}
      </div>
      {title ? <h3 className="text-base font-semibold text-ink">{title}</h3> : null}
      {description ? <p className="mx-auto mt-2 max-w-md text-sm text-ink-muted">{description}</p> : null}
      {(actionLabel && (onAction || actionHref)) ? (
        <div className="mt-5">
          <Button
            as={actionHref ? 'a' : 'button'}
            href={actionHref}
            onClick={onAction}
          >
            {actionLabel}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
