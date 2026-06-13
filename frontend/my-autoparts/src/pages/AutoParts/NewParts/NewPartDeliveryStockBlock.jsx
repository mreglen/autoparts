import React from 'react';
import { useSelector } from 'react-redux';
import {
  formatDeliveryTimeText,
  formatPriceRub,
  applyMarkup,
  summarizeStocks,
} from './newPartStockUtils';
import NewPartHorizontalScroll from './NewPartHorizontalScroll';

function StockMobileCard({ stock, markupPercent }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-gray-500">Склад</p>
          <p className="text-sm font-semibold text-gray-900">{stock.stock_id}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-gray-500">Цена</p>
          <p className="text-base font-bold text-gray-900">
            {formatPriceRub(applyMarkup(stock.price, markupPercent))} ₽
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-600">
        <span>В наличии: <strong className="text-gray-900">{stock.available_count} шт.</strong></span>
        <span>{formatDeliveryTimeText(stock.delivery_start, stock.delivery_end)}</span>
      </div>
    </div>
  );
}

export default function NewPartDeliveryStockBlock({ stocks, inStock }) {
  const markupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 15);
  const summary = summarizeStocks(stocks, markupPercent);

  if (!summary.active.length) {
    return (
      <section className="mb-4 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm sm:mb-6 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Наличие и поставка</h2>
        <p className="mt-2 text-sm text-gray-600">
          {inStock ? 'Уточняем наличие на складах поставщика.' : 'Сейчас нет доступных складов для заказа.'}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:mb-6 sm:p-5">
      <h2 className="text-base font-semibold text-gray-900 sm:text-lg">Наличие и поставка</h2>
      <p className="mt-2 text-sm text-gray-600">
        В наличии на {summary.warehouseCount} {summary.warehouseCount === 1 ? 'складе' : 'складах'}
        {summary.minPrice ? `, от ${formatPriceRub(summary.minPrice)} ₽` : ''}
        {summary.totalQty ? `, всего ${summary.totalQty} шт.` : ''}.
        Доставка по России.
      </p>

      <div className="mt-4 space-y-3 md:hidden">
        {summary.active.map((stock) => (
          <StockMobileCard key={stock.stock_id} stock={stock} markupPercent={markupPercent} />
        ))}
      </div>

      <div className="mt-4 hidden md:block">
        <NewPartHorizontalScroll hint="Листайте таблицу складов →" showHint={summary.active.length > 3}>
          <table className="min-w-[40rem] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-xs uppercase tracking-wide text-gray-500">
                <th className="px-3 py-2 font-medium">Склад</th>
                <th className="px-3 py-2 font-medium">Наличие</th>
                <th className="px-3 py-2 font-medium">Цена</th>
                <th className="px-3 py-2 font-medium">Срок поставки</th>
              </tr>
            </thead>
            <tbody>
              {summary.active.map((stock) => (
                <tr key={stock.stock_id} className="border-b border-gray-100 last:border-0">
                  <td className="px-3 py-2 text-gray-800">{stock.stock_id}</td>
                  <td className="px-3 py-2 text-gray-800">{stock.available_count} шт.</td>
                  <td className="px-3 py-2 font-medium text-gray-900">
                    {formatPriceRub(applyMarkup(stock.price, markupPercent))} ₽
                  </td>
                  <td className="px-3 py-2 text-gray-600">
                    {formatDeliveryTimeText(stock.delivery_start, stock.delivery_end)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </NewPartHorizontalScroll>
      </div>
    </section>
  );
}
