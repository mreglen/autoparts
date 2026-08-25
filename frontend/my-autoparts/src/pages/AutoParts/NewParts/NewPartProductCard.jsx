import React, { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import {
  extractProductDescription,
} from '../../../utils/productDisplayName';
import { prefetchNewPartOpenChunk } from '../../../utils/prefetchPartDetail';
import FavoriteHeartOverlay from '../../../components/FavoriteButton/FavoriteHeartOverlay';
import { isRosskoFastDelivery } from './rosskoHelpers';
import { useNewPartCartActions } from './useNewPartCartActions';
import NewPartCartQuantityControl from './NewPartCartQuantityControl';

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

const monthNames = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const weekdays = ['вс', 'пн', 'вт', 'ср', 'чт', 'пт', 'сб'];

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

function NewPartProductCard({
  part,
  stocksData,
  sectionType = 'available',
  uniqueId,
  isDetailView = false,
  hideMobileCartCta = false,
}) {
  const location = useLocation();
  const [showDetails, setShowDetails] = useState(false);

  const {
    brand,
    number,
    displayTitle,
    mainStock,
    otherStocks,
    mainQuantity,
    mainStockInfo,
    mainPrice,
    disabledControl,
    addingToCart,
    getCartQuantity,
    getStockAvailability,
    handleAddToCart,
    handleRemoveFromCart,
    priceWithMarkup,
  } = useNewPartCartActions({ part, stocksData });

  const rawName = toSafeText(part?.name, '');
  const title = toSafeText(extractProductDescription(rawName, brand, number) || rawName);

  if (!mainStock) return null;

  const showAnalog = sectionType === 'analog';
  const fastDelivery = isRosskoFastDelivery(part);
  const mainAvailableCount = toSafeInt(mainStock?.available_count, 0);

  const backToListPath = `/autoparts/new${location.search || ''}`;
  const detailHref = buildNewPartOpenPath({
    brand,
    article: number,
    backTo: backToListPath,
  });
  const detailLinkState = {
    backTo: backToListPath,
    rosskoPart: part,
    stocksData: stocksData || [],
  };
  const prefetchDetail = () => {
    prefetchNewPartOpenChunk();
  };

  const cartControlClassName = hideMobileCartCta && isDetailView ? 'max-lg:hidden' : '';

  const renderMainCartControl = (className = '') => (
    <div className={`flex flex-col gap-2 ${className}`}>
      <NewPartCartQuantityControl
        quantity={mainQuantity}
        onAdd={() => handleAddToCart(mainStock)}
        onRemove={() => handleRemoveFromCart(mainStock)}
        disabled={disabledControl}
        noStock={mainStockInfo.noStock}
        loading={addingToCart}
      />
      {(mainStockInfo.noStock || mainStockInfo.limitedStock) ? (
        <span className="text-xs text-accent-600">
          {mainStockInfo.noStock ? 'Нет на складах' : 'Есть на других складах'}
        </span>
      ) : null}
    </div>
  );

  if (isDetailView) {
    return (
      <div className="relative rounded-sg-lg border border-line bg-surface p-4 shadow-sg" data-card-id={uniqueId}>
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-ink-muted">Цена</p>
              <p className="text-2xl font-bold tabular-nums text-ink">{mainPrice} ₽</p>
            </div>
            <div className="text-right">
              <p className="text-xs font-medium text-ink-muted">Остаток</p>
              <p className="text-sm font-semibold text-ink">{mainAvailableCount} шт.</p>
            </div>
          </div>
          {fastDelivery ? (
            <span className="inline-flex rounded-full bg-success-50 px-2.5 py-1 text-xs font-semibold text-success-700 ring-1 ring-inset ring-success-100">
              Быстрая поставка
            </span>
          ) : null}
          <p className="text-xs leading-relaxed text-ink-muted">
            {formatDeliveryTimeText(mainStock.delivery_start, mainStock.delivery_end)}
          </p>
          {renderMainCartControl(cartControlClassName)}
        </div>

        {otherStocks.length > 0 ? (
          <div className="mt-4 border-t border-line pt-3">
            <button
              type="button"
              onClick={() => setShowDetails((prev) => !prev)}
              className="min-h-11 text-left text-sm font-medium text-brand-600 hover:text-brand-800"
            >
              {showDetails ? 'Скрыть другие склады' : `Другие склады (${otherStocks.length})`}
            </button>
            {showDetails ? (
              <div className="mt-2 space-y-2">
                {otherStocks.map((stock, idx) => {
                  const quantity = getCartQuantity(stock);
                  const stockInfo = getStockAvailability(stock);
                  const availableCount = toSafeInt(stock?.available_count, 0);
                  return (
                    <div key={`${uniqueId}-stock-${idx}`} className="rounded-sg bg-surface-subtle p-2.5">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div className="text-sm">
                          <p className="font-medium text-ink">
                            {priceWithMarkup(stock.price)} ₽ · {availableCount} шт.
                          </p>
                          <p className="text-xs text-ink-muted">
                            {formatDeliveryTimeText(stock.delivery_start, stock.delivery_end)}
                          </p>
                        </div>
                        <NewPartCartQuantityControl
                          quantity={quantity}
                          onAdd={() => handleAddToCart(stock)}
                          onRemove={() => handleRemoveFromCart(stock)}
                          disabled={disabledControl}
                          noStock={stockInfo.noStock}
                          loading={addingToCart}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <article className="relative rounded-sg-lg border border-line bg-surface p-3 shadow-sg sm:p-5" data-card-id={uniqueId}>
      <FavoriteHeartOverlay
        rossko={{
          brand,
          partnumber: number,
          guid: part?.guid,
          title: displayTitle,
          minPrice: mainPrice,
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
          </div>
        </div>

        <div className="w-full rounded-sg bg-surface-muted p-3 sm:p-4 lg:w-[280px] lg:flex-shrink-0">
          <div className="mb-2 flex items-start justify-between gap-3">
            <div>
              <p className="text-xs text-ink-muted">Цена</p>
              <p className="text-2xl font-bold text-ink sm:text-xl">{mainPrice} ₽</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-ink-muted">Остаток</p>
              <p className="text-sm font-semibold text-ink">{mainAvailableCount} шт.</p>
            </div>
          </div>
          <p className="mb-3 text-xs leading-relaxed text-ink-muted">{formatDeliveryTimeText(mainStock.delivery_start, mainStock.delivery_end)}</p>
          {renderMainCartControl('sm:flex-row sm:items-center sm:justify-between')}
        </div>
      </div>

      {otherStocks.length > 0 && (
        <div className="mt-4 border-t border-dashed border-line pt-3">
          <button
            type="button"
            onClick={() => setShowDetails((prev) => !prev)}
            className="min-h-11 text-sm font-medium text-brand-600 hover:text-brand-800"
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
                      <NewPartCartQuantityControl
                        quantity={quantity}
                        onAdd={() => handleAddToCart(stock)}
                        onRemove={() => handleRemoveFromCart(stock)}
                        disabled={disabledControl}
                        noStock={stockInfo.noStock}
                        loading={addingToCart}
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
