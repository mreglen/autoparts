import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../UI/Modal';
import Toast from '../UI/Toast';
import RepairOrderViewModal from './RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import { formatFinanceCurrency } from '../../pages/Finance/financeDisplay';
import {
  formatOrderClockRange,
  formatPersonNameWithInitials,
} from '../../utils/autoserviceOrderDisplay';
import { formatServerDate, formatServerDateTime } from '../../utils/serverDate';
import { AUTOSERVICE_PAYMENT_METHOD_LABELS } from '../../utils/autoservicePaymentReceipt';

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function vehicleLabel(v) {
  const parts = [v?.make, v?.model, v?.year].filter(Boolean);
  return parts.join(' ') || '—';
}

function bookingVehicleLabel(b) {
  if (b?.vehicle) return vehicleLabel(b.vehicle);
  const parts = [b?.vehicle_make, b?.vehicle_model].filter(Boolean);
  return parts.join(' ') || '—';
}

function orderRefLabel({ order_number: orderNumber, id }) {
  const num = orderNumber || id;
  return num ? `Заказ-наряд №${num}` : 'Заказ-наряд';
}

const ORDER_LINK_CLASS =
  'font-medium text-brand-600 underline decoration-brand-300/70 underline-offset-2 transition hover:text-brand-700';

const BOOKING_SOURCE_LABELS = {
  site: 'Сайт',
  staff: 'Сотрудник',
  client: 'Клиент',
};

const TILE_META = {
  review: { title: 'На проверке', url: '/autoservice/orders?view=review' },
  new_bookings: { title: 'Новые записи на осмотр', url: '/autoservice/inspections' },
  debt: { title: 'Долги клиентов', url: '/autoservice/clients' },
  in_progress: { title: 'В работе', url: '/autoservice/orders' },
  revenue_30d: { title: 'Выручка за 30 дней', url: '/autoservice/finance' },
};

function EmptyList({ children }) {
  return <p className="py-6 text-center text-sm text-ink-muted">{children}</p>;
}

function RowButton({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full cursor-pointer rounded-sg border border-line-soft bg-surface p-3 text-left transition hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-600"
    >
      {children}
    </button>
  );
}

function DetailField({ label, value, tone, wide = false }) {
  const toneClass = tone === 'danger'
    ? 'font-semibold text-danger-600'
    : tone === 'success'
      ? 'font-semibold text-success-700'
      : 'text-ink';
  return (
    <div className={wide ? 'col-span-2' : undefined}>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</p>
      <p className={`mt-0.5 text-sm ${toneClass}`}>{value || '—'}</p>
    </div>
  );
}

function ClientDetail({ client }) {
  return (
    <div className="grid grid-cols-2 gap-3">
      <DetailField label="Клиент" value={client?.name} wide />
      <DetailField label="Телефон" value={client?.phone} />
      <DetailField label="Email" value={client?.email} />
      <DetailField label="Долг" value={`${formatMoney(client?.debt_amount)} ₽`} tone="danger" />
      <DetailField label="Заказов" value={client?.orders_count != null ? String(client.orders_count) : ''} />
      <DetailField label="Сумма заказов" value={`${formatMoney(client?.orders_total)} ₽`} />
      <DetailField label="Оплачено" value={`${formatMoney(client?.paid_total)} ₽`} />
      <DetailField label="Скидка" value={client?.discount_percent ? `${client.discount_percent}%` : ''} />
      <DetailField label="Авто" value={client?.matched_vehicle_label} />
      <DetailField label="Последний визит" value={client?.last_visit_at ? formatServerDateTime(client.last_visit_at) : ''} />
      <DetailField label="Адрес" value={client?.address} wide />
    </div>
  );
}

