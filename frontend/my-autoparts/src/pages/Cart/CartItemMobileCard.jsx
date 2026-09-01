import React from 'react';
import { formatDeliveryParts } from '../AutoParts/NewParts/newPartStockUtils';

function DeliveryCell({ deliveryStart, deliveryEnd, deliveryFallback }) {
  const parts = formatDeliveryParts(deliveryStart, deliveryEnd);
  if (parts) {
    return (
      <div className="text-xs leading-snug text-ink">
        <p className="font-medium text-ink">{parts.dateLine}</p>
        <p className="text-ink-muted">{parts.timeLine}</p>
      </div>
    );
  }
  if (typeof deliveryFallback === 'string' && deliveryFallback.trim()) {
    return <p className="text-xs text-ink-muted">{deliveryFallback}</p>;
  }
  return null;
}

function QuantityStepper({ quantity, onDecrease, onIncrease, max, disabled = false }) {
  const atMin = quantity <= 1;
  const atMax = quantity >= max;
  return (
    <div className="inline-flex items-center overflow-hidden rounded-lg border border-line bg-surface">
      <button
        type="button"
        onClick={onDecrease}
        disabled={disabled || atMin}
        className="flex h-10 w-10 items-center justify-center text-ink-muted transition hover:bg-surface-muted disabled:opacity-40"
        aria-label="Уменьшить"
      >
        −
      </button>
      <input
        type="text"
        readOnly
        value={quantity}
        className="h-10 w-9 border-x border-line bg-surface text-center text-sm font-medium text-ink"
        aria-label="Количество"
        title={max > 0 ? `Доступно: ${max}` : undefined}
      />
      <button
        type="button"
        onClick={onIncrease}
        disabled={disabled || atMax}
        className="flex h-10 w-10 items-center justify-center text-ink-muted transition hover:bg-surface-muted disabled:opacity-40"
        aria-label="Увеличить"
        title={atMax ? `Максимум ${max} шт.` : undefined}
      >
        +
      </button>
    </div>
  );
}

export default function CartItemMobileCard({
  item,
  selected,
  onSelect,
  onQuantityChange,
  onRemove,
  showDeliveryColumn,
  clientMarkupEnabled,
  clientMarkupPercent,
  showBothPrices,
  formatItemPrice,
  quantityBusy = false,
  checkoutPrice,
  clientPrice,
  getMaxAllowedQuantity,
}) {
  const maxQty = getMaxAllowedQuantity(item);
  const quantity = Math.min(Math.max(1, Number(item.quantity) || 1), maxQty);
  const basePrice = checkoutPrice(item);
  const displayedPrice = clientMarkupEnabled
    ? clientPrice(item, clientMarkupPercent)
    : basePrice;
  const lineTotal = displayedPrice * quantity;
  const showPurchase = clientMarkupEnabled
    && showBothPrices
    && Math.abs(displayedPrice - basePrice) > 0.009;
  const title = item.partTitle || item.name;

  return (
    <article className="bg-surface px-3 py-3">
      <div className="flex gap-2.5">
        <label className="mt-0.5 flex shrink-0 items-start pt-1">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
            className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
            aria-label={`Выбрать ${title}`}
          />
        </label>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-ink">{item.brand || '—'}</p>
              <p className="truncate text-sm font-medium text-brand-600">{item.number || '—'}</p>
            </div>
            <button
              type="button"
              onClick={() => onRemove(item.id)}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-md text-ink-muted transition hover:bg-danger-50 hover:text-danger-600"
              aria-label="Удалить"
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          {title ? (
            <p className="mt-1 line-clamp-2 text-sm leading-snug text-ink-soft">{title}</p>
          ) : null}
          {showDeliveryColumn ? (
            <div className="mt-2">
              <DeliveryCell
                deliveryStart={item.deliveryStart}
                deliveryEnd={item.deliveryEnd}
                deliveryFallback={item.deliveryFallback}
              />
            </div>
          ) : null}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3 border-t border-line pt-3 pl-6">
        <div className="min-w-[4.5rem]">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Цена</p>
          <p className="text-sm font-semibold tabular-nums text-brand-600">{formatItemPrice(displayedPrice)}</p>
          {showPurchase ? (
            <p className="text-xs tabular-nums text-ink-muted">{formatItemPrice(basePrice)}</p>
          ) : null}
        </div>
        <QuantityStepper
          quantity={quantity}
          max={maxQty}
          disabled={quantityBusy}
          onDecrease={() => onQuantityChange(item.id, quantity - 1)}
          onIncrease={() => onQuantityChange(item.id, quantity + 1)}
        />
        <div className="min-w-[4.5rem] text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Сумма</p>
          <p className="text-sm font-bold tabular-nums text-ink">{formatItemPrice(lineTotal)}</p>
        </div>
      </div>
    </article>
  );
}
