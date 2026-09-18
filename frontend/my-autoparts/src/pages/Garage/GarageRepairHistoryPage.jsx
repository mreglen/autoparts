import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import RepairOrderViewModal, {
  OrderStatusBadge,
  vehicleLabel,
} from '../../components/Autoservice/RepairOrderViewModal';
import { UnderlineTabs } from '../../components/UI';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';
import { selectIsAutoserviceClient } from '../../redux/slices/AutoserviceClientSlice';
import {
  autoserviceListMobileWrapClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListThClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
} from '../../utils/warehouseListUi';

const pillControlClass =
  'h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0';

const btnGhost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50';

function formatMoney(value) {
  const n = Number(value);
  if (Number.isNaN(n)) return '0,00';
  return n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function RepairMobileCard({ row, onView }) {
  return (
    <button
      type="button"
      onClick={onView}
      className="w-full border-b border-line-soft py-2 text-left last:border-b-0"
    >
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-medium text-ink">№ {row.order_number}</span>
        <OrderStatusBadge status={row.status} />
      </div>
      <p className="mt-0.5 truncate text-ink-soft">{vehicleLabel(row.vehicle)}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {formatServerDateTime(row.scheduled_at)} · {formatMoney(row.grand_total)} ₽
      </p>
    </button>
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
  const [q, setQ] = useState('');
  const [qApplied, setQApplied] = useState('');
  const [viewOrder, setViewOrder] = useState(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [detailsCache, setDetailsCache] = useState({});

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

  const filteredRows = useMemo(() => {
    const query = qApplied.trim().toLowerCase();
    if (!query) return rows;
    return rows.filter((row) => {
      const hay = [
        row.order_number,
        vehicleLabel(row.vehicle),
        row.vehicle?.vin,
        row.vehicle?.plate,
        row.status,
        row.client_comment,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(query);
    });
  }, [rows, qApplied]);

  const openDetails = async (row) => {
    setViewOrder(detailsCache[row.id] || row);
    if (detailsCache[row.id]) return;
    setViewLoading(true);
    try {
      const data = await apiRequest(`/autoservice/repair-orders/me/${row.id}`);
      setDetailsCache((prev) => ({ ...prev, [row.id]: data }));
      setViewOrder(data);
    } catch {
      setDetailsCache((prev) => ({ ...prev, [row.id]: row }));
      setViewOrder(row);
    } finally {
      setViewLoading(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;

  if (clientStatus === 'loading' || clientStatus === 'idle') {
    return <p className="py-12 text-center text-sm text-gray-500">Загрузка…</p>;
  }

  return (
    <div className="w-full min-w-0">
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">История ремонтов</h1>
          <p className="mt-0.5 text-sm text-gray-500">
            {loading
              ? 'Загрузка…'
              : qApplied.trim()
                ? `${filteredRows.length} из ${rows.length}`
                : `${rows.length} заказов`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Link to="/autoservice/repair-booking" className={btnGhost}>
            Запись на ремонт
          </Link>
          <button
            type="button"
            onClick={loadOrders}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-600 transition hover:bg-gray-200 hover:text-gray-900"
            title="Обновить"
            aria-label="Обновить"
          >
            <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 0 0 4.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 0 1-15.357-2m15.357 2H15"
              />
            </svg>
          </button>
        </div>
      </div>

      <UnderlineTabs
        className="mb-4"
        ariaLabel="Фильтр истории ремонтов"
        gapClassName="gap-4"
        tabs={[
          { id: 'all', label: 'Все' },
          { id: 'active', label: 'Активные' },
          { id: 'history', label: 'Завершённые' },
        ]}
        value={scope}
        onChange={(id) => {
          setScope(id);
          setViewOrder(null);
        }}
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative min-w-0 flex-1">
          <input
            className={`${pillControlClass} pr-10`}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Номер, авто, VIN или госномер"
            onKeyDown={(e) => {
              if (e.key === 'Enter') setQApplied(q);
            }}
            aria-label="Поиск ремонтов"
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
        <button
          type="button"
          onClick={() => setQApplied(q)}
          className="inline-flex h-10 shrink-0 items-center justify-center rounded-full bg-gray-900 px-5 text-sm font-medium text-white transition hover:bg-gray-800"
        >
          Найти
        </button>
      </div>

      {error ? (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <div className={autoserviceListTableWrapClass}>
        <div className="overflow-x-auto">
          <table className={autoserviceListTableClass}>
            <thead>
              <tr className={autoserviceListTheadRowClass}>
                <th className={`w-28 ${autoserviceListThClass}`}>Заказ</th>
                <th className={autoserviceListThClass}>Автомобиль</th>
                <th className={`w-40 ${autoserviceListThClass}`}>Дата</th>
                <th className={`w-28 ${autoserviceListThClass}`}>Сумма</th>
                <th className={`w-32 ${autoserviceListThClass}`}>Статус</th>
              </tr>
            </thead>
            <tbody className={autoserviceListTbodyClass}>
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-ink-muted">
                    Загрузка…
                  </td>
                </tr>
              ) : filteredRows.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-ink-muted">
                    {rows.length === 0 ? 'Ремонтов пока нет' : 'Ничего не найдено'}
                  </td>
                </tr>
              ) : (
                filteredRows.map((row) => (
                  <tr
                    key={row.id}
                    className={autoserviceListTrClickableClass}
                    onClick={() => openDetails(row)}
                  >
                    <td className={autoserviceListTdClass}>
                      <span className="font-semibold tabular-nums text-ink">№ {row.order_number}</span>
                    </td>
                    <td className={`truncate font-medium text-ink ${autoserviceListTdClass}`}>
                      {vehicleLabel(row.vehicle)}
                    </td>
                    <td className={`whitespace-nowrap text-ink-soft ${autoserviceListTdClass}`}>
                      {formatServerDateTime(row.scheduled_at)}
                    </td>
                    <td className={`whitespace-nowrap tabular-nums text-ink-soft ${autoserviceListTdClass}`}>
                      {formatMoney(row.grand_total)} ₽
                    </td>
                    <td className={autoserviceListTdClass}>
                      <OrderStatusBadge status={row.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={autoserviceListMobileWrapClass}>
        {loading ? (
          <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">
            {rows.length === 0 ? 'Ремонтов пока нет' : 'Ничего не найдено'}
          </p>
        ) : (
          filteredRows.map((row) => (
            <RepairMobileCard key={row.id} row={row} onView={() => openDetails(row)} />
          ))
        )}
      </div>

      <RepairOrderViewModal
        order={viewOrder}
        loading={viewLoading && !viewOrder?.works}
        onClose={() => setViewOrder(null)}
        showExecutors={false}
      />
    </div>
  );
}
