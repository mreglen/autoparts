import { useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import useNewPartsMarkupPercent from '../../../hooks/useNewPartsMarkupPercent';
import ClientMarkupPopover from '../../../components/NewParts/ClientMarkupPopover';
import NewPartsBasketHoverMenu from '../../../components/Cart/NewPartsBasketHoverMenu';
import { CLIENT_MARKUP_DISPLAY_BOTH } from '../../../redux/slices/ClientMarkupSlice';
import { canUseClientMarkup, computeClientPrices } from '../../../utils/clientMarkupUtils';
import { canEditClientMarkupSettings } from '../../../utils/autoservicePermissions';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';
import { mapPartToStocksData, dedupeRosskoParts, rosskoPartDedupeKey } from '../NewParts/rosskoHelpers';
import {
  formatDeliveryParts,
  formatPriceRub,
} from '../NewParts/newPartStockUtils';
import {
  addNewPartsToCart,
  refreshNewPartsCartOffers,
  removeFromCart,
  selectCart,
  selectCartLoading,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';
import VinCatalogOfferMobileCard from './VinCatalogOfferMobileCard';

function toSafeInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.trunc(n);
}

function toIsoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function sameDeliveryInstant(a, b) {
  const left = toIsoOrNull(a);
  const right = toIsoOrNull(b);
  return left === right;
}

function buildOfferRefreshItems(groups, cartItems) {
  if (!groups?.length || !cartItems?.length) return [];
  const cartByKey = new Map();
  cartItems.forEach((item) => {
    const key = `${String(item.stock_id || '').trim()}|${String(item.brand || '').trim()}|${String(item.partnumber || '').trim()}`;
    if (!cartByKey.has(key)) cartByKey.set(key, []);
    cartByKey.get(key).push(item);
  });

  const items = [];
  const seen = new Set();
  groups.forEach((group) => {
    const stocks = [group.mainStock, ...(group.otherStocks || [])].filter(Boolean);
    stocks.forEach((stock) => {
      const stockId = String(stock.stock_id || '').trim();
      const brand = String(group.brand || '').trim();
      const partnumber = String(group.number || '').trim();
      const key = `${stockId}|${brand}|${partnumber}`;
      if (!stockId || !brand || !partnumber || seen.has(key)) return;
      const matches = cartByKey.get(key);
      if (!matches?.length) return;
      const deliveryStart = toIsoOrNull(stock.delivery_start);
      const deliveryEnd = toIsoOrNull(stock.delivery_end);
      if (!deliveryStart && !deliveryEnd) return;
      const needsUpdate = matches.some(
        (item) =>
          !sameDeliveryInstant(item.delivery_start, deliveryStart)
          || !sameDeliveryInstant(item.delivery_end, deliveryEnd)
      );
      if (!needsUpdate) return;
      seen.add(key);
      items.push({
        stock_id: stockId,
        brand,
        partnumber,
        delivery_start: deliveryStart || undefined,
        delivery_end: deliveryEnd || undefined,
        max_quantity: Math.max(1, Number(stock.available_count) || 1),
        name: group.name || undefined,
      });
    });
  });
  return items;
}

function getDeliverySortTime(stock) {
  if (!stock?.delivery_start) return Number.POSITIVE_INFINITY;
  const time = new Date(stock.delivery_start).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function partGroupKey(part) {
  return rosskoPartDedupeKey(part);
}

function DeliveryCell({ deliveryStart, deliveryEnd }) {
  const parts = formatDeliveryParts(deliveryStart, deliveryEnd);
  if (!parts) {
    return <span className="text-xs text-gray-500">—</span>;
  }
  return (
    <div className="text-xs leading-snug text-gray-900">
      <div className="font-semibold">{parts.dateLine}</div>
      <div className="text-gray-600">{parts.timeLine}</div>
    </div>
  );
}

function CartQtyControl({
  quantity,
  maxQty,
  onAdd,
  onAddToBasket,
  onRemove,
  disabled,
  showBasketPicker = true,
}) {
  const safeQty = toSafeInt(quantity, 0);
  const atMax = safeQty >= maxQty;

  if (safeQty > 0) {
    return (
      <div className="inline-flex items-center gap-0.5">
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
          aria-label="Уменьшить количество"
        >
          −
        </button>
        <span className="min-w-[1.25rem] text-center text-xs font-bold text-gray-900">{safeQty}</span>
        <button
          type="button"
          onClick={onAdd}
          disabled={disabled || atMax}
          className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
      disabled={disabled}
      showPicker={showBasketPicker}
    />
  );
}

function buildPartGroups(parts) {
  const list = dedupeRosskoParts(Array.isArray(parts) ? parts : []);
  const groups = [];
  const seenGroupKeys = new Set();

  list.forEach((part) => {
    const brand = String(part?.brand || '').trim();
    const number = String(part?.partnumber || part?.article || '').trim();
    const name = formatProductDisplayTitle(brand, number, part?.name) || `${brand} ${number}`.trim();
    const stocks = mapPartToStocksData(part)
      .filter((stock) => stock?.price && stock.price !== 0 && (stock.available_count || 0) > 0)
      .sort((a, b) => getDeliverySortTime(a) - getDeliverySortTime(b));

    if (!stocks.length) return;

    const key = partGroupKey(part);
    if (!key || key === '|' || seenGroupKeys.has(key)) return;
    seenGroupKeys.add(key);

    groups.push({
      key,
      part,
      brand,
      number,
      name,
      stocks,
      mainStock: stocks[0],
      otherStocks: stocks.slice(1),
      detailHref: buildNewPartOpenPath({ brand, article: number }),
    });
  });

  return groups.sort(
    (a, b) => getDeliverySortTime(a.mainStock) - getDeliverySortTime(b.mainStock)
  );
}

function PriceCell({ purchasePrice, clientPrice, showBoth }) {
  const showPurchase = showBoth && purchasePrice > 0 && Math.abs(clientPrice - purchasePrice) > 0.009;
  if (showPurchase) {
    return (
      <div className="text-right leading-tight">
        <div className="text-xs font-bold text-gray-900">{formatPriceRub(clientPrice)}</div>
        <div className="text-[10px] text-gray-500">{formatPriceRub(purchasePrice)}</div>
      </div>
    );
  }
  return (
    <div className="text-right text-xs font-bold text-gray-900">{formatPriceRub(clientPrice)}</div>
  );
}

function StockOfferRow({
  stock,
  part,
  brand,
  number,
  name,
  detailHref,
  siteMarkupPercent,
  clientMarkupPercent,
  showBothPrices,
  isSubRow = false,
  warehousesToggle = null,
  onOpenPart = null,
  vinBasketId = null,
  ensureVinBasket = null,
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

  const prepareCartItem = (quantityToAdd) => {
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

  const handleAdd = async (basketId) => {
    if (cartQuantity >= maxQty) return;
    setBusy(true);
    try {
      const cartItem = prepareCartItem(1);
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

  return (
    <tr
      className={`border-b border-gray-100 transition hover:bg-indigo-50/30 ${
        isSubRow ? 'bg-gray-50/60' : 'bg-white'
      }`}
    >
      <td className={`whitespace-nowrap px-3 py-2 overflow-hidden ${isSubRow ? 'relative' : ''}`}>
        {!isSubRow ? (
          <button
            type="button"
            onClick={handleOpen}
            className="block max-w-full truncate text-left font-mono text-xs font-medium text-indigo-700 hover:text-indigo-900"
            title={number}
          >
            {number}
          </button>
        ) : (
          <span className="absolute left-1.5 top-1/2 h-px w-2 -translate-y-1/2 bg-gray-300" aria-hidden />
        )}
      </td>
      <td className="whitespace-nowrap px-2 py-2 overflow-hidden text-xs font-medium text-gray-900">
        {!isSubRow ? (
          <span className="block truncate" title={brand}>{brand}</span>
        ) : null}
      </td>
      <td className="px-2 py-2 align-middle overflow-hidden">
        {!isSubRow ? (
          <button
            type="button"
            onClick={handleOpen}
            className="block w-full text-left text-xs font-medium leading-tight text-indigo-700 hover:text-indigo-900 line-clamp-2 break-words whitespace-normal"
            title={name}
          >
            {name}
          </button>
        ) : null}
      </td>
      <td className="whitespace-nowrap px-3 py-2">
        <DeliveryCell deliveryStart={stock.delivery_start} deliveryEnd={stock.delivery_end} />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-xs text-gray-800">
        <div>{maxQty} шт.</div>
        {!isSubRow && warehousesToggle}
      </td>
      <td className="whitespace-nowrap px-3 py-2 pl-6">
        <PriceCell
          purchasePrice={purchasePrice}
          clientPrice={clientPrice}
          showBoth={showBothPrices}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <div className="inline-flex flex-col items-end">
          <CartQtyControl
          quantity={cartQuantity}
          maxQty={maxQty}
          onAdd={() => handleAdd()}
          onAddToBasket={handleAdd}
          onRemove={handleRemove}
          disabled={disabled}
        />
        </div>
      </td>
    </tr>
  );
}

function PartOfferGroup({
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

  const warehousesToggle = otherStocks.length > 0 ? (
    <button
      type="button"
      onClick={() => setShowOthers((prev) => !prev)}
      className="mt-0.5 block text-left text-[10px] font-medium text-indigo-600 hover:text-indigo-800"
    >
      {showOthers ? 'Скрыть' : 'Другие склады'}
    </button>
  ) : null;

  return (
    <>
      <StockOfferRow
        stock={mainStock}
        part={part}
        brand={brand}
        number={number}
        name={name}
        detailHref={detailHref}
        siteMarkupPercent={siteMarkupPercent}
        clientMarkupPercent={clientMarkupPercent}
        showBothPrices={showBothPrices}
        warehousesToggle={warehousesToggle}
        onOpenPart={onOpenPart}
        vinBasketId={vinBasketId}
        ensureVinBasket={ensureVinBasket}
      />
      {showOthers
        ? otherStocks.map((stock, index) => (
          <StockOfferRow
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
            isSubRow
            onOpenPart={onOpenPart}
            vinBasketId={vinBasketId}
            ensureVinBasket={ensureVinBasket}
          />
        ))
        : null}
    </>
  );
}

function OffersTable({ parts, emptyText, onOpenPart, vinBasketId, ensureVinBasket }) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const siteMarkupPercent = useNewPartsMarkupPercent('auto');
  const user = useSelector((state) => state.auth.user);
  const permissionCodes = useSelector((state) => state.auth.permissionCodes || []);
  const clientMarkup = useSelector((state) => state.clientMarkup);
  const showStaffMarkup = canUseClientMarkup(user);
  const canEditMarkupSettings = canEditClientMarkupSettings(user, permissionCodes);
  const clientMarkupPercent = showStaffMarkup ? (Number(clientMarkup.percent) || 0) : 0;
  const showBothPrices = showStaffMarkup && clientMarkup.displayMode === CLIENT_MARKUP_DISPLAY_BOTH;
  const syncSignatureRef = useRef('');

  const groups = useMemo(() => buildPartGroups(parts), [parts]);

  useEffect(() => {
    const refreshItems = buildOfferRefreshItems(groups, cart?.new_parts_items || []);
    if (!refreshItems.length) return undefined;
    const signature = refreshItems
      .map((item) => `${item.stock_id}|${item.brand}|${item.partnumber}|${item.delivery_start || ''}|${item.delivery_end || ''}`)
      .sort()
      .join(';');
    if (signature === syncSignatureRef.current) return undefined;
    syncSignatureRef.current = signature;
    const timer = setTimeout(() => {
      dispatch(refreshNewPartsCartOffers(refreshItems));
    }, 250);
    return () => clearTimeout(timer);
  }, [cart?.new_parts_items, dispatch, groups]);

  if (!groups.length) {
    return <p className="text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <>
      <div className="md:hidden space-y-3">
        {groups.map((group) => (
          <VinCatalogOfferMobileCard
            key={group.key}
            group={group}
            siteMarkupPercent={siteMarkupPercent}
            clientMarkupPercent={clientMarkupPercent}
            showBothPrices={showBothPrices}
            onOpenPart={onOpenPart}
            vinBasketId={vinBasketId}
            ensureVinBasket={ensureVinBasket}
          />
        ))}
      </div>
      <div className="hidden md:block -mx-1 overflow-hidden">
      <table className="w-full table-fixed border-collapse text-left">
        <colgroup>
          <col style={{ width: '108px' }} />
          <col style={{ width: '92px' }} />
          <col style={{ width: '176px' }} />
          <col style={{ width: '124px' }} />
          <col style={{ width: '76px' }} />
          <col style={{ width: '84px' }} />
          <col style={{ width: '68px' }} />
        </colgroup>
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
            <th className="px-3 py-2">Номер</th>
            <th className="px-2 py-2">Бренд</th>
            <th className="px-2 py-2">Наименование</th>
            <th className="px-3 py-2">Доставим</th>
            <th className="px-3 py-2">Остаток</th>
            <th className="px-3 py-2 pl-6 text-right">
              <div className="inline-flex items-center justify-end gap-1.5">
                {showStaffMarkup ? (
                  <ClientMarkupPopover readOnly={!canEditMarkupSettings} />
                ) : null}
                <span>Цена, ₽</span>
              </div>
            </th>
            <th className="px-3 py-2 pl-2 text-right">К заказу</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <PartOfferGroup
              key={group.key}
              group={group}
              siteMarkupPercent={siteMarkupPercent}
              clientMarkupPercent={clientMarkupPercent}
              showBothPrices={showBothPrices}
              onOpenPart={onOpenPart}
              vinBasketId={vinBasketId}
              ensureVinBasket={ensureVinBasket}
            />
          ))}
        </tbody>
      </table>
      </div>
    </>
  );
}

export default function VinCatalogOffersTable({
  parts,
  sectionType = 'available',
  emptyText = 'Нет предложений',
  onOpenPart = null,
  vinBasketId = null,
  ensureVinBasket = null,
}) {
  return (
    <OffersTable
      parts={parts}
      sectionType={sectionType}
      emptyText={emptyText}
      onOpenPart={onOpenPart}
      vinBasketId={vinBasketId}
      ensureVinBasket={ensureVinBasket}
    />
  );
}
