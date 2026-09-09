import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  createNewPartsBasket,
  fetchCart,
  selectCart,
} from '../../redux/slices/CartSlice';

const DEFAULT_BASKET_NAME = 'Новые запчасти';
const CLOSE_DELAY_MS = 180;

function dedupeBaskets(baskets) {
  const seen = new Set();
  return (baskets || []).filter((basket) => {
    if (!basket?.id || seen.has(basket.id)) return false;
    seen.add(basket.id);
    return true;
  });
}

function CartIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M15 15C13.8954 15 13 15.8954 13 17C13 18.1046 13.8954 19 15 19C16.1046 19 17 18.1046 17 17C17 15.8954 16.1046 15 15 15ZM15 15H7.29395C6.83288 15 6.60193 15 6.41211 14.918C6.24466 14.8456 6.09938 14.7291 5.99354 14.5805C5.8749 14.414 5.82719 14.1913 5.73274 13.7505L3.27148 2.26465C3.17484 1.81363 3.12587 1.58838 3.00586 1.41992C2.90002 1.27135 2.75477 1.15441 2.58732 1.08205C2.39746 1 2.16779 1 1.70653 1H1M4 4H16.8732C17.595 4 17.9555 4 18.1978 4.15036C18.41 4.28206 18.5653 4.48862 18.633 4.729C18.7104 5.00343 18.611 5.34996 18.411 6.04346L17.0264 10.8435C16.9068 11.2581 16.8469 11.465 16.7256 11.6189C16.6185 11.7547 16.4772 11.861 16.317 11.9263C16.1361 12 15.9211 12 15.4921 12H5.73047M6 19C4.89543 19 4 18.1046 4 17C4 15.8954 4.89543 15 6 15C7.10457 15 8 15.8954 8 17C8 18.1046 7.10457 19 6 19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * Cart icon with hover/click menu of new-parts baskets.
 * @param {(basketId: number|undefined) => Promise<void>|void} onAddToBasket
 * @param {boolean} [showPicker=true] when false, click adds to default without menu
 */
export default function NewPartsBasketHoverMenu({
  onAddToBasket,
  disabled = false,
  showPicker = true,
  className = '',
  buttonClassName = 'inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50',
  label = 'Добавить в корзину',
  menuAlign = 'right',
  children = null,
}) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const [menuOpen, setMenuOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [menuError, setMenuError] = useState('');
  const wrapRef = useRef(null);
  const closeTimerRef = useRef(null);

  const liveBaskets = useMemo(() => {
    // Only show baskets that actually exist in /cart: default + baskets with items
    const source = cart?.new_parts_baskets || [];
    return dedupeBaskets(source)
      .filter((basket) => basket.is_default || (basket.item_count ?? 0) > 0)
      .sort((a, b) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return String(a.name || '').localeCompare(String(b.name || ''), 'ru');
      });
  }, [cart?.new_parts_baskets]);

  const clearCloseTimer = useCallback(() => {
    if (closeTimerRef.current) {
      clearTimeout(closeTimerRef.current);
      closeTimerRef.current = null;
    }
  }, []);

  const openMenu = useCallback(() => {
    if (!showPicker || disabled || busy) return;
    clearCloseTimer();
    setMenuError('');
    setMenuOpen(true);
    // Only fetch cart if we don't have actual baskets from the cart
    if (!cart?.new_parts_baskets?.length) {
      dispatch(fetchCart());
    }
  }, [busy, cart?.new_parts_baskets?.length, clearCloseTimer, disabled, dispatch, showPicker]);

  const scheduleClose = useCallback(() => {
    clearCloseTimer();
    closeTimerRef.current = setTimeout(() => setMenuOpen(false), CLOSE_DELAY_MS);
  }, [clearCloseTimer]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocPointer = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocPointer);
    document.addEventListener('touchstart', onDocPointer);
    return () => {
      document.removeEventListener('mousedown', onDocPointer);
      document.removeEventListener('touchstart', onDocPointer);
    };
  }, [menuOpen]);

  const runAdd = useCallback(
    async (basketId) => {
      if (!onAddToBasket) return;
      setBusy(true);
      setMenuError('');
      try {
        await onAddToBasket(basketId);
        setMenuOpen(false);
      } catch (err) {
        setMenuError(typeof err === 'string' ? err : 'Не удалось добавить в корзину');
      } finally {
        setBusy(false);
      }
    },
    [onAddToBasket]
  );

  const handleCreateAndAdd = useCallback(async () => {
    setBusy(true);
    setMenuError('');
    try {
      const created = await dispatch(createNewPartsBasket({ name: '' })).unwrap();
      await onAddToBasket?.(created.id);
      setMenuOpen(false);
    } catch (err) {
      setMenuError(typeof err === 'string' ? err : 'Не удалось создать корзину');
    } finally {
      setBusy(false);
    }
  }, [dispatch, onAddToBasket]);

  const handleIconClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (disabled || busy) return;
    if (!showPicker) {
      await runAdd(undefined);
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    openMenu();
  };

  const isDisabled = disabled || busy;
  const alignClass = menuAlign === 'left' ? 'left-0' : 'right-0';

  return (
    <div
      ref={wrapRef}
      className={`relative inline-flex z-50 ${className}`}
      onMouseEnter={showPicker ? openMenu : undefined}
      onMouseLeave={showPicker ? scheduleClose : undefined}
    >
      <button
        type="button"
        onClick={handleIconClick}
        disabled={isDisabled}
        className={`${buttonClassName} relative z-50`}
        aria-label={label}
        title={label}
        aria-expanded={showPicker ? menuOpen : undefined}
        aria-haspopup={showPicker ? 'menu' : undefined}
      >
        {children ?? <CartIcon />}
      </button>

      {showPicker && menuOpen ? (
        <div
          role="menu"
          className={`absolute ${alignClass} top-full z-[60] mt-1 w-56 rounded-lg border border-gray-200 bg-white p-1.5 shadow-lg`}
          onMouseEnter={clearCloseTimer}
          onMouseLeave={scheduleClose}
        >
          <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            Корзины
          </p>
          <div className="max-h-48 space-y-0.5 overflow-y-auto">
            {liveBaskets.length ? (
              liveBaskets.map((basket) => (
                <button
                  key={basket.id}
                  type="button"
                  role="menuitem"
                  disabled={isDisabled}
                  onClick={() => runAdd(basket.id)}
                  className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:opacity-50"
                >
                  <span className="truncate">{basket.name || DEFAULT_BASKET_NAME}</span>
                  {basket.is_default ? (
                    <span className="shrink-0 text-[10px] text-gray-500">основная</span>
                  ) : null}
                </button>
              ))
            ) : (
              <p className="px-2 py-2 text-xs text-gray-500">Загрузка…</p>
            )}
          </div>
          <div className="mt-1 border-t border-gray-100 pt-1">
            <button
              type="button"
              role="menuitem"
              disabled={isDisabled}
              onClick={handleCreateAndAdd}
              className="flex w-full items-center rounded-md px-2 py-1.5 text-left text-sm font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50"
            >
              Создать корзину
            </button>
          </div>
          {menuError ? <p className="mt-1 px-2 text-[11px] text-red-600">{menuError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
