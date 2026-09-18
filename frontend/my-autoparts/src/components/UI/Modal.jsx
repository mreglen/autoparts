import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Z_CONTEXT_MENU, Z_MODAL } from '../../constants/mobileTokens';
import { useFocusTrap } from '../../hooks/useFocusTrap';
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
  wrapperZIndex = Z_MODAL,
  closeOnBackdrop = true,
  initialFocusRef,
  returnFocusRef,
  draggable = false,
}) {
  const dialogRef = useRef(null);
  const closeButtonRef = useRef(null);
  const backButtonRef = useRef(null);
  const titleId = useId();
  const hasStringTitle = typeof title === 'string' && title.length > 0;
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const dragStateRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useFocusTrap(dialogRef, {
    active: open,
    initialFocusRef: initialFocusRef || (closeVariant === 'back' ? backButtonRef : closeButtonRef),
    returnFocusRef,
    onEscape: onClose,
  });

  useEffect(() => {
    if (!open) {
      setDragOffset({ x: 0, y: 0 });
      setDragging(false);
      dragStateRef.current = null;
    }
  }, [open]);

  const handleHeaderPointerDown = useCallback((event) => {
    if (!draggable) return;
    if (event.button !== 0) return;
    if (window.matchMedia('(max-width: 639.98px)').matches) return;
    if (event.target.closest('button, a, input, select, textarea, [data-no-drag]')) return;
    dragStateRef.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: dragOffset.x,
      baseY: dragOffset.y,
    };
    setDragging(true);
    const onMove = (e) => {
      const s = dragStateRef.current;
      if (!s) return;
      setDragOffset({ x: s.baseX + e.clientX - s.startX, y: s.baseY + e.clientY - s.startY });
    };
    const onUp = () => {
      dragStateRef.current = null;
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  }, [draggable, dragOffset.x, dragOffset.y]);

  if (!open) return null;

  const width =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-xl';

  return createPortal(
    <div
      className={cx(
        // pointer-events-none: bottom-nav strip stays tappable; pb reserves space so sheet/footer stay above nav
        'pointer-events-none fixed inset-0 flex items-end justify-center p-0 max-lg:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))] sm:items-center sm:p-4 lg:pb-0',
        wrapperClassName,
      )}
      style={{ zIndex: wrapperZIndex }}
    >
      <button
        type="button"
        className={cx(
          'pointer-events-auto absolute inset-x-0 top-0 bg-ink/40',
          // Leave MobileBottomNav undimmed on mobile/tablet shell (< lg)
          'bottom-[calc(3.5rem+env(safe-area-inset-bottom,0px))] lg:bottom-0',
        )}
        aria-label={closeOnBackdrop ? 'Закрыть' : undefined}
        aria-hidden={!closeOnBackdrop}
        tabIndex={-1}
        onClick={closeOnBackdrop ? onClose : undefined}
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={hasStringTitle ? titleId : undefined}
        aria-label={!hasStringTitle && typeof title === 'string' ? title : undefined}
        className={cx(
          'pointer-events-auto relative z-10 flex w-full max-h-full flex-col overflow-hidden rounded-t-sg-lg border border-line bg-surface shadow-sg-lg sm:max-h-[85vh] sm:rounded-sg-lg',
          width,
          className,
        )}
        style={
          dragOffset.x || dragOffset.y
            ? { transform: `translate(${dragOffset.x}px, ${dragOffset.y}px)` }
            : undefined
        }
      >
        {(title || onClose) && (
          <div
            onPointerDown={draggable ? handleHeaderPointerDown : undefined}
            className={cx(
              'flex shrink-0 items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-5 sm:py-4',
              draggable && (dragging ? 'sm:cursor-grabbing' : 'sm:cursor-grab'),
              draggable && 'sm:select-none',
            )}
          >
            {onClose && closeVariant === 'back' ? (
              <button
                ref={backButtonRef}
                type="button"
                onClick={onClose}
                className="-ml-1 flex h-10 w-10 max-md:min-h-11 max-md:min-w-11 shrink-0 items-center justify-center rounded-sg text-ink hover:bg-surface-subtle"
                aria-label="Назад"
              >
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
            ) : null}
            <div className="min-w-0 flex-1">
              {hasStringTitle ? (
                <h2 id={titleId} className="text-base font-semibold text-ink">{title}</h2>
              ) : (
                title
              )}
            </div>
            {headerActions ? (
              <div className="flex shrink-0 items-center gap-2">{headerActions}</div>
            ) : null}
            {onClose && closeVariant !== 'back' ? (
              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="flex max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-sg p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink"
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
          <div className="shrink-0 border-t border-line px-5 py-4">
            {footer}
          </div>
        ) : null}
      </div>
    </div>,
    document.body,
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
  returnFocusRef,
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      size="sm"
      wrapperZIndex={Z_CONTEXT_MENU}
      returnFocusRef={returnFocusRef}
      footer={(
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col">
          <Button variant="secondary" onClick={onClose} disabled={loading} className="max-md:min-h-11">
            {cancelLabel}
          </Button>
          <Button
            variant={danger ? 'danger' : 'primary'}
            loading={loading}
            onClick={onConfirm}
            className="max-md:min-h-11"
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
