import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { computeClientPrices } from '../../../utils/clientMarkupUtils';
import { formatDeliveryParts, formatPriceRub } from '../NewParts/newPartStockUtils';
import {
  addNewPartsToCart,
  removeFromCart,
  selectCart,
  selectCartLoading,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';

function toSafeInt(value, fallback = 0) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.trunc(n);
}

function DeliveryLine({ deliveryStart, deliveryEnd }) {
  const parts = formatDeliveryParts(deliveryStart, deliveryEnd);
  if (!parts) return <span className="text-sm text-gray-500">—</span>;
  return (
    <div className="text-sm text-gray-800">
      <div className="font-medium">{parts.dateLine}</div>
      <div className="text-gray-600">{parts.timeLine}</div>
    </div>
  );
}

function MobileCartQtyControl({ quantity, maxQty, onAdd, onRemove, disabled }) {
  const safeQty = toSafeInt(quantity, 0);
  const atMax = safeQty >= maxQty;

  if (safeQty > 0) {
    return (
      <div className="inline-flex items-center overflow-hidden rounded-lg border border-gray-200">
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="flex h-11 w-11 items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          aria-label="Уменьшить количество"
        >
          −
        </button>
        <span className="flex h-11 min-w-[2rem] items-center justify-center border-x border-gray-200 px-2 text-sm font-semibold">
          {safeQty}
        </span>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || atMax}
          className="flex h-11 w-11 items-center justify-center text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          aria-label="Увеличить количество"
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
      className="flex h-11 min-w-[7rem] items-center justify-center rounded-lg border border-indigo-200 bg-indigo-50 px-4 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
    >
      В корзину
    </button>
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
  isAlternate = false,
  onOpenPart,
  vinBasketId,
  ensureVinBasket,
}) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);
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
  const disabled = busy || cartLoading;

  const prepareCartItem = () => {
    const item = {
      brand,
      partnumber: number,
      quantity: 1,
      price: purchasePrice,
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

  const handleAdd = async () => {
    if (cartQuantity >= maxQty) return;
    setBusy(true);
    try {
      const cartItem = prepareCartItem();
      if (!cartItem.stock_id || cartItem.price <= 0) return;
      let targetBasketId = vinBasketId;
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
    } catch {
      // silent
    } finally {
      setBusy(false);
    }
  };

  const handleRemove = async () => {
    if (!cartItemInStore) return;
    setBusy(true);
    try {
      if (cartItemInStore.quantity > 1) {
        await dispatch(
          updateCartItemQuantity({
            itemId: cartItemInStore.id,
            quantity: cartItemInStore.quantity - 1,
          })
        ).unwrap();
      } else {
        await dispatch(removeFromCart(cartItemInStore.id)).unwrap();
      }
    } catch {
      // silent
    } finally {
      setBusy(false);
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
          <DeliveryLine deliveryStart={stock.delivery_start} deliveryEnd={stock.delivery_end} />
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
          onAdd={handleAdd}
          onRemove={handleRemove}
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
