import { useCallback, useEffect, useState, Fragment } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { AUTOSERVICE_PUBLIC_NAME } from '../../utils/autoserviceConstants';
import { BECOME_CLIENT_CONFIRM } from '../../utils/autoservicePublic';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';

const STATUS_LABELS = {
  accepted: 'Принят',
  in_progress: 'В работе',
  ready: 'Готов',
  issued: 'Выдан',
  cancelled: 'Отменён',
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

function vehicleLabel(v) {
  if (!v) return '—';
  const parts = [v.make, v.model, v.year].filter(Boolean);
  const base = parts.join(' ') || 'Авто';
  if (v.plate) return `${base} (${v.plate})`;
  return base;
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

export default function GarageOrdersPage() {
  const { isReady, isAuthenticated } = useAuthReady();
  const token = useSelector((state) => state.auth.token);
  const [meLoading, setMeLoading] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [becomeSaving, setBecomeSaving] = useState(false);
  const [becomeError, setBecomeError] = useState(null);
  const [scope, setScope] = useState('active');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const loadMe = useCallback(async () => {
    setMeLoading(true);
    try {
      const data = await apiRequest('/autoservice/clients/me');
      setIsClient(Boolean(data?.is_client));
    } catch {
      setIsClient(false);
    } finally {
      setMeLoading(false);
    }
  }, []);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/repair-orders/me?scope=${scope}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить записи');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (isReady && isAuthenticated) loadMe();
  }, [isReady, isAuthenticated, loadMe]);

  useEffect(() => {
    if (isReady && isAuthenticated && isClient) loadOrders();
  }, [isReady, isAuthenticated, isClient, loadOrders]);

  const handleBecomeClient = async () => {
    if (!window.confirm(BECOME_CLIENT_CONFIRM(AUTOSERVICE_PUBLIC_NAME))) return;
    setBecomeSaving(true);
    setBecomeError(null);
    try {
      await apiRequest('/autoservice/clients/me', { method: 'POST' });
      setIsClient(true);
    } catch (err) {
      setBecomeError(err?.message || 'Не удалось стать клиентом');
    } finally {
      setBecomeSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  if (meLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-gray-500">Загрузка…</div>
    );
  }

  if (!isClient) {
    return (
      <div className="mx-auto max-w-xl px-4 py-10">
        <h1 className="text-2xl font-bold text-gray-900">Мои записи</h1>
        <p className="mt-3 text-sm text-gray-600">
          Записи на ремонт доступны клиентам автосервиса {AUTOSERVICE_PUBLIC_NAME}.
        </p>
        {becomeError && (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {becomeError}
          </p>
        )}
        <button
          type="button"
          disabled={becomeSaving || !token}
          onClick={handleBecomeClient}
          className="mt-6 inline-flex rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
        >
          {becomeSaving ? 'Отправка…' : 'Стать клиентом автосервиса'}
        </button>
        <p className="mt-4 text-sm">
          <Link to="/garage" className="text-indigo-600 hover:underline">
            ← В гараж
          </Link>
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Мои записи</h1>
          <p className="mt-1 text-sm text-gray-500">Записи на ремонт в автосервисе</p>
        </div>
        <Link to="/garage" className="text-sm text-indigo-600 hover:underline">
          ← В гараж
        </Link>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setScope('active')}
          className={`rounded-lg px-3 py-2 text-sm ${
            scope === 'active'
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          Активные
        </button>
        <button
          type="button"
          onClick={() => setScope('history')}
          className={`rounded-lg px-3 py-2 text-sm ${
            scope === 'history'
              ? 'bg-indigo-600 text-white'
              : 'border border-gray-200 text-gray-700 hover:bg-gray-50'
          }`}
        >
          История
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
              <th className="hidden px-4 py-3 sm:table-cell">Комментарий</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Подъёмник</th>
              <th className="px-4 py-3">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
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
                    <td className="hidden max-w-[14rem] truncate px-4 py-3 text-gray-600 sm:table-cell">
                      {row.client_comment || '—'}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatDateTime(row.scheduled_at)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {row.lift_number != null ? `№${row.lift_number}` : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={row.status} />
                    </td>
                  </tr>
                  {expandedId === row.id && (
                    <tr>
                      <td colSpan={6} className="bg-gray-50 px-4 py-4 text-sm text-gray-700">
                        <div className="space-y-4">
                          {row.lift_number != null && (
                            <p>
                              <span className="font-medium text-gray-900">Подъёмник:</span> №
                              {row.lift_number}
                            </p>
                          )}
                          {row.client_comment && (
                            <p className="sm:hidden">
                              <span className="font-medium text-gray-900">Комментарий:</span>{' '}
                              {row.client_comment}
                            </p>
                          )}
                          <div>
                            <p className="font-medium text-gray-900">Работы</p>
                            {(row.works || []).length === 0 ? (
                              <p className="mt-1 text-gray-500">Нет работ</p>
                            ) : (
                              <table className="mt-2 min-w-full text-left text-xs">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="py-1 pr-3">№</th>
                                    <th className="py-1 pr-3">Название</th>
                                    <th className="py-1 pr-3">Кол-во</th>
                                    <th className="py-1 pr-3">Цена</th>
                                    <th className="py-1">Сумма</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.works || []).map((w) => (
                                    <tr key={w.id || `${w.position}-${w.title}`}>
                                      <td className="py-1 pr-3">{w.position}</td>
                                      <td className="py-1 pr-3">{w.title}</td>
                                      <td className="py-1 pr-3">{w.qty}</td>
                                      <td className="py-1 pr-3">{formatMoney(w.unit_price)}</td>
                                      <td className="py-1">
                                        {formatMoney(w.line_sum ?? lineSum(w.qty, w.unit_price))}
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <p className="mt-2 font-medium text-gray-900">
                              Итого работ:{' '}
                              {formatMoney(
                                row.works_total
                                  ?? (row.works || []).reduce(
                                    (s, w) => s + lineSum(w.qty, w.unit_price),
                                    0,
                                  ),
                              )}{' '}
                              ₽
                            </p>
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">Запчасти клиента</p>
                            {(row.client_parts || []).length === 0 ? (
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
                                  {(row.client_parts || []).map((p) => (
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
                            {(row.shop_parts || []).length === 0 ? (
                              <p className="mt-1 text-gray-500">Нет запчастей исполнителя</p>
                            ) : (
                              <table className="mt-2 min-w-full text-left text-xs">
                                <thead className="text-gray-500">
                                  <tr>
                                    <th className="py-1 pr-3">№</th>
                                    <th className="py-1 pr-3">Название</th>
                                    <th className="py-1 pr-3">Кол-во</th>
                                    <th className="py-1 pr-3">Цена</th>
                                    <th className="py-1">Сумма</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {(row.shop_parts || []).map((p) => (
                                    <tr key={p.id || `${p.position}-${p.title}`}>
                                      <td className="py-1 pr-3">{p.position}</td>
                                      <td className="py-1 pr-3">{p.title}</td>
                                      <td className="py-1 pr-3">{p.qty}</td>
                                      <td className="py-1 pr-3">{formatMoney(p.price_with_markup)}</td>
                                      <td className="py-1">{formatMoney(p.line_sum)}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                            <p className="mt-2 font-medium text-gray-900">
                              Итого ЗЧ исполнителя:{' '}
                              {formatMoney(
                                row.shop_parts_total
                                  ?? (row.shop_parts || []).reduce(
                                    (s, p) => s + (Number(p.line_sum) || 0),
                                    0,
                                  ),
                              )}{' '}
                              ₽
                            </p>
                            <p className="mt-1 font-semibold text-gray-900">
                              Итого заказ:{' '}
                              {formatMoney(
                                row.grand_total
                                  ?? (
                                    Number(row.works_total || 0)
                                    + Number(row.shop_parts_total || 0)
                                  ),
                              )}{' '}
                              ₽
                            </p>
                          </div>
                        </div>
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
