import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNewPartsToCart,
  createNewPartsBasket,
  fetchCart,
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

export default function NewPartsCartAddButton({
  cartItem,
  disabled = false,
  analyticsSection = 'vin',
  className = '',
}) {
  const dispatch = useDispatch();
  const cartLoading = useSelector(selectCartLoading);
  const baskets = useSelector(selectNewPartsBaskets);
  const [adding, setAdding] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [newBasketName, setNewBasketName] = useState('');
  const [menuError, setMenuError] = useState('');
  const wrapRef = useRef(null);

  const defaultBasket = useMemo(
    () => baskets.find((b) => b.is_default) || baskets[0] || null,
    [baskets]
  );

  const namedBaskets = useMemo(
    () => baskets.filter((b) => !b.is_default),
    [baskets]
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

  const isDisabled = disabled || adding || cartLoading;

  return (
    <div ref={wrapRef} className={`relative inline-flex items-center gap-1 ${className}`}>
      <button
        type="button"
        onClick={handleDefaultAdd}
        disabled={isDisabled}
        onMouseEnter={() => {
          if (!isDisabled) setMenuOpen(true);
        }}
        onFocus={() => {
          if (!isDisabled) setMenuOpen(true);
        }}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-gray-300 bg-white text-gray-700 transition hover:border-indigo-400 hover:bg-indigo-50 hover:text-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`Добавить в ${DEFAULT_BASKET_NAME}`}
        title={`Добавить в ${DEFAULT_BASKET_NAME}`}
      >
        <CartIcon />
      </button>

      <button
        type="button"
        onClick={() => setMenuOpen((v) => !v)}
        disabled={isDisabled}
        className="inline-flex h-9 w-7 items-center justify-center rounded-lg text-gray-500 transition hover:bg-gray-100 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50 md:hidden"
        aria-label="Выбрать корзину"
      >
        ▾
      </button>

      {menuOpen ? (
        <div
          className="absolute right-0 top-full z-20 mt-1 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-lg"
          onMouseLeave={() => setMenuOpen(false)}
        >
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Корзины</p>
          <div className="mt-2 space-y-1">
            {defaultBasket ? (
              <button
                type="button"
                disabled={isDisabled}
                onClick={() => addToBasket(defaultBasket.id)}
                className="flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:opacity-50"
              >
                <span>{defaultBasket.name}</span>
                <span className="text-xs text-gray-500">основная</span>
              </button>
            ) : null}
            {namedBaskets.map((basket) => (
              <button
                key={basket.id}
                type="button"
                disabled={isDisabled}
                onClick={() => addToBasket(basket.id)}
                className="flex w-full rounded-lg px-2.5 py-2 text-left text-sm text-gray-800 hover:bg-indigo-50 disabled:opacity-50"
              >
                {basket.name}
              </button>
            ))}
          </div>

          <form onSubmit={handleCreateAndAdd} className="mt-3 border-t border-gray-100 pt-3">
            <p className="text-sm font-medium text-gray-900">Создать новую корзину</p>
            <input
              type="text"
              value={newBasketName}
              onChange={(e) => setNewBasketName(e.target.value)}
              placeholder="Название корзины"
              maxLength={100}
              className="mt-2 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
              disabled={isDisabled}
            />
            <button
              type="submit"
              disabled={isDisabled}
              className="mt-2 w-full rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              Создать и добавить
            </button>
          </form>

          {menuError ? <p className="mt-2 text-xs text-red-600">{menuError}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
