import { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { buildNewPartOpenPath } from '../../../utils/partRoutes';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';
import { mapPartToStocksData } from '../NewParts/rosskoHelpers';
import {
  applyMarkup,
  formatDeliveryParts,
  formatPriceRub,
} from '../NewParts/newPartStockUtils';
import NewPartsCartAddButton from '../../../components/Cart/NewPartsCartAddButton';

function toSafeInt(value, fallback = 1) {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.trunc(n);
}

function DeliveryCell({ deliveryStart, deliveryEnd }) {
  const parts = formatDeliveryParts(deliveryStart, deliveryEnd);
  if (!parts) {
    return <span className="text-sm text-gray-500">—</span>;
  }
  return (
    <div className="text-sm leading-snug text-gray-900">
      <div className="font-semibold">{parts.dateLine}</div>
      <div className="text-gray-600">{parts.timeLine}</div>
    </div>
  );
}

function flattenPartStocks(part, sectionType) {
  const brand = String(part?.brand || '').trim();
  const number = String(part?.partnumber || part?.article || '').trim();
  const name = formatProductDisplayTitle(brand, number, part?.name) || `${brand} ${number}`.trim();
  const stocks = mapPartToStocksData(part).filter(
    (stock) => stock?.price && stock.price !== 0 && (stock.available_count || 0) > 0
  );

  return stocks.map((stock, index) => ({
    key: `${part?.guid || brand}|${number}|${stock.stock_id}|${index}`,
    part,
    brand,
    number,
    name,
    stock,
    sectionType,
    detailHref: buildNewPartOpenPath({ brand, article: number }),
  }));
}

function QuantityInput({ value, max, onChange, disabled }) {
  return (
    <input
      type="number"
      min={1}
      max={max}
      value={value}
      onChange={(e) => onChange(toSafeInt(e.target.value, 1))}
      disabled={disabled}
      className="h-9 w-16 rounded-lg border border-gray-300 bg-white px-2 text-center text-sm font-medium text-gray-900 outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20"
      aria-label="Количество"
    />
  );
}

function OfferRow({ row, markupPercent }) {
  const [quantity, setQuantity] = useState(1);
  const { brand, number, name, stock, detailHref, part } = row;
  const maxQty = Math.max(1, Number(stock.available_count) || 1);
  const safeQty = Math.min(quantity, maxQty);
  const price = applyMarkup(stock.price, markupPercent);

  const cartItem = useMemo(
    () => {
      const item = {
        brand,
        partnumber: number,
        quantity: safeQty,
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
    },
    [brand, name, number, part?.guid, price, safeQty, stock, maxQty]
  );

  return (
    <tr className="border-b border-gray-100 bg-white transition hover:bg-indigo-50/30">
      <td className="whitespace-nowrap px-3 py-2.5 text-sm font-medium text-gray-900">{brand}</td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <button
          type="button"
          onClick={() => window.open(detailHref, '_blank', 'noopener,noreferrer')}
          className="font-mono text-sm font-medium text-indigo-700 hover:text-indigo-900"
        >
          {number}
        </button>
      </td>
      <td className="max-w-[200px] px-3 py-2.5 align-top">
        <button
          type="button"
          onClick={() => window.open(detailHref, '_blank', 'noopener,noreferrer')}
          className="block w-full max-w-[200px] text-left text-sm font-medium leading-snug text-indigo-700 hover:text-indigo-900 line-clamp-2 break-words whitespace-normal"
        >
          {name}
        </button>
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <DeliveryCell
          deliveryStart={stock.delivery_start}
          deliveryEnd={stock.delivery_end}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm text-gray-800">
        {maxQty} шт.
      </td>
      <td className="whitespace-nowrap px-3 py-2.5 text-sm font-bold text-gray-900">
        {formatPriceRub(price)}
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <QuantityInput
          value={safeQty}
          max={maxQty}
          onChange={setQuantity}
          disabled={false}
        />
      </td>
      <td className="whitespace-nowrap px-3 py-2.5">
        <NewPartsCartAddButton cartItem={cartItem} analyticsSection="vin" />
      </td>
    </tr>
  );
}

function OffersTable({ parts, sectionType, emptyText }) {
  const adminSellerMarkupContext = useSelector((state) => state.publicInfo.adminSellerMarkupContext);
  const globalMarkupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 15);
  const markupPercent = adminSellerMarkupContext?.markupPercent ?? globalMarkupPercent;

  const rows = useMemo(() => {
    const list = Array.isArray(parts) ? parts : [];
    return list.flatMap((part) => flattenPartStocks(part, sectionType));
  }, [parts, sectionType]);

  if (!rows.length) {
    return <p className="text-sm text-gray-500">{emptyText}</p>;
  }

  return (
    <div className="-mx-1 overflow-x-auto">
      <table className="min-w-[780px] w-full table-fixed border-collapse text-left">
        <thead>
          <tr className="border-b border-gray-200 bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <th className="w-[72px] px-3 py-2.5">Бренд</th>
            <th className="w-[120px] px-3 py-2.5">Номер</th>
            <th className="w-[200px] px-3 py-2.5">Наименование</th>
            <th className="w-[120px] px-3 py-2.5">Доставим</th>
            <th className="w-[72px] px-3 py-2.5">Остаток</th>
            <th className="w-[88px] px-3 py-2.5">Цена, ₽</th>
            <th className="w-[80px] px-3 py-2.5">К заказу</th>
            <th className="w-14 px-3 py-2.5" aria-label="Корзина" />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <OfferRow key={row.key} row={row} markupPercent={markupPercent} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function VinCatalogOffersTable({ parts, sectionType = 'available', emptyText = 'Нет предложений' }) {
  return <OffersTable parts={parts} sectionType={sectionType} emptyText={emptyText} />;
}
