import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AutoserviceListRefreshButton from '../../components/Autoservice/AutoserviceListRefreshButton';
import SearchablePillSelect from '../../components/SearchablePillSelect/SearchablePillSelect';
import { Modal, Skeleton } from '../../components/UI';
import Toast from '../../components/UI/Toast';
import AutoserviceWarehouseItemMovements from '../../components/Autoservice/AutoserviceWarehouseItemMovements';
import RepairOrderViewModal from '../../components/Autoservice/RepairOrderViewModal';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
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
  autoserviceListTrClickableClass,
  warehousePillControlClass,
} from '../../utils/warehouseListUi';

const pillButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30';

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

export default function AutoserviceWarehouseExpensesPage({ embedded = false }) {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [supplierCustom, setSupplierCustom] = useState('');
  const [supplierDocs, setSupplierDocs] = useState([]);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewExpense, setViewExpense] = useState(null);
  const [viewExpenseMovements, setViewExpenseMovements] = useState(null);
  const [viewExpenseMovementsLoading, setViewExpenseMovementsLoading] = useState(false);
  const [viewExpenseMovementsError, setViewExpenseMovementsError] = useState('');
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [deleteSaving, setDeleteSaving] = useState(false);
  const [viewRepairOrder, setViewRepairOrder] = useState(null);
  const [viewRepairOrderLoading, setViewRepairOrderLoading] = useState(false);

  const supplierTerm = (supplierFilter || supplierCustom).trim();

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (supplierTerm) params.set('supplier', supplierTerm);
      const suffix = params.toString() ? `?${params.toString()}` : '';
      const expenses = await apiRequest(`/autoservice/warehouse/expenses${suffix}`);
      setRows(Array.isArray(expenses) ? expenses : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить расходы');
    } finally {
      setLoading(false);
    }
  }, [supplierTerm]);

  const loadSupplierDocs = useCallback(async () => {
    try {
      const docs = await apiRequest('/autoservice/warehouse/receipts');
      setSupplierDocs(Array.isArray(docs) ? docs : []);
    } catch {
      setSupplierDocs([]);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    if (!userHasAutoserviceOrganization(user)) return;
    loadData();
    loadSupplierDocs();
  }, [isReady, isAuthenticated, user, loadData, loadSupplierDocs]);

  useEffect(() => {
    const refreshPath = embedded
      ? '/autoservice/warehouse'
      : '/autoservice/warehouse/expenses';
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === refreshPath) {
        loadData();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadData, embedded]);

  useEffect(() => {
    if (!viewExpense?.item_id) {
      setViewExpenseMovements(null);
      setViewExpenseMovementsLoading(false);
      setViewExpenseMovementsError('');
      return undefined;
    }

    let cancelled = false;
    setViewExpenseMovementsLoading(true);
    setViewExpenseMovementsError('');
    apiRequest(`/autoservice/warehouse/items/${viewExpense.item_id}/movements`)
      .then((data) => {
        if (cancelled) return;
        setViewExpenseMovements(data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setViewExpenseMovements(null);
        setViewExpenseMovementsError(err?.message || 'Не удалось загрузить движения');
      })
      .finally(() => {
        if (!cancelled) setViewExpenseMovementsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [viewExpense?.item_id]);

  const supplierOptions = useMemo(() => {
    const names = new Map();
    supplierDocs.forEach((doc) => {
      const name = String(doc.supplier_name || '').trim();
      if (name) names.set(name.toLowerCase(), name);
    });
    return [...names.values()]
      .sort((a, b) => a.localeCompare(b, 'ru'))
      .map((name) => ({ value: name, label: name }));
  }, [supplierDocs]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return rows.filter((row) => {
      const day = String(row.created_at || '').slice(0, 10);
      if (dateFrom && day < dateFrom) return false;
      if (dateTo && day > dateTo) return false;
      if (!q) return true;
      return [row.brand, row.article, row.name, row.reason, row.creator_name]
        .some((value) => String(value || '').toLowerCase().includes(q));
    });
  }, [rows, searchQuery, dateFrom, dateTo]);

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
      {embedded ? null : (
        <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className={autoserviceListHeaderTitleClass}>Расходы</h1>
            <p className={autoserviceListHeaderSubtitleClass}>
              {loading ? 'Загрузка…' : `${filteredRows.length} списаний`}
            </p>
          </div>
        </div>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AutoserviceLiveSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск по товару или причине"
          ariaLabel="Поиск расходов"
        />
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          className={`${pillButtonClass} shrink-0 ${filtersOpen ? 'bg-white ring-2 ring-indigo-400/70' : ''}`}
          aria-expanded={filtersOpen}
        >
          Фильтры
          <svg
            className={`h-4 w-4 transition-transform ${filtersOpen ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
        <AutoserviceListRefreshButton loading={loading} onClick={loadData} />
      </div>

      {filtersOpen ? (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Период с</span>
            <input
              type="date"
              value={dateFrom}
              max={dateTo || undefined}
              onChange={(e) => setDateFrom(e.target.value)}
              className={warehousePillControlClass}
            />
          </label>
          <label className="block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Период по</span>
            <input
              type="date"
              value={dateTo}
              min={dateFrom || undefined}
              onChange={(e) => setDateTo(e.target.value)}
              className={warehousePillControlClass}
            />
          </label>
          <label className="col-span-2 block min-w-0">
            <span className="mb-1.5 block text-xs font-medium text-ink-muted">Поставщик</span>
            <SearchablePillSelect
              value={supplierFilter}
              onChange={setSupplierFilter}
              options={supplierOptions}
              placeholder="Все поставщики"
              emptyOptionLabel="Все поставщики"
              ariaLabel="Фильтр по поставщику"
              allowCustomValue
              customValue={supplierCustom}
              onCustomValueChange={setSupplierCustom}
            />
          </label>
        </div>
      ) : null}

      <Toast message={error} variant="error" onClose={() => setError('')} />

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
        draggable
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
            <AutoserviceWarehouseItemMovements
              movements={viewExpenseMovements}
              loading={viewExpenseMovementsLoading}
              error={viewExpenseMovementsError}
              showExpenses={false}
            />
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
        wrapperZIndex="var(--sg-z-modal-elevated-shell)"
        onClose={() => setViewRepairOrder(null)}
        onOrderChange={(updated) => setViewRepairOrder(updated)}
      />
    </div>
  );
}
