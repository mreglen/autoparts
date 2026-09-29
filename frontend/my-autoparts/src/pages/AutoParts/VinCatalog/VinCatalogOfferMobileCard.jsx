import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';

import { computeClientPrices } from '../../../utils/clientMarkupUtils';
import { formatDeliveryParts, formatPriceRub } from '../NewParts/newPartStockUtils';
import {
  addNewPartsToCart,
  removeFromCart,
  selectCart,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import NewPartsBasketHoverMenu from '../../../components/Cart/NewPartsBasketHoverMenu';
import CartQtyInput from '../../../components/Cart/CartQtyInput';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';

function toSafeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function DeliveryLine({ deliveryStart, deliveryEnd, warehouseName, preferredWarehouse = false }) {
  const parts = formatDeliveryParts(deliveryStart, deliveryEnd);
  if (!parts) return <span className="text-sm text-gray-500">—</span>;
  return (
    <div className="text-sm text-gray-800">
      <div className="font-medium">{parts.dateLine}</div>
      <div className="text-gray-600">{parts.timeLine}</div>
      {warehouseName ? (
        <div className={`text-gray-500 ${preferredWarehouse ? 'font-bold' : ''}`}>
          {warehouseName}
        </div>
      ) : null}
    </div>
  );
}

function MobileStepperChevron({ up }) {
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

function AddedStateIcon({ className }) {
  return (
    <span className="relative inline-flex">
      <AddedCheckIcon className={`${className} group-hover:hidden`} />
      <RemoveCrossIcon className={`${className} hidden group-hover:inline`} />
    </span>
  );
}

function MobileCartQtyControl({ quantity, maxQty, onAdd, onAddToBasket, onRemove, onSetQuantity, disabled }) {
  const safeMax = Math.max(1, maxQty || 1);
  const safeQty = toSafeInt(quantity, 0);
  const isAdded = safeQty > 0;
  const atMax = safeQty >= safeMax;
  const [pendingQty, setPendingQty] = useState(1);
  const shownQty = isAdded ? safeQty : Math.min(Math.max(1, pendingQty), safeMax);

  const addToBasket = (basketId) => {
    const fn = onAddToBasket || (async () => { await onAdd?.(); });
    return fn(basketId, shownQty);
  };

  const incPending = () => setPendingQty((v) => Math.min(Math.max(1, v + 1), safeMax));
  const decPending = () => setPendingQty((v) => Math.max(1, v - 1));
  const commitPending = (v) => setPendingQty(Math.max(1, Math.min(toSafeInt(v, 1), safeMax)));

  return (
    <div className="inline-flex items-center gap-2">
      <div className="inline-flex items-stretch overflow-hidden rounded-lg border border-indigo-300 bg-white">
        <CartQtyInput
          value={shownQty}
          maxQty={safeMax}
          onCommit={isAdded ? onSetQuantity : commitPending}
          disabled={disabled}
          className="h-11 w-12 border-0 border-r border-indigo-200 bg-white text-center text-sm font-semibold text-indigo-700 focus:outline-none disabled:opacity-50"
        />
        <div className="flex flex-col divide-y divide-indigo-300">
          <button
            type="button"
            onClick={isAdded ? onAdd : incPending}
            disabled={disabled || atMax || (!isAdded && shownQty >= safeMax)}
            className="flex flex-1 items-center justify-center bg-indigo-500 px-2.5 text-white transition hover:bg-indigo-600 disabled:opacity-50"
            aria-label="Увеличить количество"
          >
            <MobileStepperChevron up />
          </button>
          <button
            type="button"
            onClick={isAdded ? onRemove : decPending}
            disabled={disabled || (!isAdded && shownQty <= 1)}
            className="flex flex-1 items-center justify-center bg-indigo-500 px-2.5 text-white transition hover:bg-indigo-600 disabled:opacity-50"
            aria-label="Уменьшить количество"
          >
            <MobileStepperChevron />
          </button>
        </div>
      </div>
      <NewPartsBasketHoverMenu
        onAddToBasket={addToBasket}
        onRemove={isAdded ? () => onSetQuantity?.(0) : undefined}
        disabled={disabled}
        buttonClassName="group flex h-11 w-11 items-center justify-center rounded-lg border border-indigo-200 bg-white text-indigo-700 transition hover:bg-indigo-50 disabled:opacity-50"
        label={isAdded ? 'Убрать из корзины' : 'В корзину'}
      >
        {isAdded ? <AddedStateIcon className="h-5 w-5" /> : null}
      </NewPartsBasketHoverMenu>
    </div>
  );
}

function MobileStockOffer({
  stock,
  part,
  brand,
  number,
  name,
  detailHref,
  siteMarkupPercent,
  clientMarkupPercent,
  showBothPrices,
  showWarehouseNames = false,
  isAlternate = false,
  onOpenPart,
  vinBasketId,
  ensureVinBasket,
}) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const [busy, setBusy] = useState(false);

  const maxQty = Math.max(1, Number(stock.available_count) || 1);
  const { purchasePrice, clientPrice } = computeClientPrices(
    stock.price,
    siteMarkupPercent,
    clientMarkupPercent,
  );

  const cartItemInStore = useMemo(() => {
    if (!stock?.stock_id || !cart?.new_parts_items) return null;
    return (
      cart.new_parts_items.find(
        (item) =>
          item.stock_id === String(stock.stock_id)
          && item.brand === brand
          && item.partnumber === number
          && (vinBasketId == null || item.basket_id === vinBasketId)
      ) || null
    );
  }, [brand, cart?.new_parts_items, number, stock?.stock_id, vinBasketId]);

  const cartQuantity = cartItemInStore ? toSafeInt(cartItemInStore.quantity, 0) : 0;
  const disabled = busy;

  const prepareCartItem = (quantityToAdd = 1) => {
    const item = {
      brand,
      partnumber: number,
      quantity: quantityToAdd,
      price: purchasePrice,
      supplier_unit_price: Number(stock.price) > 0 ? Number(stock.price) : undefined,
      stock_id: String(stock.stock_id || '').trim(),
      max_quantity: maxQty,
    };
    if (name) item.name = name;
    if (part?.guid) item.guid = String(part.guid);
    if (stock.delivery_start) {
      const startDate = new Date(stock.delivery_start);
      if (!Number.isNaN(startDate.getTime())) item.delivery_start = startDate.toISOString();
    }
    if (stock.delivery_end) {
      const endDate = new Date(stock.delivery_end);
      if (!Number.isNaN(endDate.getTime())) item.delivery_end = endDate.toISOString();
    }
    return item;
  };

  const handleAdd = async (basketId, qtyToAdd = 1) => {
    if (cartQuantity >= maxQty) return;
    const addQty = Math.max(1, Math.min(toSafeInt(qtyToAdd, 1), maxQty - cartQuantity));
    if (addQty <= 0) return;
    if (!basketId && cartItemInStore) {
      const next = Math.min(cartQuantity + addQty, maxQty);
      if (next === cartQuantity) return;
      try {
        await dispatch(
          updateCartItemQuantity({ itemId: cartItemInStore.id, quantity: next })
        ).unwrap();
      } catch {
        // silent
      }
      return;
    }
    setBusy(true);
    try {
      const cartItem = prepareCartItem(addQty);
      if (!cartItem.stock_id || cartItem.price <= 0) return;
      let targetBasketId = basketId ?? cartItemInStore?.basket_id ?? vinBasketId;
      if (!targetBasketId && ensureVinBasket) {
        targetBasketId = await ensureVinBasket();
      }
      await dispatch(
        addNewPartsToCart({
          ...cartItem,
          basket_id: targetBasketId || undefined,
        })
      ).unwrap();
      trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
        path: window.location.pathname + window.location.search,
        section: 'vin',
      });
    } catch (err) {
      throw typeof err === 'string' ? err : 'Не удалось добавить в корзину';
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!cartItemInStore) return;
    if (cartItemInStore.quantity > 1) {
      try {
        await dispatch(
          updateCartItemQuantity({
            itemId: cartItemInStore.id,
            quantity: cartItemInStore.quantity - 1,
          })
        ).unwrap();
      } catch {
        // silent
      }
      return;
    }
    setBusy(true);
    try {
      await dispatch(removeFromCart(cartItemInStore.id)).unwrap();
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  };

  const handleSetQuantity = async (nextRaw) => {
    if (!cartItemInStore) return;
    const target = Math.max(0, Math.min(toSafeInt(nextRaw, 0), maxQty));
    if (target === cartQuantity) return;
    try {
      if (target === 0) {
        await dispatch(removeFromCart(cartItemInStore.id)).unwrap();
      } else {
        await dispatch(
          updateCartItemQuantity({ itemId: cartItemInStore.id, quantity: target })
        ).unwrap();
      }
    } catch {
      // silent
    }
  };

  const handleOpen = () => {
    if (onOpenPart) {
      onOpenPart({ part, brand, number, name, detailHref });
      return;
    }
    window.open(detailHref, '_blank', 'noopener,noreferrer');
  };

  const showPurchase = showBothPrices && purchasePrice > 0 && Math.abs(clientPrice - purchasePrice) > 0.009;

  return (
    <div className={`rounded-lg border p-3 ${isAlternate ? 'border-gray-100 bg-gray-50' : 'border-gray-200 bg-white'}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <DeliveryLine
            deliveryStart={stock.delivery_start}
            deliveryEnd={stock.delivery_end}
            warehouseName={
              showWarehouseNames
                ? (stock.description || stock.warehouse_name || '')
                : ''
            }
            preferredWarehouse={Boolean(stock.is_preferred)}
          />
          <div className="text-sm text-gray-600">{maxQty} шт.</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-bold text-gray-900">{formatPriceRub(clientPrice)}</div>
          {showPurchase ? (
            <div className="text-xs text-gray-500">{formatPriceRub(purchasePrice)}</div>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end">
        <MobileCartQtyControl
          quantity={cartQuantity}
          maxQty={maxQty}
          onAdd={() => handleAdd()}
          onAddToBasket={handleAdd}
          onRemove={handleRemove}
          onSetQuantity={handleSetQuantity}
          disabled={disabled}
        />
      </div>
      {!isAlternate ? (
        <button
          type="button"
          onClick={handleOpen}
          className="sr-only"
          aria-label={`Открыть ${name}`}
        >
          Открыть
        </button>
      ) : null}
    </div>
  );
}

export default function VinCatalogOfferMobileCard({
  group,
  siteMarkupPercent,
  clientMarkupPercent,
  showBothPrices,
  showWarehouseNames = false,
  onOpenPart,
  vinBasketId,
  ensureVinBasket,
}) {
  const [showOthers, setShowOthers] = useState(false);
  const { part, brand, number, name, mainStock, otherStocks, detailHref } = group;

  const handleOpen = () => {
    if (onOpenPart) {
      onOpenPart({ part, brand, number, name, detailHref });
      return;
    }
    window.open(detailHref, '_blank', 'noopener,noreferrer');
  };

  return (
    <article className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="border-b border-gray-100 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <button
              type="button"
              onClick={handleOpen}
              className="font-mono text-sm font-semibold text-indigo-700 hover:text-indigo-900"
            >
              {number}
            </button>
            <div className="mt-0.5 text-sm font-medium text-gray-900">{brand}</div>
          </div>
        </div>
        <button
          type="button"
          onClick={handleOpen}
          className="mt-2 line-clamp-2 text-left text-sm leading-snug text-indigo-700 hover:text-indigo-900"
        >
          {name}
        </button>
      </div>

      <div className="space-y-2 p-3">
        <MobileStockOffer
          stock={mainStock}
          part={part}
          brand={brand}
          number={number}
          name={name}
          detailHref={detailHref}
          siteMarkupPercent={siteMarkupPercent}
          clientMarkupPercent={clientMarkupPercent}
          showBothPrices={showBothPrices}
          showWarehouseNames={showWarehouseNames}
          onOpenPart={onOpenPart}
          vinBasketId={vinBasketId}
          ensureVinBasket={ensureVinBasket}
        />

        {otherStocks.length > 0 ? (
          <>
            <button
              type="button"
              onClick={() => setShowOthers((prev) => !prev)}
              className="min-h-11 w-full rounded-lg text-left text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              {showOthers ? 'Скрыть другие склады' : `Другие склады (${otherStocks.length})`}
            </button>
            {showOthers
              ? otherStocks.map((stock, index) => (
                <MobileStockOffer
                  key={`${group.key}|${stock.stock_id}|${index}`}
                  stock={stock}
                  part={part}
                  brand={brand}
                  number={number}
                  name={name}
                  detailHref={detailHref}
                  siteMarkupPercent={siteMarkupPercent}
                  clientMarkupPercent={clientMarkupPercent}
                  showBothPrices={showBothPrices}
                  showWarehouseNames={showWarehouseNames}
                  isAlternate
                  onOpenPart={onOpenPart}
                  vinBasketId={vinBasketId}
                  ensureVinBasket={ensureVinBasket}
                />
              ))
              : null}
          </>
        ) : null}
      </div>
    </article>
  );
}
