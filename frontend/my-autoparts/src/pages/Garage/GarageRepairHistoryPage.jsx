import { useCallback, useEffect, useState, Fragment } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';
import { selectIsAutoserviceClient } from '../../redux/slices/AutoserviceClientSlice';

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

function LineTable({ title, columns, rows, renderRow, emptyText }) {
  return (
    <div>
      <p className="font-medium text-gray-900">{title}</p>
      {rows.length === 0 ? (
        <p className="mt-1 text-gray-500">{emptyText}</p>
      ) : (
        <table className="mt-2 min-w-full text-left text-xs">
          <thead className="text-gray-500">
            <tr>
              {columns.map((col) => (
                <th key={col} className="py-1 pr-3">
                  {col}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows.map(renderRow)}</tbody>
        </table>
      )}
    </div>
  );
}

export default function GarageRepairHistoryPage() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const isClient = useSelector(selectIsAutoserviceClient);
  const clientStatus = useSelector((state) => state.autoserviceClient.status);

  const [scope, setScope] = useState('all');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);
  const [details, setDetails] = useState({});

  useEffect(() => {
    if (isReady && isAuthenticated && clientStatus === 'succeeded' && !isClient) {
      navigate('/autoservice/welcome', { replace: true });
    }
  }, [isReady, isAuthenticated, clientStatus, isClient, navigate]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/repair-orders/me?scope=${scope}`);
      setRows(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить ремонты');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [scope]);

  useEffect(() => {
    if (isReady && isAuthenticated && isClient) loadOrders();
  }, [isReady, isAuthenticated, isClient, loadOrders]);

  const toggleRow = async (row) => {
    if (expandedId === row.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(row.id);
    if (details[row.id]) return;
    try {
      const data = await apiRequest(`/autoservice/repair-orders/me/${row.id}`);
      setDetails((prev) => ({ ...prev, [row.id]: data }));
    } catch {
      setDetails((prev) => ({ ...prev, [row.id]: row }));
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">История ремонтов</h1>
        <Link to="/garage" className="text-sm text-indigo-600 hover:underline">
          Мои авто
        </Link>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {[
          { id: 'all', label: 'Все' },
          { id: 'active', label: 'Активные' },
          { id: 'history', label: 'Завершённые' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setScope(tab.id)}
            className={`rounded-lg px-3 py-2 text-sm ${
              scope === tab.id
                ? 'bg-indigo-600 text-white'
                : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200 bg-white">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
            <tr>
              <th className="px-4 py-3">Номер</th>
              <th className="px-4 py-3">Авто</th>
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Сумма</th>
              <th className="px-4 py-3">Статус</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Загрузка…
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
                  Ремонтов пока нет
                </td>
              </tr>
            ) : (
              rows.map((row) => {
                const detail = details[row.id] || row;
                return (
                  <Fragment key={row.id}>
                    <tr className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium">
                        <button
                          type="button"
                          className="text-left text-indigo-600 hover:underline"
                          onClick={() => toggleRow(row)}
                        >
                          {row.order_number}
                        </button>
                      </td>
                      <td className="px-4 py-3 text-gray-800">{vehicleLabel(row.vehicle)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {formatServerDateTime(row.scheduled_at)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                        {formatMoney(row.grand_total)} ₽
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={row.status} />
                      </td>
                    </tr>
                    {expandedId === row.id && (
                      <tr>
                        <td colSpan={5} className="bg-gray-50 px-4 py-4 text-sm text-gray-700">
                          <div className="space-y-4">
                            {detail.client_comment && (
                              <p>
                                <span className="font-medium text-gray-900">Комментарий:</span>{' '}
                                {detail.client_comment}
                              </p>
                            )}
                            <LineTable
                              title="Работы"
                              emptyText="Нет работ"
                              columns={['№', 'Название', 'Кол-во', 'Цена', 'Сумма']}
                              rows={detail.works || []}
                              renderRow={(w) => (
                                <tr key={w.id || `${w.position}-${w.title}`}>
                                  <td className="py-1 pr-3">{w.position}</td>
                                  <td className="py-1 pr-3">{w.title}</td>
                                  <td className="py-1 pr-3">{w.qty}</td>
                                  <td className="py-1 pr-3">{formatMoney(w.unit_price)}</td>
                                  <td className="py-1">{formatMoney(w.line_sum)}</td>
                                </tr>
                              )}
                            />
                            <LineTable
                              title="Запчасти клиента"
                              emptyText="Нет запчастей клиента"
                              columns={['№', 'Название', 'Кол-во']}
                              rows={detail.client_parts || []}
                              renderRow={(p) => (
                                <tr key={p.id || `${p.position}-${p.title}`}>
                                  <td className="py-1 pr-3">{p.position}</td>
                                  <td className="py-1 pr-3">{p.title}</td>
                                  <td className="py-1">{p.qty}</td>
                                </tr>
                              )}
                            />
                            <LineTable
                              title="Запчасти автосервиса"
                              emptyText="Нет запчастей автосервиса"
                              columns={['№', 'Название', 'Кол-во', 'Цена', 'Сумма']}
                              rows={detail.shop_parts || []}
                              renderRow={(p) => (
                                <tr key={p.id || `${p.position}-${p.title}`}>
                                  <td className="py-1 pr-3">{p.position}</td>
                                  <td className="py-1 pr-3">{p.title}</td>
                                  <td className="py-1 pr-3">{p.qty}</td>
                                  <td className="py-1 pr-3">{formatMoney(p.price_with_markup)}</td>
                                  <td className="py-1">{formatMoney(p.line_sum)}</td>
                                </tr>
                              )}
                            />
                            <p className="font-semibold text-gray-900">
                              Итого: {formatMoney(detail.grand_total)} ₽
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
