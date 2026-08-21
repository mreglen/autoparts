import { useEffect } from 'react';
import Button from './Button';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  headerActions,
  size = 'md',
  className = '',
  closeVariant = 'close',
  wrapperClassName = '',
  closeOnBackdrop = true,
}) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const width =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-xl';

  return (
    <div className={cx('fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4', wrapperClassName || 'z-[110]')}>
      <button
        type="button"
        className="absolute inset-0 bg-slate-900/40"
        aria-label={closeOnBackdrop ? 'Закрыть' : undefined}
        aria-hidden={!closeOnBackdrop}
        tabIndex={closeOnBackdrop ? 0 : -1}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        className={cx(
          'relative z-10 flex w-full max-h-[min(92dvh,100%)] flex-col overflow-hidden rounded-t-sg-lg border border-line bg-surface shadow-sg-lg sm:max-h-[85vh] sm:rounded-sg-lg',
          width,
          className,
        )}
      >
        {(title || onClose) && (
          <div className="flex shrink-0 items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-5 sm:py-4">
            {onClose && closeVariant === 'back' ? (
              <button
                type="button"
                onClick={onClose}
                className="-ml-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-sg text-ink hover:bg-surface-subtle"
                aria-label="Назад"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {typeof title === 'string' ? (
                <h2 className="text-base font-semibold text-ink">{title}</h2>
              ) : (
                title
              )}
            </div>
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            ) : null}
            {onClose && closeVariant !== 'back' ? (
              <button
                type="button"
                onClick={onClose}
                className="rounded-sg p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink"
                aria-label="Закрыть"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            ) : null}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [overflow-anchor:none] [-webkit-overflow-scrolling:touch]">
          {children}
        </div>
        {footer ? (
          <div className="shrink-0 border-t border-line px-5 py-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title = 'Подтвердите действие',
  message,
  confirmLabel = 'Подтвердить',
  cancelLabel = 'Отмена',
  danger = false,
  loading = false,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      wrapperClassName="z-[120]"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      )}
    >
      {message ? <p className="text-sm text-ink-soft">{message}</p> : null}
    </Modal>
  );
}
