import React from 'react';
import { useSelector } from 'react-redux';
import { Card } from '../../../components/UI';
import {
  formatDeliveryTimeText,
  formatPriceRub,
  applyMarkup,
  summarizeStocks,
} from './newPartStockUtils';
import NewPartHorizontalScroll from './NewPartHorizontalScroll';

function StockMobileCard({ stock, markupPercent }) {
  return (
    <Card padding="none" className="bg-surface-muted p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs text-ink-muted">Склад</p>
          <p className="text-sm font-semibold text-ink">{stock.stock_id}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-ink-muted">Цена</p>
          <p className="text-base font-bold text-ink">
            {formatPriceRub(applyMarkup(stock.price, markupPercent))} ₽
          </p>
        </div>
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-ink-muted">
        <span>В наличии: <strong className="text-success-700">{stock.available_count} шт.</strong></span>
        <span>{formatDeliveryTimeText(stock.delivery_start, stock.delivery_end)}</span>
      </div>
    </Card>
  );
}

export default function NewPartDeliveryStockBlock({ stocks, inStock }) {
  const markupPercent = useSelector((state) => state.publicInfo.newPartsMarkupPercent ?? 30);
  const summary = summarizeStocks(stocks, markupPercent);

  if (!summary.active.length) {
    return (
      <Card as="section" padding="sm" className="mb-4 border-warning-100 sm:mb-6 sm:p-5">
        <h2 className="text-base font-semibold text-ink sm:text-lg">Наличие и поставка</h2>
        <p className="mt-2 text-sm text-ink-muted">
          {inStock ? 'Уточняем наличие на складах поставщика.' : 'Сейчас нет доступных складов для заказа.'}
        </p>
      </Card>
    );
  }

  return (
    <Card as="section" padding="sm" className="mb-4 sm:mb-6 sm:p-5">
      <h2 className="text-base font-semibold text-ink sm:text-lg">Наличие и поставка</h2>
      <p className="mt-2 text-sm text-ink-muted">
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
              <tr className="border-b border-line text-xs uppercase tracking-wide text-ink-muted">
                <th className="px-3 py-2 font-medium">Склад</th>
                <th className="px-3 py-2 font-medium">Наличие</th>
                <th className="px-3 py-2 font-medium">Цена</th>
                <th className="px-3 py-2 font-medium">Срок поставки</th>
              </tr>
            </thead>
            <tbody>
              {summary.active.map((stock) => (
                <tr key={stock.stock_id} className="border-b border-line-soft last:border-0">
                  <td className="px-3 py-2 text-ink-soft">{stock.stock_id}</td>
                  <td className="px-3 py-2 text-success-700">{stock.available_count} шт.</td>
                  <td className="px-3 py-2 font-medium text-ink">
                    {formatPriceRub(applyMarkup(stock.price, markupPercent))} ₽
                  </td>
                  <td className="px-3 py-2 text-ink-muted">
                    {formatDeliveryTimeText(stock.delivery_start, stock.delivery_end)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </NewPartHorizontalScroll>
      </div>
    </Card>
  );
}
