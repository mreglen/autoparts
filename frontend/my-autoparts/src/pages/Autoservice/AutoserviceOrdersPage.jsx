import { useCallback, useEffect, useMemo, useState, Fragment } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';

const inputClass =
  'mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const STATUS_LABELS = {
  accepted: 'Принят',
  in_progress: 'В работе',
  ready: 'Готов',
  issued: 'Выдан',
  cancelled: 'Отменён',
  // legacy (на случай непатченных данных)
  open: 'Принят',
  completed: 'Выдан',
};

const STATUS_STYLES = {
  accepted: 'bg-amber-50 text-amber-800 ring-amber-200',
  in_progress: 'bg-sky-50 text-sky-800 ring-sky-200',
  ready: 'bg-violet-50 text-violet-800 ring-violet-200',
  issued: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  cancelled: 'bg-gray-100 text-gray-600 ring-gray-200',
  open: 'bg-amber-50 text-amber-800 ring-amber-200',
  completed: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
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

function vehicleLabel(v) {
  if (!v) return '—';
  const parts = [v.make, v.model, v.year].filter(Boolean);
  const base = parts.join(' ') || 'Авто';
  if (v.plate) return `${base} (${v.plate})`;
  return base;
}

function StatusBadge({ status }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        STATUS_STYLES[status] || STATUS_STYLES.open
      }`}
    >
      {STATUS_LABELS[status] || status}
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
      {row.lift_number ? (
        <p>
          <span className="font-medium text-gray-900">Подъёмник:</span> №{row.lift_number}
        </p>
      ) : null}
      {row.staff_comment && showExecutors && (
        <p>
          <span className="font-medium text-gray-900">Комментарий сотрудника:</span> {row.staff_comment}
        </p>
      )}
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
                {showExecutors && <th className="py-1">Исполнитель</th>}
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
                  {showExecutors && <td className="py-1">{w.executor?.name || '—'}</td>}
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
                {showExecutors && <th className="py-1 pr-3">Цена</th>}
                {showExecutors && <th className="py-1 pr-3">Наценка %</th>}
                <th className="py-1 pr-3">Цена с наценкой</th>
                <th className="py-1 pr-3">Сумма</th>
                {showExecutors && <th className="py-1">Источник</th>}
              </tr>
            </thead>
            <tbody>
              {shop.map((p) => (
                <tr key={p.id || `${p.position}-${p.title}`}>
                  <td className="py-1 pr-3">{p.position}</td>
                  <td className="py-1 pr-3">{p.title}</td>
                  <td className="py-1 pr-3">{p.qty}</td>
                  {showExecutors && <td className="py-1 pr-3">{formatMoney(p.unit_price)}</td>}
                  {showExecutors && <td className="py-1 pr-3">{p.markup_percent}</td>}
                  <td className="py-1 pr-3">
                    {formatMoney(p.price_with_markup ?? priceWithMarkup(p.unit_price, p.markup_percent))}
                  </td>
                  <td className="py-1 pr-3">
                    {formatMoney(p.line_sum ?? shopLineSum(p.qty, p.unit_price, p.markup_percent))}
                  </td>
                  {showExecutors && <td className="py-1">{p.source || '—'}</td>}
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
  const [expandedId, setExpandedId] = useState(null);
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
    setExpandedId(null);
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
            { value: 'accepted', label: 'Вернуть: принят' },
            { value: 'in_progress', label: 'В работу' },
            { value: 'ready', label: 'Готов' },
          ]
        : [
            { value: 'accepted', label: 'Принят' },
            { value: 'in_progress', label: 'В работу' },
            { value: 'ready', label: 'Готов' },
            { value: 'issued', label: 'Выдан' },
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
              <option value="issued">Выдан</option>
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
                <Fragment key={row.id}>
                  <tr className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      <button
                        type="button"
                        className="text-left text-indigo-600 hover:underline"
                        onClick={() =>
                          setExpandedId((id) => (id === row.id ? null : row.id))
                        }
                      >
                        {row.order_number}
                      </button>
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
                      {row.lift_number != null ? `№${row.lift_number}` : '—'}
                    </td>
                    <td className="hidden px-4 py-3 text-gray-700 sm:table-cell">{row.accepted_by?.name || '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-left text-sm text-indigo-600 hover:underline"
                          onClick={() => navigate(`/autoservice/orders/${row.id}/edit`)}
                        >
                          Изменить
                        </button>
                        <select
                          className="rounded border border-gray-200 px-1.5 py-1 text-xs"
                          disabled={statusSavingId === row.id}
                          value=""
                          onChange={(e) => {
                            const v = e.target.value;
                            if (v) handleStatus(row.id, v);
                            e.target.value = '';
                          }}
                        >
                          <option value="">Статус…</option>
                          {statusActions
                            .filter((a) => a.value !== row.status)
                            .map((a) => (
                              <option key={a.value} value={a.value}>
                                {a.label}
                              </option>
                            ))}
                        </select>
                      </div>
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={9} className="bg-gray-50 px-4 py-4">
                        <OrderLinesExpand row={row} showExecutors />
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
