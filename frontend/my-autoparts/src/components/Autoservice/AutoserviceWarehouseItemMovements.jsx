import React from 'react';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';

function formatMovementDate(value) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch {
    return '—';
  }
}

function formatMovementUnit(qty, unit) {
  if (unit === 'pcs') return `${qty} шт.`;
  return `${qty} ${unit}`;
}

export default function AutoserviceWarehouseItemMovements({
  movements,
  loading,
  error,
  showReceipts = true,
  showExpenses = true,
  showStock = true,
}) {
  if (loading) {
    return <p className="text-sm text-ink-muted">Загрузка движений…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger-600" role="alert">{error}</p>;
  }
  if (!movements) return null;

  return (
    <div className="space-y-4 text-sm">
      {showStock ? (
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-ink-muted">Количество:</span>{' '}
            <span className="font-medium tabular-nums text-ink">{formatMovementUnit(movements.quantity, movements.unit)}</span>
          </div>
          <div>
            <span className="text-ink-muted">Доступно:</span>{' '}
            <span className="font-medium tabular-nums text-ink">{formatMovementUnit(movements.available_qty, movements.unit)}</span>
          </div>
        </div>
      ) : null}

      {showReceipts && movements.receipts?.length > 0 ? (
        <div>
          <h4 className="mb-2 font-semibold text-ink">Поступления</h4>
          <ul className="divide-y divide-line-soft rounded-sg border border-line-soft">
            {movements.receipts.map((r) => (
              <li key={r.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">{formatMovementDate(r.doc_date)}</span>
                  <span className="shrink-0 tabular-nums font-medium text-ink">
                    {formatMovementUnit(r.quantity, r.unit)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-soft">
                  <span>Закуп: {formatAutoserviceWarehouseMoney(r.unit_price)}</span>
                  {r.repair_order_number ? (
                    <span>Заказ-наряд {r.repair_order_number}</span>
                  ) : r.doc_number ? (
                    <span>№ {r.doc_number}</span>
                  ) : null}
                  {r.supplier_name ? <span>{r.supplier_name}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {showExpenses && movements.expenses?.length > 0 ? (
        <div>
          <h4 className="mb-2 font-semibold text-ink">Списания</h4>
          <ul className="divide-y divide-line-soft rounded-sg border border-line-soft">
            {movements.expenses.map((e) => (
              <li key={e.id} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">{formatMovementDate(e.created_at)}</span>
                  <span className="shrink-0 tabular-nums font-medium text-ink">
                    {formatMovementUnit(e.quantity, e.unit)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-soft">
                  <span>Цена: {formatAutoserviceWarehouseMoney(e.client_unit_price)}</span>
                  {e.repair_order_number ? (
                    <span>Заказ-наряд {e.repair_order_number}</span>
                  ) : null}
                  {e.reason ? <span className="truncate">{e.reason}</span> : null}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
