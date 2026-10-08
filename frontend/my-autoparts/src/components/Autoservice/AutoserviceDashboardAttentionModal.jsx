import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from '../UI/Modal';
import { apiRequest } from '../../utils/apiClient';
import { formatFinanceCurrency } from '../../pages/Finance/financeDisplay';
import {
  formatOrderClockRange,
  formatPersonNameWithInitials,
  repairOrderNumberLabel,
} from '../../utils/autoserviceOrderDisplay';
import { formatServerDate, formatServerDateTime } from '../../utils/serverDate';

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function vehicleLabel(v) {
  const parts = [v?.make, v?.model, v?.year].filter(Boolean);
  return parts.join(' ') || '—';
}

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

export default function AutoserviceDashboardAttentionModal({ open, type, summary, onClose }) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  const meta = TILE_META[type] || null;

  useEffect(() => {
    if (!open || !type) return;
    setLoading(true);
    setError('');
    setRows([]);
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

  const handleOpenPage = () => {
    if (meta?.url) {
      onClose();
      navigate(meta.url);
    }
  };

  if (!open || !meta) return null;

  return (
    <Modal open={open} onClose={onClose} title={meta.title} size="md" footer={(
      <div className="flex justify-end">
        <button type="button" className="inline-flex min-h-11 items-center justify-center rounded-sg-sm bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700 sm:min-h-10" onClick={handleOpenPage}>
          Открыть страницу
        </button>
      </div>
    )}>
      <div className="space-y-4">
        {summaryValue != null ? (
          <p className="text-sm text-ink-muted">
            Всего: <span className="font-semibold text-ink">{summaryValue}</span>
          </p>
        ) : null}

        {loading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Загрузка…</p>
        ) : error ? (
          <p className="py-6 text-center text-sm text-danger-600">{error}</p>
        ) : rows.length === 0 ? (
          <EmptyList>Нет записей</EmptyList>
        ) : (
          <div className="space-y-1">
            {type === 'debt' && rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-sg border border-line-soft bg-surface p-3">
                <span className="min-w-0 text-sm font-medium text-ink truncate">{row.name || '—'}</span>
                <span className="shrink-0 text-sm font-medium tabular-nums text-danger-600">{formatMoney(row.debt_amount)} ₽</span>
              </div>
            ))}

            {type === 'new_bookings' && rows.map((row) => (
              <div key={row.id} className="rounded-sg border border-line-soft bg-surface p-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-ink">{formatPersonNameWithInitials(row.name) || '—'}</span>
                  <span className="text-xs text-warning-700">Новая заявка</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {row.phone || '—'} · {formatServerDate(row.preferred_date) || '—'} {row.preferred_time?.slice(0, 5) || ''}
                </p>
              </div>
            ))}

            {(type === 'review' || type === 'in_progress') && rows.map((row) => (
              <div key={row.id} className="rounded-sg border border-line-soft bg-surface p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 text-sm font-medium text-ink truncate">
                    {repairOrderNumberLabel(row) || `Заказ-наряд №${row.id}`}
                  </span>
                  <span className="shrink-0 text-xs tabular-nums text-ink-muted">{formatOrderClockRange(row)}</span>
                </div>
                <p className="mt-1 text-xs text-ink-muted">
                  {row.client?.name || '—'} · {vehicleLabel(row.vehicle)}
                </p>
              </div>
            ))}

            {type === 'revenue_30d' && rows.map((row) => (
              <div key={row.id} className="flex items-center justify-between rounded-sg border border-line-soft bg-surface p-3">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-ink truncate">
                    Заказ-наряд №{row.repair_order_number || row.repair_order_id}
                  </p>
                  <p className="text-xs text-ink-muted">{row.client_name || '—'} · {formatServerDateTime(row.created_at) || '—'}</p>
                </div>
                <span className="shrink-0 text-sm font-semibold tabular-nums text-success-700">+{formatMoney(row.amount)} ₽</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function toISODate(d) {
  return d.toISOString().slice(0, 10);
}
