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
  const [sheetY, setSheetY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const [sheetClosing, setSheetClosing] = useState(false);
  const [sheetReturning, setSheetReturning] = useState(false);
  const sheetDragRef = useRef(null);
  const sheetHeightRef = useRef(0);
  const sheetCloseTimerRef = useRef(null);

  const isSheetViewport = useCallback(
    () => typeof window !== 'undefined'
      && window.matchMedia('(max-width: 639.98px)').matches,
    [],
  );

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
      setSheetY(0);
      setSheetDragging(false);
      setSheetClosing(false);
      setSheetReturning(false);
      sheetDragRef.current = null;
      if (sheetCloseTimerRef.current) {
        window.clearTimeout(sheetCloseTimerRef.current);
        sheetCloseTimerRef.current = null;
      }
    }
  }, [open]);

  useEffect(() => () => {
    if (sheetCloseTimerRef.current) window.clearTimeout(sheetCloseTimerRef.current);
  }, []);

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

  const handleSheetPointerDown = useCallback((event) => {
    if (!onClose || !isSheetViewport()) return;
    if (event.button !== 0) return;
    if (event.target.closest('button, a, input, select, textarea, [data-no-drag]')) return;
    sheetDragRef.current = {
      startY: event.clientY,
      lastY: event.clientY,
      lastT: performance.now(),
      velocity: 0,
    };
    sheetHeightRef.current = dialogRef.current?.offsetHeight || 0;
    setSheetDragging(true);
    event.currentTarget.setPointerCapture?.(event.pointerId);
  }, [onClose, isSheetViewport]);

  const handleSheetPointerMove = useCallback((event) => {
    const s = sheetDragRef.current;
    if (!s) return;
    const now = performance.now();
    const dt = now - s.lastT;
    if (dt > 0) {
      s.velocity = (event.clientY - s.lastY) / dt;
    }
    s.lastY = event.clientY;
    s.lastT = now;
    setSheetY(Math.max(0, event.clientY - s.startY));
  }, []);

  const handleSheetPointerEnd = useCallback((event) => {
    const s = sheetDragRef.current;
    if (!s) return;
    sheetDragRef.current = null;
    setSheetDragging(false);
    const dy = Math.max(0, event.clientY - s.startY);
    const height = sheetHeightRef.current || window.innerHeight;
    const fastSwipe = s.velocity > 0.4 && dy > 24;
    if (dy > height * 0.35 || fastSwipe) {
      setSheetClosing(true);
      sheetCloseTimerRef.current = window.setTimeout(() => onClose?.(), 240);
    } else {
      setSheetReturning(true);
      setSheetY(0);
      window.setTimeout(() => setSheetReturning(false), 300);
    }
  }, [onClose]);

  const handleHeaderPointerDownCombined = useCallback((event) => {
    if (draggable) handleHeaderPointerDown(event);
    handleSheetPointerDown(event);
  }, [draggable, handleHeaderPointerDown, handleSheetPointerDown]);

  if (!open) return null;

  const width =
    size === 'sm' ? 'max-w-md' : size === 'lg' ? 'max-w-3xl' : size === 'xl' ? 'max-w-5xl' : 'max-w-xl';

  const sheetProgress = sheetHeightRef.current
    ? Math.min(1, sheetY / sheetHeightRef.current)
    : 0;
  const dialogTransform = sheetClosing
    ? 'translateY(105%)'
    : sheetY > 0
      ? `translateY(${sheetY}px)`
      : dragOffset.x || dragOffset.y
        ? `translate(${dragOffset.x}px, ${dragOffset.y}px)`
        : undefined;
  const dialogTransition = sheetDragging
    ? 'none'
    : sheetClosing || sheetReturning
      ? 'transform 0.26s cubic-bezier(0.32, 0.72, 0, 1)'
      : undefined;
  const backdropOpacity = sheetClosing
    ? 0
    : sheetY > 0
      ? Math.max(0, 1 - sheetProgress)
      : undefined;

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
        style={
          backdropOpacity !== undefined
            ? { opacity: backdropOpacity, transition: sheetDragging ? 'none' : 'opacity 0.24s ease-out' }
            : undefined
        }
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
          'pointer-events-auto relative z-10 flex w-full max-h-full flex-col overflow-hidden rounded-t-sg-lg border border-line bg-surface shadow-sg-lg sm:max-h-[85vh] sm:rounded-sg-lg max-sm:animate-slide-in-up',
          width,
          className,
        )}
        style={
          dialogTransform !== undefined || dialogTransition !== undefined
            ? { transform: dialogTransform, transition: dialogTransition }
            : undefined
        }
      >
        {(title || onClose) && (
          <div
            onPointerDown={handleHeaderPointerDownCombined}
            onPointerMove={handleSheetPointerMove}
            onPointerUp={handleSheetPointerEnd}
            onPointerCancel={handleSheetPointerEnd}
            className={cx(
              'flex shrink-0 touch-none items-center gap-2 border-b border-line px-4 py-3 sm:gap-3 sm:px-5 sm:py-4',
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
