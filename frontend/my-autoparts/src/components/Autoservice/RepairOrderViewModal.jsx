import Modal from '../UI/Modal';
import { formatServerDateTime } from '../../utils/serverDate';
import {
  formatShopPartQty,
  formatShopPartUnit,
  priceWithMarkup,
  shopLineSum,
  shopPartDisplayName,
  shopPartPricingOptions,
} from '../../utils/repairOrderShopPartUtils';

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

function MetaItem({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

function Section({ title, children, total }) {
  return (
    <section className="border-t border-gray-100 pt-4">
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500">{title}</h3>
        {total != null ? (
          <p className="text-xs tabular-nums text-gray-500">{total}</p>
        ) : null}
      </div>
      {children}
    </section>
  );
}

function EmptyLine({ children }) {
  return <p className="py-1 text-sm text-gray-400">{children}</p>;
}

function LinesTable({ columns, children }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-xs">
        <thead>
          <tr className="text-gray-400">
            {columns.map((col) => (
              <th key={col} className="pb-1.5 pr-3 font-medium">
                {col}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50 text-gray-700">{children}</tbody>
      </table>
    </div>
  );
}

export function OrderLinesExpand({ row, showExecutors = false }) {
  const works = row.works || [];
  const parts = row.client_parts || [];
  const shop = row.shop_parts || [];
  const worksTotal = row.works_total ?? works.reduce((s, w) => s + lineSum(w.qty, w.unit_price), 0);
  const shopTotal =
    row.shop_parts_total ??
    shop.reduce(
      (s, p) => s + (
        Number(p.line_sum) || shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p))
      ),
      0,
    );

  return (
    <div className="space-y-1">
      <Section title="Работы" total={works.length ? `${formatMoney(worksTotal)} ₽` : null}>
        {works.length === 0 ? (
          <EmptyLine>Нет работ</EmptyLine>
        ) : (
          <LinesTable
            columns={
              showExecutors
                ? ['№', 'Название', 'Кол-во', 'Цена', 'Сумма', 'Исполнитель']
                : ['№', 'Название', 'Кол-во', 'Цена', 'Сумма']
            }
          >
            {works.map((w) => (
              <tr key={w.id || `${w.position}-${w.title}`}>
                <td className="py-1.5 pr-3 tabular-nums text-gray-500">{w.position}</td>
                <td className="py-1.5 pr-3 font-medium text-gray-900">{w.title}</td>
                <td className="py-1.5 pr-3 tabular-nums">{w.qty}</td>
                <td className="py-1.5 pr-3 tabular-nums">{formatMoney(w.unit_price)}</td>
                <td className="py-1.5 pr-3 tabular-nums">
                  {formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price))}
                </td>
                {showExecutors ? (
                  <td className="py-1.5">
                    {(w.executors || []).length
                      ? (w.executors || []).map((ex) => (
                          <span key={ex.employee_id} className="mr-2 inline-block">
                            {ex.employee?.name || '—'}
                          </span>
                        ))
                      : w.executor?.name || '—'}
                  </td>
                ) : null}
              </tr>
            ))}
          </LinesTable>
        )}
      </Section>

      <Section title="Запчасти клиента">
        {parts.length === 0 ? (
          <EmptyLine>Нет запчастей клиента</EmptyLine>
        ) : (
          <LinesTable columns={['№', 'Название', 'Кол-во', 'Ед.']}>
            {parts.map((p) => (
              <tr key={p.id || `${p.position}-${p.title}`}>
                <td className="py-1.5 pr-3 tabular-nums text-gray-500">{p.position}</td>
                <td className="py-1.5 pr-3 font-medium text-gray-900">{p.title}</td>
                <td className="py-1.5 pr-3 tabular-nums">{p.qty}</td>
                <td className="py-1.5 tabular-nums">{formatShopPartUnit(p.unit || 'pcs')}</td>
              </tr>
            ))}
          </LinesTable>
        )}
      </Section>

      <Section title="Запчасти исполнителя" total={shop.length ? `${formatMoney(shopTotal)} ₽` : null}>
        {shop.length === 0 ? (
          <EmptyLine>Нет запчастей исполнителя</EmptyLine>
        ) : (
          <LinesTable columns={['№', 'Наименование', 'Кол-во', 'Ед.', 'Цена', 'Сумма']}>
            {shop.map((p) => {
              const unitLabel = formatShopPartUnit(p.unit || 'pcs');
              const qtyLabel = formatShopPartQty(p.qty, p.unit || 'pcs');
              const name = p.display_name || shopPartDisplayName(p);
              const clientPrice = p.price_with_markup
                ?? priceWithMarkup(p.unit_price, p.markup_percent, shopPartPricingOptions(p));
              const sum = p.line_sum
                ?? shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p));
              return (
                <tr key={p.id || `${p.position}-${p.title}`}>
                  <td className="py-1.5 pr-3 tabular-nums text-gray-500">{p.position}</td>
                  <td className="py-1.5 pr-3 font-medium text-gray-900">{name}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{qtyLabel}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{unitLabel}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatMoney(clientPrice)}</td>
                  <td className="py-1.5 pr-3 tabular-nums">{formatMoney(sum)}</td>
                </tr>
              );
            })}
          </LinesTable>
        )}
      </Section>
    </div>
  );
}

