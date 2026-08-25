import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AutoserviceListRefreshButton from '../../components/Autoservice/AutoserviceListRefreshButton';
import { Skeleton } from '../../components/UI';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListErrorClass,
  autoserviceListHeaderSubtitleClass,
  autoserviceListHeaderTitleClass,
  autoserviceListMobileWrapClass,
  autoserviceListPageClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClass,
} from '../../utils/warehouseListUi';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function ExpenseMobileCard({ row }) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">{row.name || '—'}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {[row.brand, row.article].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            {formatDate(row.created_at)}
            {row.reason ? ` · ${row.reason}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-sm font-semibold text-gray-900">{row.quantity} шт.</p>
          <p className="mt-0.5 tabular-nums text-xs text-gray-600">
            {formatAutoserviceWarehouseMoney(row.unit_price)}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function AutoserviceWarehouseExpensesPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const expenses = await apiRequest('/autoservice/warehouse/expenses');
      setRows(Array.isArray(expenses) ? expenses : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить расходы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    if (!userHasAutoserviceOrganization(user)) return;
    loadData();
  }, [isReady, isAuthenticated, user, loadData]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/warehouse/expenses') {
        loadData();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadData]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.brand, row.article, row.name, row.reason, row.creator_name]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [rows, searchQuery]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !userHasAutoserviceOrganization(user)) return null;

  return (
    <div className={autoserviceListPageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={autoserviceListHeaderTitleClass}>Расходы</h1>
          <p className={autoserviceListHeaderSubtitleClass}>
            {loading ? 'Загрузка…' : `${filteredRows.length} списаний`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AutoserviceLiveSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск по товару или причине"
          ariaLabel="Поиск расходов"
        />
        <AutoserviceListRefreshButton loading={loading} onClick={loadData} />
      </div>

      {error ? (
        <p className={autoserviceListErrorClass} role="alert">
          {error}
        </p>
      ) : null}

      <div className={autoserviceListTableWrapClass}>
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`w-28 ${autoserviceListThClass}`}>Дата</th>
              <th className={`w-24 ${autoserviceListThClass}`}>Бренд</th>
              <th className={`w-28 ${autoserviceListThClass}`}>Артикул</th>
              <th className={autoserviceListThClass}>Наименование</th>
              <th className={autoserviceListThRightClass}>Кол-во</th>
              <th className={autoserviceListThRightClass}>Цена</th>
              <th className={autoserviceListThClass}>Причина</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`sk-${index}`}>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-24" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-16" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-36" /></td>
                  <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-12" /></td>
                  <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-16" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-28" /></td>
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={7} className="py-12 text-center text-gray-500">
                  Расходов пока нет
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr key={row.id} className={autoserviceListTrClass}>
                  <td className={`${autoserviceListTdClass} whitespace-nowrap`}>{formatDate(row.created_at)}</td>
                  <td className={`${autoserviceListTdClass} font-medium`}>{row.brand || '—'}</td>
                  <td className={`${autoserviceListTdClass} font-mono text-gray-600`}>{row.article || '—'}</td>
                  <td className={autoserviceListTdClass}>{row.name || '—'}</td>
                  <td className={`${autoserviceListTdRightClass} tabular-nums`}>{row.quantity} шт.</td>
                  <td className={`${autoserviceListTdRightClass} tabular-nums font-semibold`}>
                    {formatAutoserviceWarehouseMoney(row.unit_price)}
                  </td>
                  <td className={`${autoserviceListTdClass} text-gray-600`}>{row.reason || '—'}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={autoserviceListMobileWrapClass}>
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`msk-${index}`} className="py-3">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-24" />
              </div>
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Расходов пока нет</p>
        ) : (
          filteredRows.map((row) => <ExpenseMobileCard key={row.id} row={row} />)
        )}
      </div>
    </div>
  );
}
