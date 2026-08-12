import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  addNewPartsToCart,
  removeFromCart,
  selectCart,
  selectCartLoading,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';
import FavoriteHeartOverlay from '../../../components/FavoriteButton/FavoriteHeartOverlay';
import useNewPartsMarkupPercent from '../../../hooks/useNewPartsMarkupPercent';
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

function parseSupplierPrice(price) {
  const numericPrice = parseFloat(price);
  if (Number.isNaN(numericPrice) || numericPrice <= 0) return 0;
  return parseFloat(numericPrice.toFixed(2));
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

function QtyControl({ quantity, onAdd, onRemove, disabled, noStock }) {
  const q = toSafeInt(quantity, 0);
  if (q > 0) {
    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-base hover:bg-gray-50 disabled:opacity-50"
        >
          −
        </button>
        <span className="w-6 text-center text-sm font-semibold text-gray-900">{q}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || noStock}
          className="flex h-8 w-8 items-center justify-center rounded border border-gray-300 bg-white text-base hover:bg-gray-50 disabled:opacity-50"
        >
          +
        </button>
      </div>
    );
  }
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
    >
      В корзину
    </button>
  );
}

export default function VinCatalogOfferCard({ part, sectionType = 'available', uniqueId }) {
  const dispatch = useDispatch();
  const cartLoading = useSelector(selectCartLoading);
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

  const priceWithMarkup = (price) => {
    const base = parseSupplierPrice(price);
    if (!base) return 0;
    const mult = 1 + Number(newPartsMarkupPercent) / 100;
    return parseFloat((base * mult).toFixed(2));
  };

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

  const handleAddToCart = async (stock) => {
    if (!stock) return;
    setAddingToCart(true);
    try {
      const currentCartQuantity = getCartQuantity(stock);
      const availableStock = Number(stock.available_count) || 0;
      if (availableStock <= currentCartQuantity) return;
      const cartItem = prepareCartItem(stock, 1);
      if (!cartItem.stock_id || cartItem.price <= 0) return;
      await dispatch(addNewPartsToCart(cartItem)).unwrap();
      trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
        path: window.location.pathname + window.location.search,
        section: 'vin',
      });
    } catch {
      // silent
    } finally {
      setAddingToCart(false);
    }
  };

  const handleRemoveFromCart = async (stock) => {
    setAddingToCart(true);
    try {
      const cartItem = getCartItemByStock(stock);
      if (!cartItem) return;
      if (cartItem.quantity > 1) {
        await dispatch(
          updateCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })
        ).unwrap();
      } else {
        await dispatch(removeFromCart(cartItem.id)).unwrap();
      }
    } catch {
      // silent
    } finally {
      setAddingToCart(false);
    }
  };

  if (!mainStock) return null;

  const disabledControl = addingToCart || cartLoading;
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
          onAdd={() => handleAddToCart(mainStock)}
          onRemove={() => handleRemoveFromCart(mainStock)}
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
                      onAdd={() => handleAddToCart(stock)}
                      onRemove={() => handleRemoveFromCart(stock)}
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
