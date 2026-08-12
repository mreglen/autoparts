import React, { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, Link } from 'react-router-dom';
import {
  addNewPartsToCart,
  removeFromCart,
  selectCart,
  selectCartLoading,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';
import { isRosskoFastDelivery } from './rosskoHelpers';
import {
  extractProductDescription,
  formatProductDisplayTitle,
} from '../../../utils/productDisplayName';
import { prefetchNewPartOpenChunk } from '../../../utils/prefetchPartDetail';
import FavoriteHeartOverlay from '../../../components/FavoriteButton/FavoriteHeartOverlay';

const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

const toSafeText = (value, fallback = '—') => {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed || fallback;
  }
  if (typeof value === 'number') return String(value);
  if (value == null) return fallback;
  if (typeof value === 'object') {
    if (typeof value.msg === 'string' && value.msg.trim()) return value.msg.trim();
    if (typeof value.input === 'string' && value.input.trim()) return value.input.trim();
    return fallback;
  }
  return fallback;
};

const toSafeInt = (value, fallback = 0) => {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  return fallback;
};

const parseSupplierPrice = (price) => {
  const numericPrice = parseFloat(price);
  if (Number.isNaN(numericPrice) || numericPrice <= 0) return 0;
  return parseFloat(numericPrice.toFixed(2));
};

const formatDeliveryTimeText = (deliveryStart, deliveryEnd) => {
  if (!deliveryStart || !deliveryEnd) return '—';
  try {
    const startDate = new Date(deliveryStart);
    const endDate = new Date(deliveryEnd);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return '—';

    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const isToday = startDate.getDate() === today.getDate()
      && startDate.getMonth() === today.getMonth()
      && startDate.getFullYear() === today.getFullYear();
    const isTomorrow = startDate.getDate() === tomorrow.getDate()
      && startDate.getMonth() === tomorrow.getMonth()
      && startDate.getFullYear() === tomorrow.getFullYear();

    const dateDisplay = isToday
      ? 'Сегодня'
      : isTomorrow
        ? 'Завтра'
        : `${startDate.getDate()} ${monthNames[startDate.getMonth()]} ${weekdays[startDate.getDay()]}`;

    const startTime = startDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    const endTime = endDate.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
    return `${dateDisplay}, с ${startTime} до ${endTime}`;
  } catch (_e) {
    return '—';
  }
};

function QuantityControl({
  quantity,
  onAdd,
  onRemove,
  disabled,
  noStock,
  compact = false,
}) {
  const safeQuantity = toSafeInt(quantity, 0);
  if (safeQuantity > 0) {
    return (
      <div className={`flex items-center ${compact ? 'space-x-2' : 'space-x-1'}`}>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className={`${compact ? 'h-9 w-9' : 'h-7 w-7'} rounded-sg border border-line bg-surface text-lg text-ink hover:bg-surface-muted disabled:opacity-50`}
        >
          −
        </button>
        <span className={`${compact ? 'w-8 text-base' : 'w-6 text-sm'} text-center font-semibold text-ink`}>{safeQuantity}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || noStock}
          className={`${compact ? 'h-9 w-9' : 'h-7 w-7'} rounded-sg border border-line bg-surface text-lg text-ink hover:bg-surface-muted disabled:opacity-50`}
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
      className={`${compact ? 'min-h-[44px] px-5 py-2.5 text-sm' : 'px-3 py-1.5 text-xs'} rounded-sg bg-brand-600 font-medium text-white hover:bg-brand-700 disabled:opacity-50`}
    >
      В корзину
    </button>
  );
}

