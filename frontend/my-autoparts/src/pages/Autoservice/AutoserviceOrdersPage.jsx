import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import RepairOrderViewModal, { OrderStatusBadge, vehicleLabel } from '../../components/Autoservice/RepairOrderViewModal';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';

const inputClass =
  'block h-11 w-full rounded-xl border border-gray-200 bg-white px-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 hover:border-gray-300 focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10';

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
        className="rounded-full transition hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 disabled:cursor-wait disabled:opacity-60"
        title="Сменить статус"
      >
        <OrderStatusBadge status={status} className={saving ? 'opacity-70' : ''} />
      </button>
      {open ? (
        <div className={buildActionsDropdownMenuClassName(false, 'w-44 z-50')}>
          {available.map((option) => (
            <ActionsDropdownItem
              key={option.value}
              onClick={() => {
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

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="min-h-screen bg-[#f7f7f5]">
    <div className="mx-auto max-w-[1440px] px-4 py-5 sm:px-6 sm:py-8">
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-gray-500">
            <span>Автосервис</span>
            <span className="text-gray-300">/</span>
            <span className="text-gray-700">Заказ-наряды</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-950 sm:text-3xl">
            {viewHistory ? 'История заказ-нарядов' : 'Заказ-наряды'}
          </h1>
          <p className="mt-1.5 text-sm text-gray-500">
            {viewHistory
              ? `${rows.length} завершённых и отменённых`
              : `${rows.length} активных заказ-нарядов`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {viewHistory ? (
            <button
              type="button"
              onClick={() => setHistoryMode(false)}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50"
            >
              ← Активные
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setHistoryMode(true)}
                className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 transition hover:border-gray-300 hover:bg-gray-50"
              >
                История
              </button>
              <button
                type="button"
                onClick={() => navigate('/autoservice/orders/new')}
                className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-indigo-600 px-5 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 active:scale-[.98]"
              >
                <span className="text-lg leading-none">+</span>
                Новый заказ-наряд
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-gray-200/80 bg-white p-3 shadow-sm sm:p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <svg
            className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="m21 21-4.35-4.35m1.35-5.65a7 7 0 1 1-14 0 7 7 0 0 1 14 0Z" />
          </svg>
          <input
            className={`${inputClass} pl-11`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Номер заказа, клиент, автомобиль, VIN или госномер"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQApplied(q);
            }}
            aria-label="Поиск заказ-нарядов"
          />
        </div>
        {viewHistory && (
          <div className="sm:w-48">
            <select
              className={inputClass}
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
              aria-label="Фильтр по статусу"
            >
              <option value="">Все статусы</option>
              <option value="completed">Завершён</option>
              <option value="cancelled">Отменён</option>
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={() => setQApplied(q)}
          className="h-11 rounded-xl bg-gray-950 px-6 text-sm font-semibold text-white transition hover:bg-gray-800 active:scale-[.98]"
        >
          Найти
        </button>
        <button
          type="button"
          onClick={load}
          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600 transition hover:border-gray-300 hover:bg-gray-50 hover:text-indigo-600"
          title="Обновить"
          aria-label="Обновить"
        >
          <svg className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15" />
          </svg>
        </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border border-gray-200/80 bg-white shadow-sm">
        <table className="min-w-[1120px] w-full border-separate border-spacing-0 text-sm">
          <thead className="text-left text-xs font-semibold text-gray-500">
            <tr>
              <th className="border-b border-gray-100 bg-gray-50/80 px-5 py-4">Заказ</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">Автомобиль</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">Клиент</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">Комментарий</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">Дата и время</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">Рабочая зона</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">Принял</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-4 py-4">Статус</th>
              <th className="border-b border-gray-100 bg-gray-50/80 px-5 py-4 text-right">Действия</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-14 text-center text-gray-500">
                  <span className="inline-flex items-center gap-2">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-gray-200 border-t-indigo-600" />
                    Загрузка заказ-нарядов…
                  </span>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-16 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-50 text-xl text-orange-500">
                    ✓
                  </div>
                  <p className="mt-3 font-semibold text-gray-900">Заказ-нарядов пока нет</p>
                  <p className="mt-1 text-sm text-gray-500">Создайте первый заказ-наряд для клиента</p>
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="group cursor-pointer transition-colors hover:bg-indigo-50/35"
                  onDoubleClick={(e) => {
                    if (
                      e.target.closest('.actions-dropdown')
                      || e.target.closest('.status-picker')
                    ) {
                      return;
                    }
                    setViewOrder(row);
                  }}
                >
                  <td className="border-b border-gray-100 px-5 py-4">
                    <span className="inline-flex min-w-11 items-center justify-center rounded-lg bg-gray-950 px-2.5 py-1.5 text-xs font-bold text-white">
                      № {row.order_number}
                    </span>
                  </td>
                  <td className="border-b border-gray-100 px-4 py-4 font-medium text-gray-900">{vehicleLabel(row.vehicle)}</td>
                  <td className="border-b border-gray-100 px-4 py-4">
                    <div className="font-medium text-gray-900">{row.client?.name || '—'}</div>
                    {row.client?.phone ? <div className="mt-0.5 text-xs text-gray-500">{row.client.phone}</div> : null}
                  </td>
                  <td className="max-w-[13rem] truncate border-b border-gray-100 px-4 py-4 text-gray-500" title={row.client_comment || ''}>
                    {row.client_comment || '—'}
                  </td>
                  <td className="whitespace-nowrap border-b border-gray-100 px-4 py-4 text-gray-700">
                    {formatDateTime(row.scheduled_at)}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-4 text-gray-600">
                    {row.work_zone?.name || '—'}
                  </td>
                  <td className="border-b border-gray-100 px-4 py-4 text-gray-600">{row.accepted_by?.name || '—'}</td>
                  <td className="border-b border-gray-100 px-4 py-4">
                    <StatusPicker
                      status={row.status}
                      options={statusActions}
                      saving={statusSavingId === row.id}
                      disabled={statusSavingId === row.id}
                      onChange={(nextStatus) => handleStatus(row.id, nextStatus)}
                    />
                  </td>
                  <td className="border-b border-gray-100 px-5 py-4 text-right">
                    <ActionsDropdown
                      menuClassName="w-44 z-50"
                      estimatedMenuHeight={120}
                      buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm transition hover:border-indigo-300 hover:text-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                    >
                      <ActionsDropdownItem
                        onClick={() => setViewOrder(row)}
                      >
                        Просмотр
                      </ActionsDropdownItem>
                      <ActionsDropdownItem
                        onClick={() => navigate(`/autoservice/orders/${row.id}/edit`)}
                      >
                        Изменить
                      </ActionsDropdownItem>
                    </ActionsDropdown>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <RepairOrderViewModal
        order={viewOrder}
        onClose={() => setViewOrder(null)}
        onEdit={(order) => {
          setViewOrder(null);
          navigate(`/autoservice/orders/${order.id}/edit`);
        }}
      />
    </div>
    </div>
  );
}
