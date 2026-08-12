import { useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';
import { mapPartToStocksData } from '../NewParts/rosskoHelpers';
import {
  applyMarkup,
  formatDeliveryParts,
  formatPriceRub,
} from '../NewParts/newPartStockUtils';
import {
  addNewPartsToCart,
  removeFromCart,
  selectCart,
  selectCartLoading,
  updateCartItemQuantity,
} from '../../../redux/slices/CartSlice';
import { trackConversion, CONVERSION_EVENTS } from '../../../utils/siteAnalytics';

function toSafeInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.trunc(n);
}

function getDeliverySortTime(stock) {
  if (!stock?.delivery_start) return Number.POSITIVE_INFINITY;
  const time = new Date(stock.delivery_start).getTime();
  return Number.isNaN(time) ? Number.POSITIVE_INFINITY : time;
}

function partGroupKey(part) {
  const brand = String(part?.brand || '').trim();
  const number = String(part?.partnumber || part?.article || '').trim();
  return String(part?.guid || '').trim() || `${brand}|${number}`;
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

function CartIcon({ className = 'h-4 w-4' }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden>
      <path
        d="M15 15C13.8954 15 13 15.8954 13 17C13 18.1046 13.8954 19 15 19C16.1046 19 17 18.1046 17 17C17 15.8954 16.1046 15 15 15ZM15 15H7.29395C6.83288 15 6.60193 15 6.41211 14.918C6.24466 14.8456 6.09938 14.7291 5.99354 14.5805C5.8749 14.414 5.82719 14.1913 5.73274 13.7505L3.27148 2.26465C3.17484 1.81363 3.12587 1.58838 3.00586 1.41992C2.90002 1.27135 2.75477 1.15441 2.58732 1.08205C2.39746 1 2.16779 1 1.70653 1H1M4 4H16.8732C17.595 4 17.9555 4 18.1978 4.15036C18.41 4.28206 18.5653 4.48862 18.633 4.729C18.7104 5.00343 18.611 5.34996 18.411 6.04346L17.0264 10.8435C16.9068 11.2581 16.8469 11.465 16.7256 11.6189C16.6185 11.7547 16.4772 11.861 16.317 11.9263C16.1361 12 15.9211 12 15.4921 12H5.73047M6 19C4.89543 19 4 18.1046 4 17C4 15.8954 4.89543 15 6 15C7.10457 15 8 15.8954 8 17C8 18.1046 7.10457 19 6 19Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CartQtyControl({ quantity, maxQty, onAdd, onRemove, disabled }) {
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
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      className="inline-flex h-7 w-7 items-center justify-center rounded border border-gray-300 bg-white text-indigo-700 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:cursor-not-allowed disabled:opacity-50"
      aria-label="Добавить в корзину"
      title="Добавить в корзину"
    >
      <CartIcon />
    </button>
  );
}

function buildPartGroups(parts) {
  const list = Array.isArray(parts) ? parts : [];
  const groups = [];

  list.forEach((part) => {
    const brand = String(part?.brand || '').trim();
    const number = String(part?.partnumber || part?.article || '').trim();
    const name = formatProductDisplayTitle(brand, number, part?.name) || `${brand} ${number}`.trim();
    const stocks = mapPartToStocksData(part)
      .filter((stock) => stock?.price && stock.price !== 0 && (stock.available_count || 0) > 0)
      .sort((a, b) => getDeliverySortTime(a) - getDeliverySortTime(b));

    if (!stocks.length) return;

    groups.push({
      key: partGroupKey(part),
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

function StockOfferRow({
  stock,
  part,
  brand,
  number,
  name,
  detailHref,
  markupPercent,
  isSubRow = false,
  warehousesToggle = null,
}) {
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);
  const [busy, setBusy] = useState(false);

  const maxQty = Math.max(1, Number(stock.available_count) || 1);
  const price = applyMarkup(stock.price, markupPercent);

  const cartItemInStore = useMemo(() => {
    if (!stock?.stock_id || !cart?.new_parts_items) return null;
    return (
      cart.new_parts_items.find(
        (item) =>
          item.stock_id === String(stock.stock_id)
          && item.brand === brand
          && item.partnumber === number
      ) || null
    );
  }, [brand, cart?.new_parts_items, number, stock?.stock_id]);

  const cartQuantity = cartItemInStore ? toSafeInt(cartItemInStore.quantity, 0) : 0;
  const disabled = busy || cartLoading;

  const prepareCartItem = (quantityToAdd) => {
    const item = {
      brand,
      partnumber: number,
      quantity: quantityToAdd,
      price,
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
      const cartItem = prepareCartItem(1);
      if (!cartItem.stock_id || cartItem.price <= 0) return;
      await dispatch(addNewPartsToCart(cartItem)).unwrap();
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
            onClick={() => window.open(detailHref, '_blank', 'noopener,noreferrer')}
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
      <td className="px-2 py-2 align-top overflow-hidden">
        {!isSubRow ? (
          <button
            type="button"
            onClick={() => window.open(detailHref, '_blank', 'noopener,noreferrer')}
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
      <td className="whitespace-nowrap px-3 py-2 pl-6 text-right text-xs font-bold text-gray-900">
        {formatPriceRub(price)}
      </td>
      <td className="whitespace-nowrap px-3 py-2 text-right">
        <div className="inline-flex flex-col items-end">
          <CartQtyControl
          quantity={cartQuantity}
          maxQty={maxQty}
          onAdd={handleAdd}
          onRemove={handleRemove}
          disabled={disabled}
        />
        </div>
      </td>
    </tr>
  );
}

function PartOfferGroup({ group, markupPercent }) {
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
        markupPercent={markupPercent}
        warehousesToggle={warehousesToggle}
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
            markupPercent={markupPercent}
            isSubRow
          />
        ))
        : null}
    </>
  );
}

function OffersTable({ parts, emptyText }) {
  const adminSellerMarkupContext = useSelector((state) => state.publicInfo.adminSellerMarkupContext);
  const globalMarkupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 15);
  const markupPercent = adminSellerMarkupContext?.markupPercent ?? globalMarkupPercent;

  const groups = useMemo(() => buildPartGroups(parts), [parts]);

  if (!groups.length) {
    return <p className="text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="min-w-[840px] w-full table-fixed border-collapse text-left">
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
            <th className="px-3 py-2 pl-6 text-right">Цена, ₽</th>
            <th className="px-3 py-2 pl-2 text-right">К заказу</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <PartOfferGroup key={group.key} group={group} markupPercent={markupPercent} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VinCatalogOffersTable({ parts, sectionType = 'available', emptyText = 'Нет предложений' }) {
  return <OffersTable parts={parts} sectionType={sectionType} emptyText={emptyText} />;
}
