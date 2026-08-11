import Modal from '../UI/Modal';
import { formatServerDateTime } from '../../utils/serverDate';

export const REPAIR_ORDER_STATUS_LABELS = {
  pending: 'Ожидание',
  in_progress: 'В работе',
  completed: 'Завершён',
  cancelled: 'Отменён',
  accepted: 'Ожидание',
  ready: 'Завершён',
  issued: 'Завершён',
  open: 'Ожидание',
};

const STATUS_STYLES = {
  pending: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
  accepted: 'bg-amber-50 text-amber-800 ring-amber-200',
  ready: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  issued: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  open: 'bg-amber-50 text-amber-800 ring-amber-200',
};

function formatDateTime(value) {
  return formatServerDateTime(value);
}

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function lineSum(qty, unitPrice) {
  const q = Number(qty) || 0;
  const p = Number(unitPrice) || 0;
  return Math.round(q * p * 100) / 100;
}

function priceWithMarkup(unitPrice, markupPercent) {
  const p = Number(unitPrice) || 0;
  const m = Number(markupPercent) || 0;
  return Math.round(p * (1 + m / 100) * 100) / 100;
}

function shopLineSum(qty, unitPrice, markupPercent) {
  return Math.round((Number(qty) || 0) * priceWithMarkup(unitPrice, markupPercent) * 100) / 100;
}

export function vehicleLabel(v) {
  if (!v) return '—';
  const parts = [v.make, v.model, v.year].filter(Boolean);
  const base = parts.join(' ') || 'Авто';
  if (v.plate) return `${base} (${v.plate})`;
  return base;
}

