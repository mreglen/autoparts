import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useDispatch, useSelector } from 'react-redux';
import Button from '../UI/Button';
import {
  applyClientMarkupSettings,
  CLIENT_MARKUP_DISPLAY_BOTH,
  CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY,
} from '../../redux/slices/ClientMarkupSlice';

const PANEL_WIDTH = 288;
const PANEL_GAP = 8;

const fieldClass =
  'mt-1 block w-full rounded-sg border border-line bg-white px-3 py-2 text-sm text-ink shadow-sg-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

function clampPanelLeft(triggerRect) {
  const ideal = triggerRect.right - PANEL_WIDTH;
  return Math.max(PANEL_GAP, Math.min(ideal, window.innerWidth - PANEL_WIDTH - PANEL_GAP));
}

export default function ClientMarkupPopover({ onApply }) {
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.clientMarkup);
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(String(settings.percent ?? 0));
  const [displayMode, setDisplayMode] = useState(settings.displayMode);
  const [showPurchaseInCart, setShowPurchaseInCart] = useState(settings.showPurchaseInCart);
  const [panelStyle, setPanelStyle] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);
  const panelRef = useRef(null);

  const updatePanelPosition = useCallback(() => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    setPanelStyle({
      top: rect.bottom + PANEL_GAP,
      left: clampPanelLeft(rect),
    });
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    setPercent(String(settings.percent ?? 0));
    setDisplayMode(settings.displayMode);
    setShowPurchaseInCart(settings.showPurchaseInCart);
    updatePanelPosition();
  }, [open, settings, updatePanelPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (
        buttonRef.current?.contains(event.target)
        || panelRef.current?.contains(event.target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onReposition = () => updatePanelPosition();
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('resize', onReposition);
    window.addEventListener('scroll', onReposition, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('resize', onReposition);
      window.removeEventListener('scroll', onReposition, true);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const handleApply = () => {
    const value = Math.max(0, Math.min(500, Number(percent) || 0));
    dispatch(applyClientMarkupSettings({
      percent: value,
      displayMode,
      showPurchaseInCart,
    }));
    onApply?.(value);
    setOpen(false);
  };

  const activePercent = Number(settings.percent) || 0;
  const isActive = open || activePercent > 0;

  const panel = open ? (
    <>
      <div
        className="fixed inset-0 z-[118]"
        aria-hidden
        onClick={() => setOpen(false)}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Клиентская наценка"
        className="fixed z-[120] w-72 overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sg-lg"
        style={{ top: panelStyle.top, left: panelStyle.left }}
      >
        <div className="border-b border-line px-4 py-3">
          <h4 className="text-sm font-semibold text-ink">Клиентская наценка</h4>
        </div>

        <div className="space-y-4 px-4 py-4">
          <label className="block text-sm">
            <span className="font-medium text-ink-soft">Наценка, %</span>
            <div className="relative mt-1">
              <input
                type="number"
                min="0"
                max="500"
                step="1"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className={fieldClass}
              />
              {percent !== '' && percent !== '0' ? (
                <button
                  type="button"
                  onClick={() => setPercent('0')}
                  className="absolute inset-y-0 right-2 flex items-center text-ink-faint hover:text-ink-soft"
                  aria-label="Сбросить"
                >
                  ×
                </button>
              ) : null}
            </div>
          </label>

          <fieldset className="space-y-2">
            <legend className="mb-2 text-sm font-medium text-ink-soft">Показывать на сайте</legend>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-sg border border-line bg-surface-muted/40 px-3 py-2.5 text-sm text-ink">
              <input
                type="radio"
                name="client-markup-display"
                checked={displayMode === CLIENT_MARKUP_DISPLAY_BOTH}
                onChange={() => setDisplayMode(CLIENT_MARKUP_DISPLAY_BOTH)}
                className="mt-0.5 text-brand-600 focus:ring-brand-500"
              />
              <span className="min-w-0">
                <span className="font-medium">Нацененную и закупочную цены</span>
                {displayMode === CLIENT_MARKUP_DISPLAY_BOTH ? (
                  <label className="mt-2 flex items-center gap-2 text-xs text-ink-soft">
                    <input
                      type="checkbox"
                      checked={showPurchaseInCart}
                      onChange={(e) => setShowPurchaseInCart(e.target.checked)}
                      className="rounded border-line text-brand-600 focus:ring-brand-500"
                    />
                    Показывать в корзине
                  </label>
                ) : null}
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2.5 rounded-sg border border-line bg-surface-muted/40 px-3 py-2.5 text-sm text-ink">
              <input
                type="radio"
                name="client-markup-display"
                checked={displayMode === CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY}
                onChange={() => setDisplayMode(CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY)}
                className="mt-0.5 text-brand-600 focus:ring-brand-500"
              />
              <span className="font-medium">Только нацененную цену</span>
            </label>
          </fieldset>
        </div>

        <div className="border-t border-line px-4 py-3">
          <Button type="button" variant="primary" size="sm" className="w-full" onClick={handleApply}>
            Применить
          </Button>
        </div>
      </div>
    </>
  ) : null;

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full px-1 text-[11px] font-bold leading-none transition ${
          isActive
            ? 'bg-brand-100 text-brand-700 ring-1 ring-inset ring-brand-300'
            : 'bg-surface-muted text-ink-faint ring-1 ring-inset ring-line hover:bg-brand-50 hover:text-brand-700'
        }`}
        title="Клиентская наценка"
        aria-label="Клиентская наценка"
        aria-expanded={open}
      >
        %
      </button>
      {panel ? createPortal(panel, document.body) : null}
    </>
  );
}
