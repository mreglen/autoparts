import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AutoserviceListRefreshButton from '../../components/Autoservice/AutoserviceListRefreshButton';
import { Modal, Skeleton } from '../../components/UI';
import RepairOrderViewModal from '../../components/Autoservice/RepairOrderViewModal';
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
  autoserviceListTrClickableClass,
} from '../../utils/warehouseListUi';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function ExpenseMobileCard({ row, onClick }) {
  return (
    <div
      className="cursor-pointer border-b border-line-soft py-2 last:border-b-0 transition hover:bg-surface-muted/70"
      onClick={() => onClick?.(row)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{row.name || '—'}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {[row.brand, row.article].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            {formatDate(row.created_at)}
            {row.reason ? ` · ${row.reason}` : ''}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="tabular-nums text-sm font-semibold text-ink">{row.quantity} шт.</p>
          <p className="mt-0.5 tabular-nums text-xs text-ink-muted">
            {formatAutoserviceWarehouseMoney(row.client_unit_price)}
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
  const [viewExpense, setViewExpense] = useState(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [viewRepairOrder, setViewRepairOrder] = useState(null);
  const [viewRepairOrderLoading, setViewRepairOrderLoading] = useState(false);

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

  const handleDelete = useCallback(async () => {
    if (!viewExpense) return;
    setDeleteSaving(true);
    setError('');
    try {
      await apiRequest(`/autoservice/warehouse/expenses/${viewExpense.id}`, { method: 'DELETE' });
      setDeleteConfirmOpen(false);
      setViewExpense(null);
      await loadData();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить списание');
    } finally {
      setDeleteSaving(false);
    }
  }, [viewExpense, loadData]);

  const openRepairOrder = useCallback(async (orderId) => {
    if (!orderId) return;
    setViewRepairOrderLoading(true);
    try {
      const order = await apiRequest(`/autoservice/repair-orders/${orderId}`);
      setViewRepairOrder(order);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить заказ-наряд');
    } finally {
      setViewRepairOrderLoading(false);
    }
  }, []);

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
              <th className={`min-w-0 ${autoserviceListThClass}`}>Наименование</th>
              <th className={`w-20 whitespace-nowrap ${autoserviceListThRightClass}`}>Кол-во</th>
              <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Цена</th>
              <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Сумма</th>
              <th className={`w-40 pl-3 text-center ${autoserviceListThClass}`}>Документ</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`sk-${index}`}>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-24" /></td>
                  <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-36" /></td>
                  <td className={`w-20 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-10" /></td>
                  <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-16" /></td>
                  <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-16" /></td>
                  <td className={`w-40 pl-3 ${autoserviceListTdClass} truncate text-center`}><Skeleton className="mx-auto h-4 w-20" /></td>
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-12 text-center text-ink-muted">
                  Расходов пока нет
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={autoserviceListTrClickableClass}
                  onClick={() => setViewExpense(row)}
                >
                  <td className={`${autoserviceListTdClass} whitespace-nowrap text-ink-muted`}>{formatDate(row.created_at)}</td>
                  <td className={`min-w-0 ${autoserviceListTdClass}`}>
                    <div className="w-0 min-w-full truncate font-semibold text-ink">{row.name || '—'}</div>
                  </td>
                  <td className={`w-20 whitespace-nowrap text-ink-muted ${autoserviceListTdRightClass} tabular-nums`}>{row.quantity} шт.</td>
                  <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums`}>
                    {formatAutoserviceWarehouseMoney(row.client_unit_price)}
                  </td>
                  <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums font-semibold`}>
                    {formatAutoserviceWarehouseMoney(Number(row.client_unit_price || 0) * Number(row.quantity || 0))}
                  </td>
                  <td className={`w-40 pl-3 ${autoserviceListTdClass} truncate text-center`}>
                    {row.repair_order_id ? (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          openRepairOrder(row.repair_order_id);
                        }}
                        className="cursor-pointer text-xs font-medium text-brand-600 hover:underline bg-transparent border-0 p-0"
                      >
                        Заказ-наряд {row.repair_order_number}
                      </button>
                    ) : (
                      <span className="text-xs">{row.reason || '—'}</span>
                    )}
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
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`msk-${index}`} className="border-b border-line-soft py-2 last:border-b-0">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-1 h-3 w-24" />
              </div>
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Расходов пока нет</p>
        ) : (
          filteredRows.map((row) => <ExpenseMobileCard key={row.id} row={row} onClick={setViewExpense} />)
        )}
      </div>

      <Modal
        open={Boolean(viewExpense)}
        onClose={() => {
          if (!deleteSaving) {
            setViewExpense(null);
            setDeleteConfirmOpen(false);
          }
        }}
        title={viewExpense ? `Списание · ${viewExpense.name || '—'}` : 'Списание'}
        size="sm"
      >
        {viewExpense ? (
          <div className="space-y-3 text-sm">
            <div className="grid grid-cols-2 gap-3">
              <p>
                <span className="text-ink-muted">Дата:</span>{' '}
                <span className="text-ink">{formatDate(viewExpense.created_at)}</span>
              </p>
              <p>
                <span className="text-ink-muted">Кол-во:</span>{' '}
                <span className="text-ink">{viewExpense.quantity} шт.</span>
              </p>
              <p>
                <span className="text-ink-muted">Цена:</span>{' '}
                <span className="text-ink">{formatAutoserviceWarehouseMoney(viewExpense.client_unit_price)}</span>
              </p>
              <p>
                <span className="text-ink-muted">Сумма:</span>{' '}
                <span className="text-ink font-semibold tabular-nums">
                  {formatAutoserviceWarehouseMoney(Number(viewExpense.client_unit_price ?? 0) * Number(viewExpense.quantity ?? 0))}
                </span>
              </p>
            </div>
            <p>
              <span className="text-ink-muted">Бренд:</span>{' '}
              <span className="text-ink">{viewExpense.brand || '—'}</span>
            </p>
            <p>
              <span className="text-ink-muted">Артикул:</span>{' '}
              <span className="text-ink">{viewExpense.article || '—'}</span>
            </p>
            <p>
              <span className="text-ink-muted">Документ:</span>{' '}
              {viewExpense.repair_order_id ? (
                <button
                  type="button"
                  onClick={() => openRepairOrder(viewExpense.repair_order_id)}
                  className="cursor-pointer font-medium text-brand-600 transition hover:underline"
                >
                  Заказ-наряд {viewExpense.repair_order_number}
                </button>
              ) : (
                <span className="text-ink">{viewExpense.reason || '—'}</span>
              )}
            </p>
            <p>
              <span className="text-ink-muted">Создал:</span>{' '}
              <span className="text-ink">{viewExpense.creator_name || '—'}</span>
            </p>
            <div className="flex flex-wrap justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setViewExpense(null)}
                disabled={deleteSaving}
                className="inline-flex h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 md:h-10"
              >
                Закрыть
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmOpen(true)}
                disabled={deleteSaving}
                className="inline-flex h-11 items-center justify-center rounded-sg-sm bg-danger-600 px-4 text-sm font-semibold text-white transition hover:bg-danger-700 disabled:opacity-60 md:h-10"
              >
                Удалить
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={deleteConfirmOpen}
        onClose={() => {
          if (!deleteSaving) setDeleteConfirmOpen(false);
        }}
        title="Подтверждение"
        size="sm"
        wrapperClassName="z-[130]"
      >
        <div className="space-y-4">
          <p className="text-sm text-ink">Точно удалить списание?</p>
          <div className="flex flex-wrap justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteConfirmOpen(false)}
              disabled={deleteSaving}
              className="inline-flex h-11 items-center justify-center rounded-sg-sm border border-line-strong bg-surface px-4 text-sm font-medium text-ink-soft transition hover:bg-surface-muted disabled:opacity-60 md:h-10"
            >
              Нет, оставить
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleteSaving}
              className="inline-flex h-11 items-center justify-center rounded-sg-sm bg-danger-600 px-4 text-sm font-semibold text-white transition hover:bg-danger-700 disabled:opacity-60 md:h-10"
            >
              {deleteSaving ? 'Удаление…' : 'Да, удалить'}
            </button>
          </div>
        </div>
      </Modal>

      <RepairOrderViewModal
        order={viewRepairOrder}
        loading={viewRepairOrderLoading}
        enablePayment
        onClose={() => setViewRepairOrder(null)}
        onOrderChange={(updated) => setViewRepairOrder(updated)}
      />
    </div>
  );
}