export function OrderStatusBadge({ status, className = '' }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.open
      } ${className}`}
    >
      {REPAIR_ORDER_STATUS_LABELS[status] || status}
    </span>
  );
}

function OrderLinesExpand({ row, showExecutors }) {
  const works = row.works || [];
  const parts = row.client_parts || [];
  const shop = row.shop_parts || [];
  const worksTotal = row.works_total ?? works.reduce((s, w) => s + lineSum(w.qty, w.unit_price), 0);
  const shopTotal =
    row.shop_parts_total
    ?? shop.reduce(
      (s, p) => s + (Number(p.line_sum) || shopLineSum(p.qty, p.unit_price, p.markup_percent)),
      0,
    );
  const grand = row.grand_total ?? worksTotal + shopTotal;

  return (
    <div className="space-y-4 text-sm text-gray-700">
      {showExecutors && (
        <div className="space-y-1 sm:hidden">
          <p>
            <span className="font-medium text-gray-900">Принял:</span> {row.accepted_by?.name || '—'}
          </p>
        </div>
      )}
      {row.lift?.name ? (
        <p>
          <span className="font-medium text-gray-900">Подъёмник:</span> {row.lift.name}
        </p>
      ) : null}
      {row.staff_comment && showExecutors ? (
        <p>
          <span className="font-medium text-gray-900">Комментарий сотрудника:</span> {row.staff_comment}
        </p>
      ) : null}
      <div>
        <p className="font-medium text-gray-900">Работы</p>
        {works.length === 0 ? (
          <p className="mt-1 text-gray-500">Нет работ</p>
        ) : (
          <table className="mt-2 min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">№</th>
                <th className="py-1 pr-3">Название</th>
                <th className="py-1 pr-3">Кол-во</th>
                <th className="py-1 pr-3">Цена</th>
                <th className="py-1 pr-3">Сумма</th>
                {showExecutors ? <th className="py-1">Исполнитель</th> : null}
              </tr>
            </thead>
            <tbody>
              {works.map((w) => (
                <tr key={w.id || `${w.position}-${w.title}`}>
                  <td className="py-1 pr-3">{w.position}</td>
                  <td className="py-1 pr-3">{w.title}</td>
                  <td className="py-1 pr-3">{w.qty}</td>
                  <td className="py-1 pr-3">{formatMoney(w.unit_price)}</td>
                  <td className="py-1 pr-3">{formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price))}</td>
                  {showExecutors ? (
                    <td className="py-1">
                      {(w.executors || []).length
                        ? (w.executors || []).map((ex) => (
                          <span key={ex.employee_id} className="mr-2 inline-block">
                            {ex.employee?.name}
                            {' '}
                            {formatMoney(ex.pay_amount)} ₽
                          </span>
                        ))
                        : w.executor?.name || '—'}
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 font-medium text-gray-900">Итого работ: {formatMoney(worksTotal)} ₽</p>
      </div>
      <div>
        <p className="font-medium text-gray-900">Запчасти клиента</p>
        {parts.length === 0 ? (
          <p className="mt-1 text-gray-500">Нет запчастей клиента</p>
        ) : (
          <table className="mt-2 min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">№</th>
                <th className="py-1 pr-3">Название</th>
                <th className="py-1">Кол-во</th>
              </tr>
            </thead>
            <tbody>
              {parts.map((p) => (
                <tr key={p.id || `${p.position}-${p.title}`}>
                  <td className="py-1 pr-3">{p.position}</td>
                  <td className="py-1 pr-3">{p.title}</td>
                  <td className="py-1">{p.qty}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div>
        <p className="font-medium text-gray-900">Запчасти исполнителя</p>
        {shop.length === 0 ? (
          <p className="mt-1 text-gray-500">Нет запчастей исполнителя</p>
        ) : (
          <table className="mt-2 min-w-full text-left text-xs">
            <thead className="text-gray-500">
              <tr>
                <th className="py-1 pr-3">№</th>
                <th className="py-1 pr-3">Название</th>
                <th className="py-1 pr-3">Кол-во</th>
                {showExecutors ? <th className="py-1 pr-3">Цена</th> : null}
                {showExecutors ? <th className="py-1 pr-3">Наценка %</th> : null}
                <th className="py-1 pr-3">Цена с наценкой</th>
                <th className="py-1 pr-3">Сумма</th>
                {showExecutors ? <th className="py-1">Источник</th> : null}
              </tr>
            </thead>
            <tbody>
              {shop.map((p) => (
                <tr key={p.id || `${p.position}-${p.title}`}>
                  <td className="py-1 pr-3">{p.position}</td>
                  <td className="py-1 pr-3">{p.title}</td>
                  <td className="py-1 pr-3">{p.qty}</td>
                  {showExecutors ? <td className="py-1 pr-3">{formatMoney(p.unit_price)}</td> : null}
                  {showExecutors ? <td className="py-1 pr-3">{p.markup_percent}</td> : null}
                  <td className="py-1 pr-3">
                    {formatMoney(p.price_with_markup ?? priceWithMarkup(p.unit_price, p.markup_percent))}
                  </td>
                  <td className="py-1 pr-3">
                    {formatMoney(p.line_sum ?? shopLineSum(p.qty, p.unit_price, p.markup_percent))}
                  </td>
                  {showExecutors ? <td className="py-1">{p.source || '—'}</td> : null}
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p className="mt-2 font-medium text-gray-900">Итого ЗЧ исполнителя: {formatMoney(shopTotal)} ₽</p>
        <p className="mt-1 font-semibold text-gray-900">Итого заказ: {formatMoney(grand)} ₽</p>
      </div>
    </div>
  );
}

export default function RepairOrderViewModal({ order, loading = false, onClose, onEdit }) {
  if (!order && !loading) return null;

  return (
    <Modal
      open={!!order || loading}
      onClose={onClose}
      title={order ? `Заказ-наряд №${order.order_number}` : 'Заказ-наряд'}
      size="lg"
      footer={order ? (
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            Закрыть
          </button>
          {onEdit ? (
            <button
              type="button"
              onClick={() => onEdit(order)}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
            >
              Изменить
            </button>
          ) : null}
        </div>
      ) : null}
    >
      {loading ? (
        <p className="text-sm text-gray-500">Загрузка…</p>
      ) : (
        <div className="space-y-4 text-sm text-gray-700">
          <div className="grid gap-3 sm:grid-cols-2">
            <p>
              <span className="font-medium text-gray-900">Клиент:</span>{' '}
              {order.client?.name || '—'}
              {order.client?.phone ? ` · ${order.client.phone}` : ''}
            </p>
            <p>
              <span className="font-medium text-gray-900">Авто:</span>{' '}
              {vehicleLabel(order.vehicle)}
            </p>
            <p>
              <span className="font-medium text-gray-900">Дата:</span>{' '}
              {formatDateTime(order.scheduled_at)}
            </p>
            <p>
              <span className="font-medium text-gray-900">Подъёмник:</span>{' '}
              {order.lift?.name || '—'}
            </p>
            <p>
              <span className="font-medium text-gray-900">Принял:</span>{' '}
              {order.accepted_by?.name || '—'}
            </p>
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-gray-900">Статус:</span>
              <OrderStatusBadge status={order.status} />
            </p>
          </div>
          {order.client_comment ? (
            <p>
              <span className="font-medium text-gray-900">Комментарий клиента:</span>{' '}
              {order.client_comment}
            </p>
          ) : null}
          <OrderLinesExpand row={order} showExecutors />
        </div>
      )}
    </Modal>
  );
}
