import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import RepairOrderViewModal, { OrderStatusBadge, vehicleLabel } from '../../components/Autoservice/RepairOrderViewModal';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';

const pillControlClass =
  'h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0';

function formatDateTime(value) {
  return formatServerDateTime(value);
}

function normalizeStatus(status) {
  if (status === 'accepted' || status === 'open') return 'pending';
  if (status === 'ready' || status === 'issued') return 'completed';
  return status;
}

function StatusPicker({ status, options, disabled, saving, onChange }) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const normalized = normalizeStatus(status);
  const available = options.filter((option) => option.value !== normalized);

  useEffect(() => {
    if (!open) return undefined;
    const onDocClick = (event) => {
      if (rootRef.current && !rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  if (available.length === 0) {
    return <OrderStatusBadge status={status} />;
  }

  return (
    <div ref={rootRef} className="status-picker relative inline-block">
      <button
        type="button"
        disabled={disabled || saving}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((value) => !value);
        }}
        className="rounded-full transition hover:brightness-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-wait disabled:opacity-60"
        title="Сменить статус"
      >
        <OrderStatusBadge status={status} className={saving ? 'opacity-70' : ''} />
      </button>
      {open ? (
        <div className={buildActionsDropdownMenuClassName(false, 'w-44 z-50')}>
          {available.map((option) => (
            <ActionsDropdownItem
              key={option.value}
              disabled={option.disabled}
              title={option.disabled ? option.disabledTitle : undefined}
              onClick={() => {
                if (option.disabled) return;
                setOpen(false);
                onChange(option.value);
              }}
            >
              {option.label}
            </ActionsDropdownItem>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function OrderActionsMenu({ onView, onEdit, showLabel = true }) {
  return (
    <ActionsDropdown
      menuClassName="w-44 z-50"
      estimatedMenuHeight={120}
      showLabel={showLabel}
      buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
    >
      <ActionsDropdownItem onClick={onView}>Просмотр</ActionsDropdownItem>
      <ActionsDropdownItem onClick={onEdit}>Изменить</ActionsDropdownItem>
    </ActionsDropdown>
  );
}

function OrderMobileCard({
  row,
  statusActions,
  statusSavingId,
  onStatusChange,
  onView,
  onEdit,
}) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onView} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">№ {row.order_number}</span>
            <StatusPicker
              status={row.status}
              options={statusActions}
              saving={statusSavingId === row.id}
              disabled={statusSavingId === row.id}
              onChange={(nextStatus) => onStatusChange(row.id, nextStatus)}
            />
          </div>
          <p className="mt-1 truncate text-sm font-medium text-gray-800">{vehicleLabel(row.vehicle)}</p>
          <p className="mt-0.5 truncate text-sm text-gray-500">
            {row.client?.name || '—'}
            {row.client?.phone ? ` · ${row.client.phone}` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500">{formatDateTime(row.scheduled_at)}</p>
          {row.work_zone?.name ? (
            <p className="mt-0.5 text-xs text-gray-500">Зона: {row.work_zone.name}</p>
          ) : null}
        </button>
        <div className="shrink-0">
          <OrderActionsMenu onView={onView} onEdit={onEdit} showLabel={false} />
        </div>
      </div>
    </div>
  );
}

export default function AutoserviceOrdersPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const viewHistory = searchParams.get('view') === 'history';

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [historyStatus, setHistoryStatus] = useState('');
  const [viewOrder, setViewOrder] = useState(null);
  const [statusSavingId, setStatusSavingId] = useState(null);

  const scope = viewHistory ? 'history' : 'active';

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope });
      if (qApplied.trim()) params.set('q', qApplied.trim());
      if (viewHistory && historyStatus) params.set('status', historyStatus);
      const data = await apiRequest(`/autoservice/repair-orders?${params.toString()}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить записи');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope, qApplied, viewHistory, historyStatus]);

  useEffect(() => {
    if (isReady && isAuthenticated) {
      load();
    }
  }, [isReady, isAuthenticated, load]);

  const setHistoryMode = (on) => {
    if (on) setSearchParams({ view: 'history' });
    else setSearchParams({});
    setViewOrder(null);
  };

  const handleStatus = async (id, nextStatus) => {
    setStatusSavingId(id);
    setError('');
    try {
      await apiRequest(`/autoservice/repair-orders/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status: nextStatus }),
      });
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось сменить статус');
    } finally {
      setStatusSavingId(null);
    }
  };

  const statusActions = useMemo(
    () =>
      viewHistory
        ? [
            { value: 'pending', label: 'Ожидание' },
            { value: 'in_progress', label: 'В работу' },
          ]
        : [
            { value: 'pending', label: 'Ожидание' },
            { value: 'in_progress', label: 'В работу' },
            { value: 'completed', label: 'Завершить' },
            { value: 'cancelled', label: 'Отменить' },
          ],
    [viewHistory],
  );

  const statusActionsForRow = useCallback(
    (row) => {
      const unpaid = row?.is_paid === false || Number(row?.remaining_amount ?? 0) > 0.005;
      return statusActions.map((option) =>
        option.value === 'completed' && unpaid
          ? {
              ...option,
              disabled: true,
              disabledTitle: 'Сначала оплатите заказ-наряд полностью',
            }
          : option,
      );
    },
    [statusActions],
  );

  const handleOrderUpdated = useCallback(
    (updated) => {
      setViewOrder(updated);
      setRows((prev) => prev.map((row) => (row.id === updated.id ? { ...row, ...updated } : row)));
      if (updated.status === 'completed' || updated.status === 'cancelled') {
        load();
      }
    },
    [load],
  );

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">
            {viewHistory ? 'История заказ-нарядов' : 'Заказ-наряды'}
          </h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading
              ? 'Загрузка…'
              : viewHistory
                ? `${rows.length} завершённых и отменённых`
                : `${rows.length} активных`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!viewHistory ? (
            <button
              type="button"
              onClick={() => navigate('/autoservice/orders/new')}
              className="inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700"
            >
              Новый заказ-наряд
            </button>
          ) : null}
        </div>
      </div>

      <UnderlineTabs
        className="mb-4"
        ariaLabel="Разделы заказ-нарядов"
        gapClassName="gap-4"
        tabs={[
          { id: 'active', label: 'Активные' },
          { id: 'history', label: 'История' },
        ]}
        value={viewHistory ? 'history' : 'active'}
        onChange={(id) => setHistoryMode(id === 'history')}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <input
            className={`${pillControlClass} pr-10`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Номер, клиент, авто, VIN или госномер"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQApplied(q);
            }}
            aria-label="Поиск заказ-нарядов"
          />
          {q ? (
            <button
              type="button"
              onClick={() => {
                setQ('');
                setQApplied('');
              }}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
              aria-label="Очистить поиск"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          ) : null}
        </div>

        {viewHistory ? (
          <select
            className="h-10 shrink-0 rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70"
            value={historyStatus}
            onChange={(e) => setHistoryStatus(e.target.value)}
            aria-label="Фильтр по статусу"
          >
            <option value="">Все статусы</option>
            <option value="completed">Завершён</option>
            <option value="cancelled">Отменён</option>
          </select>
        ) : null}

        <button
          type="button"
          onClick={() => setQApplied(q)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-gray-900 px-5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Найти
        </button>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
          title="Обновить"
          aria-label="Обновить"
        >
          <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {/* Desktop table */}
      <div className="hidden md:block min-w-0">
        <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
          <thead>
            <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <th className="w-28 py-3 pr-3">Заказ</th>
              <th className="py-3 pr-3">Автомобиль</th>
              <th className="py-3 pr-3">Клиент</th>
              <th className="w-40 py-3 pr-3">Дата</th>
              <th className="hidden py-3 pr-3 xl:table-cell">Зона</th>
              <th className="hidden py-3 pr-3 xl:table-cell">Принял</th>
              <th className="w-32 py-3 pr-3">Статус</th>
              <th className="w-28 py-3 text-right">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-12 text-center text-gray-500">
                  {viewHistory ? 'В истории пока нет заказ-нарядов' : 'Активных заказ-нарядов нет'}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer transition-colors hover:bg-gray-50/70"
                  onDoubleClick={(e) => {
                    if (e.target.closest('.actions-dropdown') || e.target.closest('.status-picker')) {
                      return;
                    }
                    setViewOrder(row);
                  }}
                >
                  <td className="py-3 pr-3 align-middle">
                    <span className="font-semibold tabular-nums text-gray-900">№ {row.order_number}</span>
                  </td>
                  <td className="py-3 pr-3 align-middle font-medium text-gray-900">{vehicleLabel(row.vehicle)}</td>
                  <td className="py-3 pr-3 align-middle">
                    <div className="font-medium text-gray-900">{row.client?.name || '—'}</div>
                    {row.client?.phone ? <div className="mt-0.5 text-xs text-gray-500">{row.client.phone}</div> : null}
                  </td>
                  <td className="whitespace-nowrap py-3 pr-3 align-middle text-gray-700">
                    {formatDateTime(row.scheduled_at)}
                  </td>
                  <td className="hidden py-3 pr-3 align-middle text-gray-600 xl:table-cell">
                    {row.work_zone?.name || '—'}
                  </td>
                  <td className="hidden py-3 pr-3 align-middle text-gray-600 xl:table-cell">
                    {row.accepted_by?.name || '—'}
                  </td>
                  <td className="py-3 pr-3 align-middle">
                    <StatusPicker
                      status={row.status}
                      options={statusActionsForRow(row)}
                      saving={statusSavingId === row.id}
                      disabled={statusSavingId === row.id}
                      onChange={(nextStatus) => handleStatus(row.id, nextStatus)}
                    />
                  </td>
                  <td className="py-3 text-right align-middle">
                    <OrderActionsMenu
                      onView={() => setViewOrder(row)}
                      onEdit={() => navigate(`/autoservice/orders/${row.id}/edit`)}
                    />
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Mobile list */}
      <div className="md:hidden">
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {viewHistory ? 'В истории пока нет заказ-нарядов' : 'Активных заказ-нарядов нет'}
          </p>
        ) : (
          rows.map((row) => (
            <OrderMobileCard
              key={row.id}
              row={row}
              statusActions={statusActionsForRow(row)}
              statusSavingId={statusSavingId}
              onStatusChange={handleStatus}
              onView={() => setViewOrder(row)}
              onEdit={() => navigate(`/autoservice/orders/${row.id}/edit`)}
            />
          ))
        )}
      </div>

      <RepairOrderViewModal
        order={viewOrder}
        enablePayment
        onOrderChange={handleOrderUpdated}
        onClose={() => setViewOrder(null)}
        onEdit={(order) => {
          setViewOrder(null);
          navigate(`/autoservice/orders/${order.id}/edit`);
        }}
      />
    </div>
  );
}
