import React from 'react';
import { useSelector } from 'react-redux';
import {
  formatDeliveryTimeText,
  formatPriceRub,
  applyMarkup,
  summarizeStocks,
} from './newPartStockUtils';

export default function NewPartDeliveryStockBlock({ stocks, inStock }) {
  const markupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 15);
  const summary = summarizeStocks(stocks, markupPercent);

  if (!summary.active.length) {
    return (
      <section className="mb-6 rounded-2xl border border-amber-100 bg-amber-50/60 p-4 shadow-sm sm:p-5">
        <h2 className="text-lg font-semibold text-gray-900">Наличие и поставка</h2>
        <p className="mt-2 text-sm text-gray-600">
          {inStock ? 'Уточняем наличие на складах поставщика.' : 'Сейчас нет доступных складов для заказа.'}
        </p>
      </section>
    );
  }

  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <h2 className="text-lg font-semibold text-gray-900">Наличие и поставка</h2>
      <p className="mt-2 text-sm text-gray-600">
        В наличии на {summary.warehouseCount} {summary.warehouseCount === 1 ? 'складе' : 'складах'}
        {summary.minPrice ? `, от ${formatPriceRub(summary.minPrice)} ₽` : ''}
        {summary.totalQty ? `, всего ${summary.totalQty} шт.` : ''}.
        Доставка по России.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
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
      </div>
    </section>
  );
}
