import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNewPartsToCart,
  createNewPartsBasket,
  fetchCart,
  selectCart,
  selectCartLoading,
  selectNewPartsBaskets,
} from '../../redux/slices/CartSlice';
import { trackConversion, CONVERSION_EVENTS } from '../../utils/siteAnalytics';

const DEFAULT_BASKET_NAME = 'Новые запчасти';

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

function dedupeBaskets(baskets) {
  const seen = new Set();
  return (baskets || []).filter((basket) => {
    if (!basket?.id || seen.has(basket.id)) return false;
    seen.add(basket.id);
    return true;
  });
}

export default function NewPartsCartAddButton({
  cartItem,
  disabled = false,
  analyticsSection = 'vin',
  className = '',
  showBasketPicker = false,
}) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);
  const baskets = useSelector(selectNewPartsBaskets);
  const [adding, setAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBasketName, setNewBasketName] = useState('');
  const [menuError, setMenuError] = useState('');
  const wrapRef = useRef(null);

  const liveBaskets = useMemo(() => {
    const source = cart?.new_parts_baskets?.length ? cart.new_parts_baskets : baskets;
    return dedupeBaskets(source);
  }, [baskets, cart?.new_parts_baskets]);

  const defaultBasket = useMemo(
    () => liveBaskets.find((b) => b.is_default) || liveBaskets[0] || null,
    [liveBaskets]
  );

  const namedBaskets = useMemo(
    () => liveBaskets.filter((b) => !b.is_default),
    [liveBaskets]
  );

  const addToBasket = useCallback(
    async (basketId) => {
      if (!cartItem?.stock_id || !cartItem?.price || cartItem.price <= 0) return;
      setAdding(true);
      setMenuError('');
      try {
        await dispatch(
          addNewPartsToCart({
            ...cartItem,
            basket_id: basketId || undefined,
          })
        ).unwrap();
        trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
          path: window.location.pathname + window.location.search,
          section: analyticsSection,
        });
        setMenuOpen(false);
        setNewBasketName('');
      } catch (err) {
        setMenuError(typeof err === 'string' ? err : 'Не удалось добавить в корзину');
      } finally {
        setAdding(false);
      }
    },
    [analyticsSection, cartItem, dispatch]
  );

  const handleDefaultAdd = async () => {
    await addToBasket(defaultBasket?.id);
  };

  const handleCreateAndAdd = async (e) => {
    e.preventDefault();
    const name = newBasketName.trim();
    if (!name) {
      setMenuError('Укажите название корзины');
      return;
    }
    setAdding(true);
    setMenuError('');
    try {
      const created = await dispatch(createNewPartsBasket({ name })).unwrap();
      await dispatch(
        addNewPartsToCart({
          ...cartItem,
          basket_id: created.id,
        })
      ).unwrap();
      dispatch(fetchCart());
      trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
        path: window.location.pathname + window.location.search,
        section: analyticsSection,
      });
      setMenuOpen(false);
      setNewBasketName('');
    } catch (err) {
      setMenuError(typeof err === 'string' ? err : 'Не удалось создать корзину');
    } finally {
      setAdding(false);
    }
  };

  const isDisabled = disabled || adding || cartLoading;

  useEffect(() => {
    if (!menuOpen) return undefined;
    const onDocClick = (event) => {
      if (wrapRef.current && !wrapRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    document.addEventListener('touchstart', onDocClick);
    return () => {
      document.removeEventListener('mousedown', onDocClick);
      document.removeEventListener('touchstart', onDocClick);
    };
  }, [menuOpen]);

  return (
    <div ref={wrapRef} className={`relative inline-flex items-center gap-0.5 ${className}`}>
      <button
        type="button"
        onClick={handleDefaultAdd}
        disabled={isDisabled}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Добавить в ${DEFAULT_BASKET_NAME}`}
        title={`Добавить в ${DEFAULT_BASKET_NAME}`}
      >
        <CartIcon />
      </button>

      {showBasketPicker ? (
        <>
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            disabled={isDisabled}
            className="inline-flex h-9 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            aria-label="Выбрать корзину"
            aria-expanded={menuOpen}
          >
            ▾
          </button>

          {menuOpen ? (
            <div className="absolute right-0 top-full z-30 mt-1 w-56 rounded-lg border border-gray-200 bg-white p-2 shadow-lg">
              <p className="px-1.5 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Корзины
              </p>
              <div className="mt-1 space-y-0.5">
                {defaultBasket ? (
                  <button
                    type="button"
                    disabled={isDisabled}
                    onClick={() => addToBasket(defaultBasket.id)}
                    className="flex w-full items-center justify-between rounded-md px-1.5 py-1 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <span className="truncate">{defaultBasket.name}</span>
                    <span className="ml-2 shrink-0 text-[10px] text-gray-500">основная</span>
                  </button>
                ) : null}
                {namedBaskets.map((basket) => (
                  <button
                    key={basket.id}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => addToBasket(basket.id)}
                    className="flex w-full rounded-md px-1.5 py-1 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:opacity-50"
                  >
                    <span className="truncate">{basket.name}</span>
                  </button>
                ))}
              </div>

              <form onSubmit={handleCreateAndAdd} className="mt-1.5 border-t border-gray-100 pt-1.5">
                <p className="px-1.5 text-xs font-medium text-gray-900">Создать новую корзину</p>
                <input
                  type="text"
                  value={newBasketName}
                  onChange={(e) => setNewBasketName(e.target.value)}
                  placeholder="Название"
                  maxLength={100}
                  className="mt-1 block w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20"
                  disabled={isDisabled}
                />
                <button
                  type="submit"
                  disabled={isDisabled}
                  className="mt-1.5 w-full rounded-md bg-indigo-600 px-2 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  Создать и добавить
                </button>
              </form>

              {menuError ? <p className="mt-1 px-1.5 text-[11px] text-red-600">{menuError}</p> : null}
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
