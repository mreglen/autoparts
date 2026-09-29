import React, { useState } from 'react';
import NewPartsBasketHoverMenu from '../../../components/Cart/NewPartsBasketHoverMenu';
import CartQtyInput from '../../../components/Cart/CartQtyInput';

const toSafeInt = (value, fallback = 0) => {
  const n = Number(value);
  if (Number.isFinite(n)) return Math.max(0, Math.trunc(n));
  return fallback;
};

function StepperChevron({ up }) {
  return (
    <svg className="h-3 w-3" viewBox="0 0 10 6" fill="none" aria-hidden>
      <path
        d={up ? 'M1 5L5 1L9 5' : 'M1 1L5 5L9 1'}
        stroke="currentColor"
        strokeWidth="1.8"
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

export default function NewPartCartQuantityControl({
  quantity,
  maxQty,
  onAdd,
  onAddToBasket,
  onRemove,
  onSetQuantity,
  disabled,
  noStock,
  loading = false,
  className = '',
  showBasketPicker = true,
}) {
  const safeQuantity = toSafeInt(quantity, 0);
  const isAdded = safeQuantity > 0;
  const safeMaxQty = Number.isFinite(maxQty) && maxQty > 0 ? maxQty : Infinity;
  const pendingMax = safeMaxQty === Infinity ? 999 : safeMaxQty;
  const atMax = safeQuantity >= safeMaxQty;
  const [pendingQty, setPendingQty] = useState(1);
  const shownQty = isAdded ? safeQuantity : Math.min(Math.max(1, pendingQty), pendingMax);

  const addToBasket = (basketId) => {
    const fn = onAddToBasket || (async () => { await onAdd?.(); });
    return fn(basketId, shownQty);
  };

  const incPending = () => setPendingQty((v) => Math.min(Math.max(1, v + 1), pendingMax));
  const decPending = () => setPendingQty((v) => Math.max(1, v - 1));
  const commitPending = (v) => setPendingQty(Math.max(1, Math.min(toSafeInt(v, 1), pendingMax)));

  const fieldDisabled = disabled || (!isAdded && noStock);
  const upDisabled = disabled || noStock || atMax || (!isAdded && shownQty >= pendingMax);
  const downDisabled = disabled || (!isAdded && shownQty <= 1);

  return (
    <div className={`inline-flex items-center gap-2 ${className}`}>
      <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-indigo-300 bg-white">
        <CartQtyInput
          value={shownQty}
          maxQty={safeMaxQty === Infinity ? undefined : safeMaxQty}
          onCommit={isAdded ? onSetQuantity : commitPending}
          disabled={fieldDisabled}
          className="h-11 w-12 border-0 border-r border-indigo-200 bg-white text-center text-sm font-semibold text-indigo-700 focus:outline-none disabled:opacity-50"
        />
        <div className="flex flex-col divide-y divide-indigo-300">
          <button
            type="button"
            onClick={isAdded ? onAdd : incPending}
            disabled={upDisabled}
            className="flex flex-1 items-center justify-center bg-indigo-500 px-2.5 text-white transition hover:bg-indigo-600 disabled:opacity-50"
            aria-label="Увеличить количество"
          >
            <StepperChevron up />
          </button>
          <button
            type="button"
            onClick={isAdded ? onRemove : decPending}
            disabled={downDisabled}
            className="flex flex-1 items-center justify-center bg-indigo-500 px-2.5 text-white transition hover:bg-indigo-600 disabled:opacity-50"
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
        showPicker={showBasketPicker}
        buttonClassName="group flex h-11 w-11 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
        label={isAdded ? 'Убрать из корзины' : 'В корзину'}
      >
        {loading ? '…' : isAdded ? <AddedStateIcon /> : null}
      </NewPartsBasketHoverMenu>
    </div>
  );
}