function BookingDetail({ booking }) {
  const time = booking?.preferred_time ? String(booking.preferred_time).slice(0, 5) : '';
  return (
    <div className="grid grid-cols-2 gap-3">
      <DetailField label="Имя" value={booking?.name} />
      <DetailField label="Телефон" value={booking?.phone} />
      <DetailField
        label="Дата"
        value={`${formatServerDate(booking?.preferred_date) || '—'}${time ? ` ${time}` : ''}`}
      />
      <DetailField label="Авто" value={bookingVehicleLabel(booking)} />
      <DetailField label="Статус" value="Новая заявка" />
      <DetailField label="Источник" value={BOOKING_SOURCE_LABELS[booking?.source] || booking?.source} />
      <DetailField label="Создана" value={formatServerDateTime(booking?.created_at)} wide={!booking?.notes} />
      {booking?.notes ? (
        <div className="col-span-2">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Комментарий</p>
          <p className="mt-0.5 whitespace-pre-line text-sm text-ink">{booking.notes}</p>
        </div>
      ) : null}
    </div>
  );
}

export default function AutoserviceDashboardAttentionModal({ open, type, summary, onClose, onChanged }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);
  const [detail, setDetail] = useState(null);
  const [viewOrder, setViewOrder] = useState(null);
  const [viewOrderLoading, setViewOrderLoading] = useState(false);
  const [orderError, setOrderError] = useState('');

  const meta = TILE_META[type] || null;

  useEffect(() => {
    if (!open || !type) return;
    setLoading(true);
    setError('');
    setRows([]);
    setDetail(null);
    let cancelled = false;

    const fetchData = async () => {
      try {
        let data;
        if (type === 'review') {
          data = await apiRequest('/autoservice/repair-orders?scope=review&limit=20');
          if (!cancelled) setRows(Array.isArray(data?.items) ? data.items : []);
        } else if (type === 'in_progress') {
          data = await apiRequest('/autoservice/repair-orders?scope=active&status=in_progress&limit=20');
          if (!cancelled) setRows(Array.isArray(data?.items) ? data.items : []);
        } else if (type === 'new_bookings') {
          data = await apiRequest('/autoservice/inspection-bookings');
          const list = Array.isArray(data) ? data : [];
          if (!cancelled) setRows(list.filter((b) => b?.status === 'new'));
        } else if (type === 'debt') {
          data = await apiRequest('/autoservice/clients');
          const list = Array.isArray(data) ? data : [];
          if (!cancelled) setRows(list.filter((c) => Number(c?.debt_amount) > 0));
        } else if (type === 'revenue_30d') {
          const to = new Date();
          const from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const params = new URLSearchParams({
            date_from: toISODate(from),
            date_to: toISODate(to),
          });
          data = await apiRequest(`/autoservice/finance/receipts?${params}`);
          if (!cancelled) setRows(Array.isArray(data?.items) ? data.items : []);
        }
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    return () => { cancelled = true; };
  }, [open, type]);

  useEffect(() => {
    if (!open) {
      setDetail(null);
      setViewOrder(null);
      setViewOrderLoading(false);
      setOrderError('');
    }
  }, [open]);

  const summaryValue = useMemo(() => {
    if (!summary || !type) return null;
    switch (type) {
      case 'review': return summary.review_orders;
      case 'new_bookings': return summary.new_bookings;
      case 'debt': return formatFinanceCurrency(summary.debt_total);
      case 'in_progress': return summary.in_progress_orders;
      case 'revenue_30d': return formatFinanceCurrency(summary.revenue_30d);
      default: return null;
    }
  }, [summary, type]);

  const openOrderById = useCallback(async (orderId) => {
    if (!orderId) return;
    setViewOrderLoading(true);
    setOrderError('');
    try {
      const data = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setViewOrder(data);
    } catch (e) {
      setOrderError(e?.message || 'Не удалось открыть заказ-наряд');
    } finally {
      setViewOrderLoading(false);
    }
  }, []);

  const handleRowClick = (row) => {
    if (type === 'review' || type === 'in_progress') {
      setViewOrder(row);
    } else if (type === 'revenue_30d') {
      openOrderById(row?.repair_order_id);
    } else if (type === 'debt') {
      setDetail({ kind: 'client', row });
    } else if (type === 'new_bookings') {
      setDetail({ kind: 'booking', row });
    }
  };

  const handleOpenPage = () => {
    if (meta?.url) {
      onClose();
      navigate(meta.url);
    }
  };

  if (!open || !meta) return null;

  const detailTitle = detail?.kind === 'client'
    ? 'Клиент'
    : detail?.kind === 'booking'
      ? 'Запись на осмотр'
      : meta.title;

  return (
    <>
      <Modal
        open={open}
        onClose={detail ? () => setDetail(null) : onClose}
        title={detailTitle}
        size="md"
        closeVariant={detail ? 'back' : 'close'}
        headerActions={detail ? (
          <button
            type="button"
            onClick={onClose}
            className="flex max-md:min-h-11 max-md:min-w-11 items-center justify-center rounded-sg p-1.5 text-ink-faint hover:bg-surface-subtle hover:text-ink"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        ) : null}
        footer={(
          <div className="flex justify-end">
            <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 sm:min-h-10" onClick={handleOpenPage}>
              Открыть страницу
            </button>
          </div>
        )}
      >
        <div className="space-y-4">
          {summaryValue != null && !detail ? (
            <p className="text-sm text-ink-muted">
              Всего: <span className="font-semibold text-ink">{summaryValue}</span>
            </p>
          ) : null}

          {detail?.kind === 'client' ? (
            <ClientDetail client={detail.row} />
          ) : detail?.kind === 'booking' ? (
            <BookingDetail booking={detail.row} />
          ) : loading ? (
            <p className="py-6 text-center text-sm text-ink-muted">Загрузка…</p>
          ) : error ? (
            <p className="py-6 text-center text-sm text-danger-600">{error}</p>
          ) : rows.length === 0 ? (
            <EmptyList>Нет записей</EmptyList>
          ) : (
            <div className="space-y-1">
              {type === 'debt' && rows.map((row) => (
                <RowButton key={row.id} onClick={() => handleRowClick(row)}>
                  <div className="flex items-center justify-between">
                    <span className="min-w-0 truncate text-sm font-medium text-ink">{row.name || '—'}</span>
                    <span className="shrink-0 text-sm font-medium tabular-nums text-danger-600">{formatMoney(row.debt_amount)} ₽</span>
                  </div>
                </RowButton>
              ))}

              {type === 'new_bookings' && rows.map((row) => (
                <RowButton key={row.id} onClick={() => handleRowClick(row)}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-ink">{formatPersonNameWithInitials(row.name) || '—'}</span>
                    <span className="text-xs text-warning-700">Новая заявка</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {row.phone || '—'} · {formatServerDate(row.preferred_date) || '—'} {row.preferred_time?.slice(0, 5) || ''}
                  </p>
                </RowButton>
              ))}

              {(type === 'review' || type === 'in_progress') && rows.map((row) => (
                <RowButton key={row.id} onClick={() => handleRowClick(row)}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`min-w-0 truncate text-sm ${ORDER_LINK_CLASS}`}>
                      {orderRefLabel(row)}
                    </span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-muted">{formatOrderClockRange(row)}</span>
                  </div>
                  <p className="mt-1 text-xs text-ink-muted">
                    {row.client?.name || '—'} · {vehicleLabel(row.vehicle)}
                  </p>
                </RowButton>
              ))}

              {type === 'revenue_30d' && rows.map((row) => (
                <RowButton key={row.id} onClick={() => handleRowClick(row)}>
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className={`truncate text-sm ${ORDER_LINK_CLASS}`}>
                        {orderRefLabel({ order_number: row.repair_order_number, id: row.repair_order_id })}
                      </p>
                      <p className="mt-0.5 text-xs text-ink-muted">
                        {row.client_name || '—'} · {AUTOSERVICE_PAYMENT_METHOD_LABELS[row.method] || '—'} · {formatServerDateTime(row.created_at) || '—'}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-success-700">+{formatMoney(row.amount)} ₽</span>
                  </div>
                </RowButton>
              ))}
            </div>
          )}
        </div>
      </Modal>

      <RepairOrderViewModal
        order={viewOrder}
        loading={viewOrderLoading}
        wrapperZIndex="var(--sg-z-modal-elevated-shell)"
        enablePayment={viewOrder?.status !== 'review'}
        onOrderChange={(updated) => {
          setViewOrder(updated);
          onChanged?.();
        }}
        onClose={() => setViewOrder(null)}
        onEdit={(order) => {
          setViewOrder(null);
          onClose?.();
          navigate(`/autoservice/orders/${order.id}/edit`);
        }}
      />
      <Toast message={orderError} variant="error" onClose={() => setOrderError('')} />
    </>
  );
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}
