import { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import Modal, { ConfirmDialog } from '../UI/Modal';
import Toast from '../UI/Toast';
import { Skeleton } from '../UI';
import { formatServerDateTime } from '../../utils/serverDate';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import {
  autoserviceListMobileWrapClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
} from '../../utils/warehouseListUi';

const RETURN_STATUS_LABELS = {
  requested: 'Запрошен',
  reviewing: 'На рассмотрении',
  approved: 'Одобрен',
  sent: 'Отправлен',
  refunded: 'Деньги возвращены',
  rejected: 'Отклонён',
  cancelled: 'Отменён',
  closed: 'Закрыт',
};

const RETURN_STATUS_STYLES = {
  requested: 'bg-warning-50 text-warning-700 ring-warning-100',
  reviewing: 'bg-brand-50 text-brand-700 ring-brand-100',
  approved: 'bg-success-50 text-success-700 ring-success-100',
  sent: 'bg-brand-50 text-brand-700 ring-brand-100',
  refunded: 'bg-success-50 text-success-700 ring-success-100',
  rejected: 'bg-danger-50 text-danger-700 ring-danger-100',
  cancelled: 'bg-surface-subtle text-ink-muted ring-line',
  closed: 'bg-surface-subtle text-ink-muted ring-line',
};

const RETURN_REASON_LABELS = {
  defect: 'Брак',
  wrong_item: 'Не та деталь',
  not_as_described: 'Не соответствует описанию',
  changed_mind: 'Передумали',
  other: 'Другое',
};

const CANCELLABLE_STATUSES = new Set(['requested', 'reviewing', 'approved']);

function ReturnStatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${
        RETURN_STATUS_STYLES[status] || RETURN_STATUS_STYLES.requested
      }`}
    >
      {RETURN_STATUS_LABELS[status] || status}
    </span>
  );
}

function itemLabel(row) {
  const head = [row.brand, row.article].filter(Boolean).join(' ');
  return [head, row.name].filter(Boolean).join(' · ') || `Позиция №${row.item_id}`;
}

export default function AutoserviceWarehouseReturnsTab() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [viewRow, setViewRow] = useState(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const loadReturns = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/warehouse/returns');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setRows([]);
      setError(err?.message || 'Не удалось загрузить возвраты');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadReturns();
  }, [loadReturns]);

  const handleCancel = async () => {
    if (!viewRow?.id || cancelling) return;
    setCancelling(true);
    try {
      const updated = await apiRequest(
        `/autoservice/warehouse/returns/${viewRow.id}/status`,
        { method: 'PATCH', body: JSON.stringify({ status_code: 'cancelled' }) },
      );
      setRows((prev) => prev.map((row) => (row.id === updated.id ? updated : row)));
      setViewRow(updated);
      setCancelOpen(false);
    } catch (err) {
      setError(err?.message || 'Не удалось отменить возврат');
      setCancelOpen(false);
    } finally {
      setCancelling(false);
    }
  };

  return (
    <>
      <Toast message={error} variant="error" onClose={() => setError('')} />

      <div className={autoserviceListTableWrapClass}>
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`w-2/5 ${autoserviceListThClass}`}>Наименование</th>
              <th className={`w-32 ${autoserviceListThClass}`}>Поставщик</th>
              <th className={`w-14 whitespace-nowrap !pr-2 ${autoserviceListThRightClass}`}>Кол-во</th>
              <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Сумма</th>
              <th className={`w-32 ${autoserviceListThClass}`}>Статус</th>
              <th className={`w-32 whitespace-nowrap ${autoserviceListThClass}`}>Создан</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={`ret-sk-${index}`}>
                  <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-40" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                  <td className={`w-14 !pr-2 ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-8" /></td>
                  <td className={`w-24 ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-14" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-16" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-muted">
                  Заявок на возврат пока нет
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className={autoserviceListTrClickableClass}
                  onClick={() => setViewRow(row)}
                >
                  <td className={`min-w-0 ${autoserviceListTdClass}`}>
                    <div className="w-0 min-w-full truncate font-semibold text-ink">
                      {itemLabel(row)}
                    </div>
                  </td>
                  <td className={`${autoserviceListTdClass} truncate text-ink-muted`}>
                    {row.supplier_name || '—'}
                  </td>
                  <td className={`w-14 !pr-2 ${autoserviceListTdRightClass} tabular-nums whitespace-nowrap text-ink-muted`}>
                    {row.quantity}
                  </td>
                  <td className={`w-24 ${autoserviceListTdRightClass} tabular-nums whitespace-nowrap font-semibold`}>
                    {formatAutoserviceWarehouseMoney(Number(row.unit_price || 0) * Number(row.quantity || 0))}
                  </td>
                  <td className={autoserviceListTdClass}>
                    <ReturnStatusBadge status={row.status_code} />
                  </td>
                  <td className={`${autoserviceListTdClass} whitespace-nowrap text-ink-muted`}>
                    {formatServerDateTime(row.created_at)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={autoserviceListMobileWrapClass}>
        {loading ? (
          <div className="divide-y divide-line-soft">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={`mret-sk-${index}`} className="py-2">
                <Skeleton className="h-4 w-40" />
              </div>
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Заявок на возврат пока нет</p>
        ) : (
          <div className="divide-y divide-line-soft">
            {rows.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => setViewRow(row)}
                className="flex w-full items-start justify-between gap-3 py-2.5 text-left"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-ink">{itemLabel(row)}</p>
                  <p className="mt-0.5 text-xs text-ink-muted">
                    {row.supplier_name || '—'} · {row.quantity} шт ·{' '}
                    {formatAutoserviceWarehouseMoney(Number(row.unit_price || 0) * Number(row.quantity || 0))}
                  </p>
                </div>
                <ReturnStatusBadge status={row.status_code} />
              </button>
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(viewRow)}
        onClose={() => setViewRow(null)}
        title={viewRow ? `Возврат №${viewRow.id}` : 'Возврат'}
        size="sm"
        draggable
        footer={
          <div className="flex flex-wrap justify-end gap-2">
            {viewRow && CANCELLABLE_STATUSES.has(viewRow.status_code) ? (
              <button
                type="button"
                onClick={() => setCancelOpen(true)}
                className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-danger-600 transition hover:bg-surface-muted"
              >
                Отменить заявку
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setViewRow(null)}
              className="rounded-sg-sm border border-line-strong bg-surface px-4 py-2 text-sm font-medium text-ink-soft transition hover:bg-surface-muted"
            >
              Закрыть
            </button>
          </div>
        }
      >
        {viewRow ? (
          <div className="space-y-4 text-sm">
            <div>
              <ReturnStatusBadge status={viewRow.status_code} />
            </div>
            <dl className="grid gap-4 sm:grid-cols-2">
              <div className="min-w-0 sm:col-span-2">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Позиция</dt>
                <dd className="mt-1 font-medium text-ink">{itemLabel(viewRow)}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Поставщик</dt>
                <dd className="mt-1 font-medium text-ink">{viewRow.supplier_name || '—'}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Кол-во / Сумма</dt>
                <dd className="mt-1 font-medium text-ink">
                  {viewRow.quantity} шт · {formatAutoserviceWarehouseMoney(Number(viewRow.unit_price || 0) * Number(viewRow.quantity || 0))}
                </dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Причина</dt>
                <dd className="mt-1 font-medium text-ink">{RETURN_REASON_LABELS[viewRow.reason] || viewRow.reason}</dd>
              </div>
              <div className="min-w-0">
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Статус изменён</dt>
                <dd className="mt-1 font-medium text-ink">{formatServerDateTime(viewRow.status_changed_at)}</dd>
              </div>
            </dl>
            {viewRow.comment ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Комментарий</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink-soft">{viewRow.comment}</dd>
              </div>
            ) : null}
            {viewRow.seller_note ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Ответ поставщика</dt>
                <dd className="mt-1 whitespace-pre-wrap text-ink-soft">{viewRow.seller_note}</dd>
              </div>
            ) : null}
            {Array.isArray(viewRow.photo_urls) && viewRow.photo_urls.length ? (
              <div>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Фото</dt>
                <dd className="mt-1 text-ink-soft">{viewRow.photo_urls.length} шт.</dd>
              </div>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <ConfirmDialog
        open={cancelOpen}
        title="Отменить заявку на возврат?"
        message="Позиция вернётся в доступные для возврата."
        confirmLabel="Отменить заявку"
        cancelLabel="Назад"
        danger
        loading={cancelling}
        onConfirm={handleCancel}
        onClose={() => setCancelOpen(false)}
      />
    </>
  );
}
