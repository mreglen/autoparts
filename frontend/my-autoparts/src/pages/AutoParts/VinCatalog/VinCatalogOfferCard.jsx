import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNewPartsToCart,
  removeFromCart,
  selectCart,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import NewPartsBasketHoverMenu from '../../../components/Cart/NewPartsBasketHoverMenu';
import CartQtyInput from '../../../components/Cart/CartQtyInput';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';
import FavoriteHeartOverlay from '../../../components/FavoriteButton/FavoriteHeartOverlay';

import useNewPartsMarkupPercent from '../../../hooks/useNewPartsMarkupPercent';
import { applyMarkup } from '../NewParts/newPartStockUtils';
import {
  formatProductDisplayTitle,
} from '../../../utils/productDisplayName';
import {
  isRosskoFastDelivery,
  mapPartToStocksData,
} from '../NewParts/rosskoHelpers';

const monthNames = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'];
const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

function toSafeInt(value, fallback = 0) {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  return fallback;
}

function formatDeliveryShort(deliveryStart, deliveryEnd) {
  if (!deliveryStart || !deliveryEnd) return null;
  try {
    const startDate = new Date(deliveryStart);
    const endDate = new Date(deliveryEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return null;

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday =
      startDate.getDate() === today.getDate()
      && startDate.getMonth() === today.getMonth()
      && startDate.getFullYear() === today.getFullYear();
    const isTomorrow =
      startDate.getDate() === tomorrow.getDate()
      && startDate.getMonth() === tomorrow.getMonth()
      && startDate.getFullYear() === tomorrow.getFullYear();

    const dateDisplay = isToday
      ? 'Сегодня'
      : isTomorrow
        ? 'Завтра'
        : `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${weekdays[startDate.getDay()]}`;

    const startTime = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${dateDisplay}, ${startTime}–${endTime}`;
  } catch {
    return null;
  }
}

function StepperChevron({ up }) {
  return (
    <svg className="h-2.5 w-2.5" viewBox="0 0 10 6" fill="none" aria-hidden>
      <path
        d={up ? 'M1 5L5 1L9 5' : 'M1 1L5 5L9 1'}
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddedCheckIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M4 10.5L8.5 15L16 6"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RemoveCrossIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M5 5L15 15M15 5L5 15"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AddedStateIcon() {
  return (
    <span className="relative inline-flex">
      <AddedCheckIcon className="h-4 w-4 group-hover:hidden" />
      <RemoveCrossIcon className="h-4 w-4 hidden group-hover:inline" />
    </span>
  );
}

function QtyControl({ quantity, maxQty, onAdd, onAddToBasket, onRemove, onSetQuantity, disabled, noStock }) {
  const safeMax = Math.max(1, maxQty || 1);
  const q = toSafeInt(quantity, 0);
  const isAdded = q > 0;
  const atMax = q >= safeMax;
  const [pendingQty, setPendingQty] = useState(1);
  const shownQty = isAdded ? q : Math.min(Math.max(1, pendingQty), safeMax);

  const addToBasket = (basketId) => {
    const fn = onAddToBasket || (async () => { await onAdd?.(); });
    return fn(basketId, shownQty);
  };

  const incPending = () => setPendingQty((v) => Math.min(Math.max(1, v + 1), safeMax));
  const decPending = () => setPendingQty((v) => Math.max(1, v - 1));
  const commitPending = (v) => setPendingQty(Math.max(1, Math.min(toSafeInt(v, 1), safeMax)));

  return (
    <div className="flex items-center gap-1.5">
      <div className="inline-flex items-stretch overflow-hidden rounded-md border border-indigo-300 bg-white">
        <CartQtyInput
          value={shownQty}
          maxQty={safeMax}
          onCommit={isAdded ? onSetQuantity : commitPending}
          disabled={disabled || (!isAdded && noStock)}
          className="h-8 w-10 border-0 border-r border-indigo-200 bg-white text-center text-sm font-semibold text-indigo-700 focus:outline-none disabled:opacity-50"
        />
        <div className="flex flex-col divide-y divide-indigo-300">
          <button
            type="button"
            onClick={isAdded ? onAdd : incPending}
            disabled={disabled || noStock || atMax || (!isAdded && shownQty >= safeMax)}
            className="flex flex-1 items-center justify-center bg-indigo-500 px-1.5 text-white transition hover:bg-indigo-600 disabled:opacity-50"
            aria-label="Увеличить количество"
          >
            <StepperChevron up />
          </button>
          <button
            type="button"
            onClick={isAdded ? onRemove : decPending}
            disabled={disabled || (!isAdded && shownQty <= 1)}
            className="flex flex-1 items-center justify-center bg-indigo-500 px-1.5 text-white transition hover:bg-indigo-600 disabled:opacity-50"
            aria-label="Уменьшить количество"
          >
            <StepperChevron />
          </button>
        </div>
      </div>
      <NewPartsBasketHoverMenu
        onAddToBasket={addToBasket}
        onRemove={isAdded ? () => onSetQuantity?.(0) : undefined}
        disabled={disabled || noStock}
        buttonClassName="group flex h-8 w-8 items-center justify-center rounded border border-indigo-200 bg-white text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
        label={isAdded ? 'Убрать из корзины' : 'В корзину'}
      >
        {isAdded ? <AddedStateIcon /> : null}
      </NewPartsBasketHoverMenu>
    </div>
  );
}

export default function VinCatalogOfferCard({ part, sectionType = 'available', uniqueId }) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const newPartsMarkupPercent = useNewPartsMarkupPercent('auto');

  const [showWarehouses, setShowWarehouses] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const brand = String(part?.brand || '').trim();
  const number = String(part?.partnumber || part?.article || '').trim();
  const displayTitle = formatProductDisplayTitle(brand, number, part?.name) || `${brand} ${number}`.trim();

  const favoriteRossko = useMemo(
    () => ({
      brand,
      partnumber: number,
      guid: part?.guid,
      title: displayTitle,
      minPrice: undefined,
    }),
    [brand, number, part?.guid, displayTitle]
  );

  const stocks = useMemo(() => {
    const raw = mapPartToStocksData(part);
    return raw.filter(
      (stock) => stock?.price && stock.price !== 0 && (stock.available_count || 0) > 0
    );
  }, [part]);

  const mainStock = stocks[0];
  const otherStocks = stocks.slice(1);

  const priceWithMarkup = (price) => applyMarkup(price, newPartsMarkupPercent);

  const getCartQuantity = (stock) => {
    if (!stock?.stock_id || !cart?.new_parts_items) return 0;
    const cartItem = cart.new_parts_items.find(
      (item) =>
        item.stock_id === String(stock.stock_id)
        && item.brand === brand
        && item.partnumber === number
    );
    return cartItem ? toSafeInt(cartItem.quantity, 0) : 0;
  };

  const getCartItemByStock = (stock) => {
    if (!stock?.stock_id || !cart?.new_parts_items) return null;
    return (
      cart.new_parts_items.find(
        (item) =>
          item.stock_id === String(stock.stock_id)
          && item.brand === brand
          && item.partnumber === number
      ) || null
    );
  };

  const getStockAvailability = (currentStock) => {
    const currentCartQuantity = getCartQuantity(currentStock);
    const availableOnCurrent = Number(currentStock?.available_count) || 0;
    const hasStockOnOther = stocks
      .filter((stock) => String(stock.stock_id) !== String(currentStock?.stock_id))
      .some((stock) => (Number(stock.available_count) || 0) > 0);
    return {
      noStock: availableOnCurrent <= currentCartQuantity && !hasStockOnOther,
      limitedStock: availableOnCurrent <= currentCartQuantity && hasStockOnOther,
    };
  };

  const prepareCartItem = (stock, quantityToAdd) => {
    const cartItem = {
      brand,
      partnumber: number,
      quantity: Number.isInteger(quantityToAdd) ? quantityToAdd : 1,
      price: priceWithMarkup(stock?.price),
      stock_id: String(stock?.stock_id || '').trim(),
      max_quantity: Math.max(1, Number(stock?.available_count) || 1),
    };
    if (displayTitle) cartItem.name = displayTitle;
    if (part?.guid) cartItem.guid = String(part.guid);
    if (stock?.delivery_start) {
      const startDate = new Date(stock.delivery_start);
      if (!Number.isNaN(startDate.getTime())) cartItem.delivery_start = startDate.toISOString();
    }
    if (stock?.delivery_end) {
      const endDate = new Date(stock.delivery_end);
      if (!Number.isNaN(endDate.getTime())) cartItem.delivery_end = endDate.toISOString();
    }
    return cartItem;
  };

  const handleAddToCart = async (stock, basketId, qtyToAdd = 1) => {
    if (!stock) return;
    const existing = getCartItemByStock(stock);
    const currentCartQuantity = existing ? toSafeInt(existing.quantity, 0) : 0;
    const availableStock = Number(stock.available_count) || 0;
    const addQty = Math.max(1, Math.min(toSafeInt(qtyToAdd, 1), availableStock - currentCartQuantity));
    if (addQty <= 0 || availableStock <= currentCartQuantity) return;
    if (!basketId && existing) {
      try {
        await dispatch(
          updateCartItemQuantity({ itemId: existing.id, quantity: currentCartQuantity + addQty })
        ).unwrap();
      } catch {
        // silent
      }
      return;
    }
    setAddingToCart(true);
    try {
      const cartItem = prepareCartItem(stock, addQty);
      if (!cartItem.stock_id || cartItem.price <= 0) return;
      await dispatch(
        addNewPartsToCart({
          ...cartItem,
          basket_id: basketId ?? existing?.basket_id ?? undefined,
        })
      ).unwrap();
      trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
        path: window.location.pathname + window.location.search,
        section: 'vin',
      });
    } catch (err) {
      throw typeof err === 'string' ? err : 'Не удалось добавить в корзину';
    } finally {
      setAddingToCart(false);
    }
  };

  const handleRemoveFromCart = async (stock) => {
    const cartItem = getCartItemByStock(stock);
    if (!cartItem) return;
    if (cartItem.quantity > 1) {
      try {
        await dispatch(
          updateCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })
        ).unwrap();
      } catch {
        // silent
      }
      return;
    }
    setAddingToCart(true);
    try {
      await dispatch(removeFromCart(cartItem.id)).unwrap();
    } catch {
      // silent
    } finally {
      setAddingToCart(false);
    }
  };

  const handleSetCartQuantity = async (stock, nextRaw) => {
    const cartItem = getCartItemByStock(stock);
    if (!cartItem) return;
    const maxQty = Math.max(1, Number(stock?.available_count) || 1);
    const target = Math.max(0, Math.min(toSafeInt(nextRaw, 0), maxQty));
    if (target === toSafeInt(cartItem.quantity, 0)) return;
    try {
      if (target === 0) {
        await dispatch(removeFromCart(cartItem.id)).unwrap();
      } else {
        await dispatch(
          updateCartItemQuantity({ itemId: cartItem.id, quantity: target })
        ).unwrap();
      }
    } catch {
      // silent
    }
  };

  if (!mainStock) return null;

  const disabledControl = addingToCart;
  const mainQuantity = getCartQuantity(mainStock);
  const mainStockInfo = getStockAvailability(mainStock);
  const price = priceWithMarkup(mainStock.price);
  const mainAvailableCount = toSafeInt(mainStock?.available_count, 0);
  const delivery = formatDeliveryShort(mainStock.delivery_start, mainStock.delivery_end);
  const fastDelivery = isRosskoFastDelivery(part);
  const isAnalog = sectionType === 'analog';
  const detailHref = buildNewPartOpenPath({ brand, article: number });

  return (
    <article className="relative rounded-lg border border-gray-200 bg-white p-3">
      <FavoriteHeartOverlay
        rossko={{
          ...favoriteRossko,
          minPrice: price,
        }}
        className="right-2 top-2"
      />

      <div className="pr-8">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded bg-gray-100 px-1.5 py-0.5 font-medium text-gray-700">{brand}</span>
          <button
            type="button"
            onClick={() => window.open(detailHref, '_blank', 'noopener,noreferrer')}
            className="rounded bg-gray-100 px-1.5 py-0.5 font-mono font-medium text-indigo-700 hover:bg-indigo-50"
          >
            {number}
          </button>
          {isAnalog ? (
            <span className="rounded bg-orange-100 px-1.5 py-0.5 font-medium text-orange-800">Аналог</span>
          ) : null}
          {fastDelivery ? (
            <span className="rounded bg-green-100 px-1.5 py-0.5 font-medium text-green-800">Быстро</span>
          ) : null}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-end justify-between gap-2">
        <div className="min-w-0">
          <p className="text-lg font-bold leading-none text-gray-900">{price} ₽</p>
          <p className="mt-1 text-xs text-gray-500">
            {mainAvailableCount} шт.
            {delivery ? ` · ${delivery}` : ''}
          </p>
        </div>
        <QtyControl
          quantity={mainQuantity}
          maxQty={mainAvailableCount}
          onAdd={() => handleAddToCart(mainStock)}
          onAddToBasket={(basketId, qty) => handleAddToCart(mainStock, basketId, qty)}
          onRemove={() => handleRemoveFromCart(mainStock)}
          onSetQuantity={(n) => handleSetCartQuantity(mainStock, n)}
          disabled={disabledControl}
          noStock={mainStockInfo.noStock}
        />
      </div>

      {otherStocks.length > 0 ? (
        <div className="mt-2 border-t border-dashed border-gray-200 pt-2">
          <button
            type="button"
            onClick={() => setShowWarehouses((v) => !v)}
            className="text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            {showWarehouses ? 'Скрыть склады' : `Склады (${otherStocks.length})`}
          </button>
          {showWarehouses ? (
            <div className="mt-2 space-y-1.5">
              {otherStocks.map((stock, idx) => {
                const quantity = getCartQuantity(stock);
                const stockInfo = getStockAvailability(stock);
                const availableCount = toSafeInt(stock?.available_count, 0);
                const stockDelivery = formatDeliveryShort(stock.delivery_start, stock.delivery_end);
                return (
                  <div
                    key={`${uniqueId}-w-${idx}`}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-gray-50 px-2 py-1.5"
                  >
                    <div className="min-w-0 text-xs text-gray-700">
                      <p className="font-semibold text-gray-900">
                        {priceWithMarkup(stock.price)} ₽ · {availableCount} шт.
                      </p>
                      {stockDelivery ? <p className="text-gray-500">{stockDelivery}</p> : null}
                    </div>
                    <QtyControl
                      quantity={quantity}
                      maxQty={Math.max(1, Number(stock?.available_count) || 1)}
                      onAdd={() => handleAddToCart(stock)}
                      onAddToBasket={(basketId, qty) => handleAddToCart(stock, basketId, qty)}
                      onRemove={() => handleRemoveFromCart(stock)}
                      onSetQuantity={(n) => handleSetCartQuantity(stock, n)}
                      disabled={disabledControl}
                      noStock={stockInfo.noStock}
                    />
                  </div>
                );
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </article>
  );
}
