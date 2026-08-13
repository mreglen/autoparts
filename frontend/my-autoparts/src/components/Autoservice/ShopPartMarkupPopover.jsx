import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const PANEL_WIDTH = 240;
const PANEL_GAP = 8;

const fieldClass =
  'mt-1 block w-full rounded-sg border border-line bg-white px-3 py-2 text-sm text-ink shadow-sg-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20';

function clampPanelLeft(triggerRect) {
  const ideal = triggerRect.right - PANEL_WIDTH;
  return Math.max(PANEL_GAP, Math.min(ideal, window.innerWidth - PANEL_WIDTH - PANEL_GAP));
}

export default function ShopPartMarkupPopover({ value, onApply, floorRubles = false }) {
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(String(value ?? 0));
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
    setPercent(String(value ?? 0));
    updatePanelPosition();
  }, [open, value, updatePanelPosition]);

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

  const handleApply = () => {
    const next = Number(percent);
    onApply(Number.isNaN(next) ? 0 : next);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-full border border-line bg-surface px-2 text-xs font-semibold text-brand-600 transition hover:bg-brand-50"
        aria-label="Наценка"
        title="Клиентская наценка"
      >
        %
      </button>
      {open
        ? createPortal(
          <div
            ref={panelRef}
            className="fixed z-[1200] w-60 rounded-sg border border-line bg-white p-3 shadow-sg-md"
            style={panelStyle}
          >
            <p className="text-xs font-semibold text-ink">Наценка для клиента, %</p>
            <input
              type="number"
              min={0}
              step="0.01"
              className={fieldClass}
              value={percent}
              onChange={(e) => setPercent(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleApply();
                if (e.key === 'Escape') setOpen(false);
              }}
              autoFocus
            />
            {floorRubles ? (
              <p className="mt-1 text-[11px] text-ink-muted">цена округляется вниз до рубля</p>
            ) : null}
            <div className="mt-3 flex justify-end gap-2">
              <button
                type="button"
                className="rounded-full px-3 py-1.5 text-xs text-ink-muted hover:bg-surface-muted"
                onClick={() => setOpen(false)}
              >
                Отмена
              </button>
              <button
                type="button"
                className="rounded-full bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
                onClick={handleApply}
              >
                Применить
              </button>
            </div>
          </div>,
          document.body,
        )
        : null}
    </>
  );
}
