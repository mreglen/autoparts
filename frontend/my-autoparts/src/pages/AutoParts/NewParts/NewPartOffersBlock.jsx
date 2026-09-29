import React from 'react';
import { Badge, Card } from '../../../components/UI';
import NewPartCartQuantityControl from './NewPartCartQuantityControl';
import { formatDeliveryParts, formatPriceRub } from './newPartStockUtils';

const toSafeInt = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? Math.max(0, Math.trunc(n)) : 0;
};

const isSoonDelivery = (dateLine) => dateLine === 'Сегодня' || dateLine === 'Завтра';

function stockLabel(stock, index, showWarehouseNames) {
  if (showWarehouseNames) {
    return stock?.description || stock?.warehouse_name || `Склад ${stock?.stock_id || index + 1}`;
  }
  return `Склад ${index + 1}`;
}

function OfferRow({ stock, index, isBest, cartActions, showWarehouseNames, hideCta }) {
  const delivery = formatDeliveryParts(stock.delivery_start, stock.delivery_end);
  const availableCount = toSafeInt(stock.available_count);
  const quantity = cartActions.getCartQuantity(stock);
  const stockInfo = cartActions.getStockAvailability(stock);
  const price = cartActions.priceWithMarkup(stock.price);
  const soon = delivery ? isSoonDelivery(delivery.dateLine) : false;

  return (
    <li
      className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 px-4 py-3 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)_auto_auto] sm:gap-x-5 ${isBest ? 'bg-brand-50/40' : ''}`}
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-1.5">
          <p className={`text-base font-semibold text-ink ${soon ? 'text-success-700' : ''}`}>
            {delivery ? delivery.dateLine : 'Срок уточняется'}
          </p>
          {isBest ? <Badge tone="brand">Лучшее</Badge> : null}
          {soon ? <Badge tone="success">Быстро</Badge> : null}
        </div>
        <p className="mt-0.5 text-xs text-ink-muted">
          {delivery ? `Доставка ${delivery.timeLine}` : 'Дата доставки появится после подтверждения'}
        </p>
        <p className={`mt-0.5 truncate text-xs text-ink-muted ${showWarehouseNames && stock.is_preferred ? 'font-bold text-ink' : ''}`}>
          {stockLabel(stock, index, showWarehouseNames)}
        </p>
      </div>

      <div className="order-3 col-span-2 flex items-center justify-between gap-3 sm:order-none sm:col-span-1 sm:block">
        <p className="text-xs text-ink-muted sm:hidden">В наличии</p>
        <p className="text-sm font-medium text-ink">
          <span className="text-success-700">{availableCount} шт.</span>
          <span className="hidden text-ink-muted sm:inline"> в наличии</span>
        </p>
      </div>

      <div className="text-right">
        <p className="text-xl font-bold tabular-nums leading-none text-ink sm:text-2xl">{formatPriceRub(price)} ₽</p>
        <p className="mt-1 text-[11px] text-ink-muted">за 1 шт.</p>
      </div>

      <div className={`order-4 col-span-2 flex justify-end sm:order-none sm:col-span-1 ${hideCta ? 'max-lg:hidden' : ''}`}>
        <NewPartCartQuantityControl
          quantity={quantity}
          maxQty={availableCount}
          onAdd={() => cartActions.handleAddToCart(stock)}
          onAddToBasket={(basketId, qty) => cartActions.handleAddToCart(stock, basketId, qty)}
          onRemove={() => cartActions.handleRemoveFromCart(stock)}
          onSetQuantity={(value) => cartActions.handleSetQuantity(stock, value)}
          disabled={cartActions.disabledControl}
          noStock={stockInfo.noStock}
          loading={cartActions.addingToCart}
        />
      </div>
    </li>
  );
}

export default function NewPartOffersBlock({
  cartActions,
  showWarehouseNames = false,
  hideBestCta = false,
}) {
  const stocks = cartActions?.stocks || [];

  if (!stocks.length) {
    return (
      <Card as="section" padding="sm" className="sm:p-5">
        <h2 className="text-lg font-semibold text-ink">Цена и наличие</h2>
        <p className="mt-2 text-sm text-ink-muted">
          Сейчас нет складов с этой деталью. Посмотрите аналоги ниже — они подходят по тому же запросу.
        </p>
      </Card>
    );
  }

  const totalQty = stocks.reduce((sum, stock) => sum + toSafeInt(stock.available_count), 0);
  const minPrice = cartActions.mainPrice;

  return (
    <Card as="section" padding="none" className="overflow-hidden">
      <div className="flex flex-wrap items-end justify-between gap-2 border-b border-line px-4 py-3">
        <div>
          <h2 className="text-lg font-semibold text-ink">Цена и наличие</h2>
          <p className="mt-0.5 text-xs text-ink-muted">
            {stocks.length} {stocks.length === 1 ? 'склад' : stocks.length < 5 ? 'склада' : 'складов'} · {totalQty} шт.
          </p>
        </div>
        <p className="text-sm text-ink-muted">
          от <span className="text-base font-bold text-ink">{formatPriceRub(minPrice)} ₽</span>
        </p>
      </div>
      <ul className="divide-y divide-line-soft">
        {stocks.map((stock, index) => (
          <OfferRow
            key={`${stock.stock_id}-${index}`}
            stock={stock}
            index={index}
            isBest={index === 0}
            cartActions={cartActions}
            showWarehouseNames={showWarehouseNames}
            hideCta={hideBestCta && index === 0}
          />
        ))}
      </ul>
    </Card>
  );
}
