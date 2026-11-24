import React, { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import Modal from '../../components/UI/Modal';
import {
  REPAIR_ORDER_STATUS_LABELS,
  normalizeRepairOrderStatus,
} from '../../components/Autoservice/RepairOrderViewModal';

const BOOKING_STATUS_META = {
  new: { label: 'В ожидании', className: 'bg-warning-50 text-warning-700 ring-warning-100' },
  confirmed: { label: 'Подтверждена', className: 'bg-brand-50 text-brand-700 ring-brand-100' },
  processed: { label: 'Обработана', className: 'bg-success-50 text-success-700 ring-success-100' },
  cancelled: { label: 'Отменена', className: 'bg-surface-subtle text-ink-muted ring-line' },
};

const ORDER_STATUS_STYLES = {
  pending: 'bg-warning-50 text-warning-700 ring-warning-100',
  in_progress: 'bg-brand-50 text-brand-700 ring-brand-100',
  done: 'bg-success-50 text-success-700 ring-success-100',
  completed: 'bg-success-100 text-success-700 ring-success-100',
  cancelled: 'bg-surface-subtle text-ink-muted ring-line',
  review: 'bg-accent-50 text-accent-700 ring-accent-100',
};

function formatDate(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value).slice(0, 10);
  return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function Badge({ label, className }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ring-1 ring-inset ${className}`}>
      {label}
    </span>
  );
}

function Section({ title, children }) {
  return (
    <section className="border-t border-line-soft pt-3 first:border-t-0 first:pt-0">
      <h4 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
      {children}
    </section>
  );
}

export default function AutoserviceChatClientModal({ chatId, isOpen, onClose }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!isOpen || !chatId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError('');
    setProfile(null);
    apiRequest(`/autoservice/chats/${chatId}/client-profile`)
      .then((data) => {
        if (!cancelled) setProfile(data);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(typeof err === 'string' ? err : err?.message || 'Не удалось загрузить профиль');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen, chatId]);

  const client = profile?.client;
  const vehicles = profile?.vehicles || [];
  const bookings = profile?.bookings || [];
  const orders = profile?.orders || [];

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={client?.name || 'Клиент автосервиса'}
      size="md"
      draggable
    >
      {loading ? (
        <p className="py-8 text-center text-sm text-ink-muted">Загрузка…</p>
      ) : error ? (
        <p className="py-8 text-center text-sm text-danger-600">{error}</p>
      ) : !profile ? null : (
        <div className="max-h-[70vh] space-y-4 overflow-y-auto pr-1 text-sm">
          <Section title="Контакты">
            <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-2">
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Телефон</dt>
                <dd className="font-medium text-ink">{client?.phone || '—'}</dd>
              </div>
              <div>
                <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Email</dt>
                <dd className="font-medium text-ink">{client?.email || '—'}</dd>
              </div>
              {client?.address ? (
                <div className="sm:col-span-2">
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Адрес</dt>
                  <dd className="font-medium text-ink">{client.address}</dd>
                </div>
              ) : null}
              {client?.discount_percent && Number(client.discount_percent) > 0 ? (
                <div>
                  <dt className="text-[11px] uppercase tracking-wide text-ink-muted">Скидка</dt>
                  <dd className="font-medium text-ink">{Number(client.discount_percent)}%</dd>
                </div>
              ) : null}
            </dl>
          </Section>

          <Section title={`Автомобили (${vehicles.length})`}>
            {vehicles.length === 0 ? (
              <p className="text-ink-muted">Нет данных</p>
            ) : (
              <ul className="space-y-1">
                {vehicles.map((v) => (
                  <li key={v.id} className="flex flex-wrap items-baseline gap-x-2">
                    <span className="font-medium text-ink">
                      {[v.make, v.model].filter(Boolean).join(' ')}
                      {v.year ? `, ${v.year}` : ''}
                    </span>
                    {v.plate ? <span className="text-xs text-ink-muted">{v.plate}</span> : null}
                    {v.vin ? <span className="text-xs text-ink-faint">VIN {v.vin}</span> : null}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section title={`Записи на осмотр (${bookings.length})`}>
            {bookings.length === 0 ? (
              <p className="text-ink-muted">Нет записей</p>
            ) : (
              <ul className="space-y-1.5">
                {bookings.map((b) => {
                  const meta = BOOKING_STATUS_META[b.status] || {
                    label: b.status,
                    className: 'bg-surface-subtle text-ink-soft ring-line',
                  };
                  return (
                    <li key={b.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium tabular-nums text-ink">
                        {formatDate(b.preferred_date)}
                        {b.preferred_time ? ` · ${String(b.preferred_time).slice(0, 5)}` : ''}
                      </span>
                      <Badge label={meta.label} className={meta.className} />
                      {b.vehicle_label ? (
                        <span className="truncate text-xs text-ink-muted">{b.vehicle_label}</span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          <Section title={`Заказ-наряды (${orders.length})`}>
            {orders.length === 0 ? (
              <p className="text-ink-muted">Нет заказ-нарядов</p>
            ) : (
              <ul className="space-y-1.5">
                {orders.map((o) => {
                  const normalized = normalizeRepairOrderStatus(o.status);
                  const label = REPAIR_ORDER_STATUS_LABELS[o.status] || REPAIR_ORDER_STATUS_LABELS[normalized] || o.status;
                  const style = ORDER_STATUS_STYLES[o.status] || ORDER_STATUS_STYLES[normalized] || 'bg-surface-subtle text-ink-soft ring-line';
                  return (
                    <li key={o.id} className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-ink">
                        {o.order_number ? `№${o.order_number}` : `Заказ #${o.id}`}
                      </span>
                      <Badge label={label} className={style} />
                      {o.vehicle_label ? (
                        <span className="truncate text-xs text-ink-muted">{o.vehicle_label}</span>
                      ) : null}
                      {o.scheduled_at ? (
                        <span className="text-xs text-ink-faint">
                          с {formatDateTime(o.scheduled_at)}
                        </span>
                      ) : null}
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>
        </div>
      )}
    </Modal>
  );
}
