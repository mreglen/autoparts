import { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  applyClientMarkupSettings,
  CLIENT_MARKUP_DISPLAY_BOTH,
  CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY,
} from '../../redux/slices/ClientMarkupSlice';

function PercentIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="7" cy="7" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <circle cx="17" cy="17" r="2.5" stroke="currentColor" strokeWidth="1.75" />
      <path d="M9 9l6 6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export default function ClientMarkupPopover() {
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.clientMarkup);
  const [open, setOpen] = useState(false);
  const [percent, setPercent] = useState(String(settings.percent ?? 0));
  const [displayMode, setDisplayMode] = useState(settings.displayMode);
  const [showPurchaseInCart, setShowPurchaseInCart] = useState(settings.showPurchaseInCart);
  const rootRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    setPercent(String(settings.percent ?? 0));
    setDisplayMode(settings.displayMode);
    setShowPurchaseInCart(settings.showPurchaseInCart);
  }, [open, settings]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (event) => {
      if (rootRef.current?.contains(event.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    return () => document.removeEventListener('pointerdown', onPointerDown, true);
  }, [open]);

  const handleApply = () => {
    const value = Math.max(0, Math.min(500, Number(percent) || 0));
    dispatch(applyClientMarkupSettings({
      percent: value,
      displayMode,
      showPurchaseInCart,
    }));
    setOpen(false);
  };

  const activePercent = Number(settings.percent) || 0;

  return (
    <div ref={rootRef} className="relative inline-flex">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        className={`inline-flex h-6 w-6 items-center justify-center rounded-full border transition ${
          open || activePercent > 0
            ? 'border-indigo-300 bg-indigo-50 text-indigo-700'
            : 'border-gray-300 bg-white text-gray-500 hover:border-indigo-300 hover:text-indigo-600'
        }`}
        title="Клиентская наценка"
        aria-label="Клиентская наценка"
        aria-expanded={open}
      >
        <PercentIcon className="h-3.5 w-3.5" />
      </button>

      {open ? (
        <div className="absolute right-0 top-full z-50 mt-2 w-72 rounded-lg border border-gray-200 bg-white p-4 shadow-xl">
          <div className="absolute -top-1.5 right-3 h-3 w-3 rotate-45 border-l border-t border-gray-200 bg-white" aria-hidden />
          <h4 className="mb-3 text-sm font-semibold text-gray-900">Клиентская наценка</h4>

          <label className="mb-4 block text-sm">
            <span className="mb-1 block text-gray-600">Наценка, %</span>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="500"
                step="1"
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="w-full rounded-lg border border-gray-300 py-2 pl-3 pr-8 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
              {percent !== '' && percent !== '0' ? (
                <button
                  type="button"
                  onClick={() => setPercent('0')}
                  className="absolute inset-y-0 right-2 text-gray-400 hover:text-gray-600"
                  aria-label="Очистить"
                >
                  ×
                </button>
              ) : null}
            </div>
          </label>

          <fieldset className="mb-4 space-y-2">
            <legend className="mb-1 text-sm text-gray-600">Показывать на сайте:</legend>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="client-markup-display"
                checked={displayMode === CLIENT_MARKUP_DISPLAY_BOTH}
                onChange={() => setDisplayMode(CLIENT_MARKUP_DISPLAY_BOTH)}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <span>
                <span className="font-medium">Нацененную и закупочную цены</span>
                {displayMode === CLIENT_MARKUP_DISPLAY_BOTH ? (
                  <label className="mt-2 flex items-center gap-2 pl-0 text-xs text-gray-600">
                    <input
                      type="checkbox"
                      checked={showPurchaseInCart}
                      onChange={(e) => setShowPurchaseInCart(e.target.checked)}
                      className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                    />
                    Показывать в корзине
                  </label>
                ) : null}
              </span>
            </label>
            <label className="flex cursor-pointer items-start gap-2 text-sm text-gray-800">
              <input
                type="radio"
                name="client-markup-display"
                checked={displayMode === CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY}
                onChange={() => setDisplayMode(CLIENT_MARKUP_DISPLAY_MARKED_UP_ONLY)}
                className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
              />
              <span className="font-medium">Только нацененную цену</span>
            </label>
          </fieldset>

          <button
            type="button"
            onClick={handleApply}
            className="w-full rounded-lg bg-emerald-600 py-2.5 text-sm font-semibold text-white transition hover:bg-emerald-700"
          >
            Применить
          </button>
        </div>
      ) : null}
    </div>
  );
}
