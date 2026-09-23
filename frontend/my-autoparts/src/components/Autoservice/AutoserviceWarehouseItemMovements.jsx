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

function buildFallbackEvents(movements) {
  const events = [];
  for (const r of movements?.receipts || []) {
    events.push({
      kind: 'receipt',
      date: r.doc_date,
      quantity: r.quantity,
      unit: r.unit,
      title: 'Приход',
      detail: r.supplier_name || (r.doc_number ? `№ ${r.doc_number}` : null),
      unit_price: r.unit_price,
      repair_order_id: r.repair_order_id,
      repair_order_number: r.repair_order_number,
      balance_after: null,
    });
  }
  for (const e of movements?.expenses || []) {
    events.push({
      kind: 'expense',
      date: e.created_at,
      quantity: -e.quantity,
      unit: e.unit,
      title: 'Списание',
      detail: e.reason,
      unit_price: e.client_unit_price,
      repair_order_id: e.repair_order_id,
      repair_order_number: e.repair_order_number,
      balance_after: null,
    });
  }
  events.sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  return events;
}

const KIND_QTY_CLASS = {
  receipt: 'text-success-700',
  expense: 'text-danger-600',
  return: 'text-warning-700',
  return_pending: 'text-ink-muted',
};

export default function AutoserviceWarehouseItemMovements({
  movements,
  loading,
  error,
  showStock = true,
  onOpenOrder,
}) {
  if (loading) {
    return <p className="text-sm text-ink-muted">Загрузка движений…</p>;
  }
  if (error) {
    return <p className="text-sm text-danger-600" role="alert">{error}</p>;
  }
  if (!movements) return null;

  const events = movements.events?.length
    ? movements.events
    : buildFallbackEvents(movements);

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

      <div>
        <h4 className="mb-2 font-semibold text-ink">Движения</h4>
        {events.length === 0 ? (
          <p className="text-ink-muted">Движений пока нет</p>
        ) : (
          <ul className="divide-y divide-line-soft rounded-sg border border-line-soft">
            {events.map((ev, i) => {
              const detail = ev.repair_order_id
                && String(ev.detail || '').startsWith('Заказ-наряд')
                ? ''
                : ev.detail;
              return (
              <li key={`${ev.kind}-${i}`} className="px-3 py-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-ink-muted">{formatMovementDate(ev.date)}</span>
                  <span className={`shrink-0 tabular-nums font-medium ${KIND_QTY_CLASS[ev.kind] || 'text-ink'}`}>
                    {ev.quantity > 0 ? '+' : ''}
                    {formatMovementUnit(ev.quantity, ev.unit)}
                  </span>
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-ink-soft">
                  <span className="font-medium text-ink">{ev.title}</span>
                  {ev.repair_order_id ? (
                    <button
                      type="button"
                      className="font-medium text-brand-700 hover:text-brand-900"
                      onClick={() => onOpenOrder?.(ev.repair_order_id)}
                    >
                      Заказ-наряд {ev.repair_order_number || `№${ev.repair_order_id}`}
                    </button>
                  ) : null}
                  {detail ? <span className="truncate">{detail}</span> : null}
                  {ev.unit_price != null ? (
                    <span>{formatAutoserviceWarehouseMoney(ev.unit_price)}</span>
                  ) : null}
                </div>
                {ev.balance_after != null ? (
                  <p className="mt-0.5 text-xs text-ink-faint">
                    Осталось: {formatMovementUnit(ev.balance_after, ev.unit)}
                  </p>
                ) : null}
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
