import React from 'react';
import NewPartsBasketHoverMenu from '../../../components/Cart/NewPartsBasketHoverMenu';

const toSafeInt = (value, fallback = 0) => {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  return fallback;
};

export default function NewPartCartQuantityControl({
  quantity,
  onAdd,
  onAddToBasket,
  onRemove,
  disabled,
  noStock,
  loading = false,
  className = '',
  showBasketPicker = true,
}) {
  const safeQuantity = toSafeInt(quantity, 0);

  if (safeQuantity > 0) {
    return (
      <div className={`inline-flex items-center overflow-hidden rounded-lg border border-line ${className}`}>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="flex h-11 w-11 items-center justify-center text-lg text-ink hover:bg-surface-muted disabled:opacity-50"
          aria-label="Уменьшить количество"
        >
          −
        </button>
        <span className="flex h-11 min-w-[2rem] items-center justify-center border-x border-line px-2 text-base font-semibold text-ink">
          {safeQuantity}
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || noStock}
          className="flex h-11 w-11 items-center justify-center text-lg text-ink hover:bg-surface-muted disabled:opacity-50"
          aria-label="Увеличить количество"
        >
          +
        </button>
      </div>
    );
  }

  return (
    <NewPartsBasketHoverMenu
      onAddToBasket={onAddToBasket || (async () => { await onAdd?.(); })}
      disabled={disabled || noStock}
      showPicker={showBasketPicker}
      className={className}
      buttonClassName="flex h-11 min-w-[7.5rem] items-center justify-center rounded-lg bg-brand-600 px-5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
      label="В корзину"
    >
      {loading ? '…' : 'В корзину'}
    </NewPartsBasketHoverMenu>
  );
}