function NewPartProductCard({
  part,
  stocksData,
  sectionType = 'available',
  uniqueId,
  isDetailView = false,
}) {
  const dispatch = useDispatch();
  const location = useLocation();
  const cartLoading = useSelector(selectCartLoading);
  const cart = useSelector(selectCart);
  const newPartsMarkupPercent = useSelector(
    (state) => state.publicInfo.newPartsMarkupPercent ?? 30,
  );

  const [showDetails, setShowDetails] = useState(false);
  const [addingToCart, setAddingToCart] = useState(false);

  const brand = toSafeText(part?.brand);
  const number = toSafeText(part?.partnumber);
  const rawName = toSafeText(part?.name, '');
  const title = toSafeText(extractProductDescription(rawName, brand, number) || rawName);
  const displayTitle = toSafeText(formatProductDisplayTitle(brand, number, rawName), `${brand} ${number}`.trim());

  const stocks = useMemo(
    () => (stocksData || []).filter(
      (stock) => stock?.price && stock.price !== '0' && stock.price !== 0 && (stock.available_count || 0) > 0
    ),
    [stocksData]
  );
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
    const cartItem = cart.new_parts_items.find((item) => (
      item.stock_id === String(stock.stock_id)
      && item.brand === brand
      && item.partnumber === number
    ));
    return cartItem ? toSafeInt(cartItem.quantity, 0) : 0;
  };

  const getCartItemByStock = (stock) => {
    if (!stock?.stock_id || !cart?.new_parts_items) return null;
    return cart.new_parts_items.find((item) => (
      item.stock_id === String(stock.stock_id)
      && item.brand === brand
      && item.partnumber === number
    )) || null;
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

  const backToListPath = `/autoparts/new${location.search || ''}`;
  const detailHref = buildNewPartOpenPath({
    brand,
    article: number,
    backTo: backToListPath,
  });
  const detailLinkState = {
    backTo: backToListPath,
    rosskoPart: part,
    stocksData: stocks,
  };
  const prefetchDetail = () => {
    prefetchNewPartOpenChunk();
  };

  const prepareCartItem = (stock, quantityToAdd) => {
    const cartItem = {
      brand: String(brand).trim(),
      partnumber: String(number).trim(),
      quantity: Number.isInteger(quantityToAdd) ? quantityToAdd : 1,
      price: priceWithMarkup(stock?.price),
      stock_id: String(stock?.stock_id || '').trim(),
      max_quantity: Math.max(1, Number(stock?.available_count) || 1),
    };
    if (displayTitle && displayTitle !== '—') cartItem.name = displayTitle.trim();
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
        section: 'new',
      });
    } catch (_e) {
      // silent: existing screen already displays global cart errors
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
        await dispatch(updateCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })).unwrap();
      } else {
        await dispatch(removeFromCart(cartItem.id)).unwrap();
      }
    } catch (_e) {
      // silent
    } finally {
      setAddingToCart(false);
    }
  };

  if (!mainStock) return null;

  const showAnalog = sectionType === 'analog';
  const fastDelivery = isRosskoFastDelivery(part);
  const disabledControl = addingToCart || cartLoading;
  const mainQuantity = getCartQuantity(mainStock);
  const mainStockInfo = getStockAvailability(mainStock);
  const price = priceWithMarkup(mainStock.price);
  const mainAvailableCount = toSafeInt(mainStock?.available_count, 0);

  return (
    <article className="relative rounded-sg-lg border border-line bg-surface p-3 shadow-sg sm:p-5" data-card-id={uniqueId}>
      <FavoriteHeartOverlay
        rossko={{
          brand,
          partnumber: number,
          guid: part?.guid,
          title: displayTitle,
          minPrice: price,
        }}
        className="right-3 top-3"
      />
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="flex min-w-0 flex-1 gap-3 sm:gap-4">
          <div className="relative hidden h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-sg border border-line bg-surface-muted sm:flex sm:h-28 sm:w-28">
            {part?.image_url ? (
              <img
                src={part.image_url}
                alt={`${brand} ${number}`}
                className="h-full w-full object-contain p-2"
                loading="lazy"
              />
            ) : (
              <svg className="h-10 w-10 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            )}
          </div>
          <div className="min-w-0 flex-1">
          {!isDetailView ? (
            <Link
              to={detailHref}
              state={detailLinkState}
              className="block text-inherit no-underline"
              onMouseEnter={prefetchDetail}
              onFocus={prefetchDetail}
              onTouchStart={prefetchDetail}
            >
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs">
                <span className="rounded-sg bg-surface-muted px-2 py-0.5 font-medium text-ink-soft">{brand}</span>
                <span className="rounded-sg bg-surface-muted px-2 py-0.5 font-medium text-ink-soft">{number}</span>
                {showAnalog && <span className="rounded-sg bg-accent-100 px-2 py-0.5 font-medium text-accent-700">Аналог</span>}
                {fastDelivery && <span className="rounded-sg bg-success-100 px-2 py-0.5 font-medium text-success-700">Быстрая поставка</span>}
              </div>
              <h3 className="text-base font-semibold leading-snug text-ink hover:text-brand-700 sm:text-lg">
                {displayTitle}
              </h3>
              <p className="mt-2 line-clamp-3 text-sm leading-relaxed text-ink-muted sm:line-clamp-2">{title}</p>
            </Link>
          ) : (
            <>
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-700">
                Основное предложение
              </p>
              {fastDelivery ? (
                <span className="mt-2 inline-flex rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 ring-1 ring-inset ring-success-100">
                  Быстрая поставка
                </span>
              ) : null}
              <p className="mt-2 text-sm leading-relaxed text-ink-muted">{title || displayTitle}</p>
            </>
          )}
          </div>
        </div>

        <div className="w-full rounded-sg bg-surface-muted p-3 sm:p-4 lg:w-[280px] lg:flex-shrink-0">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-ink-muted">Цена</p>
              <p className="text-2xl font-bold text-ink sm:text-xl">{price} ₽</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-muted">Остаток</p>
              <p className="text-sm font-semibold text-ink">{mainAvailableCount} шт.</p>
            </div>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">{formatDeliveryTimeText(mainStock.delivery_start, mainStock.delivery_end)}</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <QuantityControl
              quantity={mainQuantity}
              onAdd={() => handleAddToCart(mainStock)}
              onRemove={() => handleRemoveFromCart(mainStock)}
              disabled={disabledControl}
              noStock={mainStockInfo.noStock}
              compact
            />
            {(mainStockInfo.noStock || mainStockInfo.limitedStock) && (
              <span className="text-xs text-accent-600 sm:ml-2">
                {mainStockInfo.noStock ? 'Нет на складах' : 'Есть на др. складах'}
              </span>
            )}
          </div>
        </div>
      </div>

      {otherStocks.length > 0 && (
        <div className="mt-4 border-t border-dashed border-line pt-3">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="min-h-[44px] text-sm font-medium text-brand-600 hover:text-brand-800"
          >
            {showDetails ? 'Скрыть другие склады' : `Другие склады (${otherStocks.length})`}
          </button>

          {showDetails && (
            <div className="mt-3 space-y-2">
              {otherStocks.map((stock, idx) => {
                const quantity = getCartQuantity(stock);
                const stockInfo = getStockAvailability(stock);
                const availableCount = toSafeInt(stock?.available_count, 0);
                return (
                  <div key={`${uniqueId}-stock-${idx}`} className="rounded-sg border border-line bg-surface-muted p-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <div className="text-sm text-ink-soft">
                        <p className="font-medium text-ink">{priceWithMarkup(stock.price)} ₽ · {availableCount} шт.</p>
                        <p className="text-xs text-ink-muted">{formatDeliveryTimeText(stock.delivery_start, stock.delivery_end)}</p>
                      </div>
                      <QuantityControl
                        quantity={quantity}
                        onAdd={() => handleAddToCart(stock)}
                        onRemove={() => handleRemoveFromCart(stock)}
                        disabled={disabledControl}
                        noStock={stockInfo.noStock}
                        compact
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </article>
  );
}

export default React.memo(NewPartProductCard);