function orderTotals(order) {
  const works = order.works || [];
  const shop = order.shop_parts || [];
  const worksTotal = order.works_total ?? works.reduce((s, w) => s + lineSum(w.qty, w.unit_price), 0);
  const shopTotal =
    order.shop_parts_total ??
    shop.reduce(
      (s, p) => s + (
        Number(p.line_sum) || shopLineSum(p.qty, p.unit_price, p.markup_percent, shopPartPricingOptions(p))
      ),
      0,
    );
  const grand = order.grand_total ?? worksTotal + shopTotal;
  return { worksTotal, shopTotal, grand };
}

export default function RepairOrderViewModal({
  order,
  loading = false,
  onClose,
  onEdit,
  showExecutors = true,
}) {
  if (!order && !loading) return null;

  const totals = order ? orderTotals(order) : null;
  const clientLine = [order?.client?.name, order?.client?.phone].filter(Boolean).join(' · ') || '—';
  const hasClientComment = Boolean(order?.client_comment?.trim());
  const hasStaffComment = Boolean(order?.staff_comment?.trim());

  return (
    <Modal
      open={!!order || loading}
      onClose={onClose}
      size="lg"
      title={
        order ? (
          <div className="flex flex-wrap items-center gap-2.5 pr-2">
            <h2 className="text-base font-semibold text-gray-900">Заказ-наряд №{order.order_number}</h2>
            <OrderStatusBadge status={order.status} />
          </div>
        ) : (
          'Заказ-наряд'
        )
      }
      footer={
        order ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">Итого заказ</p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-gray-900">
                {formatMoney(totals.grand)} ₽
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
              >
                Закрыть
              </button>
              {onEdit ? (
                <button
                  type="button"
                  onClick={() => onEdit(order)}
                  className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
                >
                  Изменить
                </button>
              ) : null}
            </div>
          </div>
        ) : null
      }
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Загрузка…</p>
      ) : (
        <div className="space-y-5">
          <dl className="grid gap-4 sm:grid-cols-2">
            <MetaItem label="Клиент">{clientLine}</MetaItem>
            <MetaItem label="Авто">{vehicleLabel(order.vehicle)}</MetaItem>
            <MetaItem label="Дата">{formatDateTime(order.scheduled_at) || '—'}</MetaItem>
            <MetaItem label="Рабочая зона">{order.work_zone?.name || '—'}</MetaItem>
            {showExecutors ? (
              <MetaItem label="Принял">{order.accepted_by?.name || '—'}</MetaItem>
            ) : null}
          </dl>

          {(hasClientComment || hasStaffComment || showExecutors) && (
            <div className="space-y-2 rounded-xl bg-gray-50 px-3.5 py-3 text-sm">
              <p>
                <span className="font-medium text-gray-900">Комментарий клиента</span>
                <span className="mt-0.5 block whitespace-pre-wrap text-gray-700">
                  {order.client_comment?.trim() || '—'}
                </span>
              </p>
              {showExecutors ? (
                <p className="border-t border-gray-100 pt-2">
                  <span className="font-medium text-gray-900">Комментарий сотрудника</span>
                  <span className="mt-0.5 block whitespace-pre-wrap text-gray-700">
                    {order.staff_comment?.trim() || '—'}
                  </span>
                </p>
              ) : null}
            </div>
          )}

          <OrderLinesExpand row={order} showExecutors={showExecutors} />
        </div>
      )}
    </Modal>
  );
}
