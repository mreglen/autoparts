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
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {viewHistory ? 'История записей' : 'Записи на ремонт'}
          </h1>
          <p className="mt-1 text-sm text-gray-500">
            {viewHistory ? 'Завершённые и отменённые' : 'Текущие записи организации'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {viewHistory ? (
            <button
              type="button"
              onClick={() => setHistoryMode(false)}
              className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              К активным
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setHistoryMode(true)}
                className="rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                История записей
              </button>
              <button
                type="button"
                onClick={() => navigate('/autoservice/orders/new')}
                className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Добавить
              </button>
            </>
          )}
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-700">Поиск</label>
          <input
            className={inputClass}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Номер, клиент, авто, VIN, номер"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQApplied(q);
            }}
          />
        </div>
        {viewHistory && (
          <div>
            <label className="block text-sm font-medium text-gray-700">Статус</label>
            <select
              className={inputClass}
              value={historyStatus}
              onChange={(e) => setHistoryStatus(e.target.value)}
            >
              <option value="">Все</option>
              <option value="completed">Завершён</option>
              <option value="cancelled">Отменён</option>
            </select>
          </div>
        )}
        <button
          type="button"
          onClick={() => setQApplied(q)}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Найти
        </button>
        <button
          type="button"
          onClick={load}
          className="rounded-lg border border-gray-200 px-3 py-2.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Обновить
        </button>
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-6 overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Номер</th>
              <th className="px-4 py-3">Авто</th>
              <th className="px-4 py-3">Клиент</th>
              <th className="hidden px-4 py-3 md:table-cell">Комментарий</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Подъёмник</th>
              <th className="hidden px-4 py-3 sm:table-cell">Принял</th>
              <th className="px-4 py-3">Статус</th>
              <th className="px-4 py-3">Действия</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-8 text-center text-gray-500">
                  Записей пока нет
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer hover:bg-gray-50/80"
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
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {row.order_number}
                  </td>
                  <td className="px-4 py-3 text-gray-800">{vehicleLabel(row.vehicle)}</td>
                  <td className="px-4 py-3 text-gray-800">{row.client?.name || '—'}</td>
                  <td className="hidden max-w-[12rem] truncate px-4 py-3 text-gray-600 md:table-cell">
                    {row.client_comment || '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {formatDateTime(row.scheduled_at)}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {row.lift?.name || '—'}
                  </td>
                  <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">{row.accepted_by?.name || '—'}</td>
                  <td className="px-4 py-3">
                    <StatusPicker
                      status={row.status}
                      options={statusActions}
                      saving={statusSavingId === row.id}
                      disabled={statusSavingId === row.id}
                      onChange={(nextStatus) => handleStatus(row.id, nextStatus)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <ActionsDropdown menuClassName="w-44 z-50" estimatedMenuHeight={120}>
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
  );
}
