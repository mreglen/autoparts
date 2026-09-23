import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ClientMarkupPopover from '../../components/NewParts/ClientMarkupPopover';

import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AutoserviceListRefreshButton from '../../components/Autoservice/AutoserviceListRefreshButton';
import Modal from '../../components/UI/Modal';
import Button from '../../components/UI/Button';
import { NumericInput, Skeleton, UnderlineTabs } from '../../components/UI';
import RepairOrderPickerModal from '../../components/Autoservice/RepairOrderPickerModal';
import RepairOrderViewModal from '../../components/Autoservice/RepairOrderViewModal';
import AutoserviceWarehouseAddModal from '../../components/Autoservice/AutoserviceWarehouseAddModal';
import AutoserviceWarehouseItemMovements from '../../components/Autoservice/AutoserviceWarehouseItemMovements';
import AutoserviceWarehouseReturnModal from '../../components/Autoservice/AutoserviceWarehouseReturnModal';
import AutoserviceWarehouseReceiptsPage from './AutoserviceWarehouseReceiptsPage';
import AutoserviceWarehouseExpensesPage from './AutoserviceWarehouseExpensesPage';
import SearchablePillSelect from '../../components/SearchablePillSelect/SearchablePillSelect';
import { useAuthReady } from '../../hooks/useAuthReady';
import useNewPartsMarkupPercent from '../../hooks/useNewPartsMarkupPercent';
import { canUseClientMarkup } from '../../utils/clientMarkupUtils';
import { canEditClientMarkupSettings } from '../../utils/autoservicePermissions';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import {
  autoserviceWarehouseClientPrice,
  autoserviceWarehouseItemLabel,
  formatAutoserviceWarehouseMoney,
  formatAutoserviceWarehouseQty,
  matchesAutoserviceWarehouseSearch,
} from '../../utils/autoserviceWarehouseUi';
import { formatShopPartUnit, formatShopPartQty } from '../../utils/repairOrderShopPartUtils';
import { repairOrderNumberLabel } from '../../utils/autoserviceOrderDisplay';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListErrorClass,
  autoserviceListHeaderSubtitleClass,
  autoserviceListHeaderTitleClass,
  autoserviceListMobileWrapClass,
  autoserviceListPageClass,
  autoserviceListPrimaryButtonClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
  warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

const pillButtonClass =
  'inline-flex h-10 items-center justify-center gap-1.5 rounded-full bg-gray-100 px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30';

const REPAIR_ORDER_STATUS_LABELS = {
  review: 'На проверке',
  pending: 'Ожидание',
  accepted: 'Принят',
  open: 'Открыт',
  in_progress: 'В работе',
  done: 'Выполнен',
  completed: 'Завершён',
  cancelled: 'Отменён',
};

function formatReservationQty(qty, unit = 'pcs') {
  return `${formatShopPartQty(qty, unit)} ${formatShopPartUnit(unit)}`;
}

function WarehouseItemMobileCard({
  item,
  displayPrice,
  onOpen,
}) {
  return (
    <button type="button" onClick={onOpen} className="w-full border-b border-line-soft py-2 text-left last:border-b-0">
      <p className="truncate font-medium text-ink">{item.name || '—'}</p>
      <p className="mt-0.5 text-xs text-ink-muted">
        {[item.brand, item.article].filter(Boolean).join(' · ') || `№${item.id}`}
      </p>
      <p className="mt-1 text-sm text-ink-muted">
        {formatAutoserviceWarehouseQty(item)}
        {' · '}
        {formatAutoserviceWarehouseMoney(displayPrice)}
      </p>
    </button>
  );
}

export default function AutoserviceWarehousePage() {
  const navigate = useNavigate();
  const { isReady, isAuthenticated, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes || []);
  const clientMarkupEnabled = canUseClientMarkup(user);
  const canEditMarkupSettings = canEditClientMarkupSettings(user, permissionCodes);
  const storedClientMarkupPercent = useSelector(
    (state) => Number(state.clientMarkup.percent) || 0,
  );
  const catalogMarkupPercent = useNewPartsMarkupPercent('autoservice');
  const clientMarkupPercent = clientMarkupEnabled ? storedClientMarkupPercent : 0;
  const [items, setItems] = useState([]);
  const [purchaseLots, setPurchaseLots] = useState([]);
  const [activeTab, setActiveTab] = useState('stock');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [supplierFilter, setSupplierFilter] = useState('');
  const [supplierCustom, setSupplierCustom] = useState('');
  const [supplierDocs, setSupplierDocs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsItem, setDetailsItem] = useState(null);
  const [detailsMovements, setDetailsMovements] = useState(null);
  const [detailsMovementsLoading, setDetailsMovementsLoading] = useState(false);
  const [detailsMovementsError, setDetailsMovementsError] = useState('');
  const [writeOffItem, setWriteOffItem] = useState(null);
  const [writeOffQty, setWriteOffQty] = useState('1');
  const [writeOffReason, setWriteOffReason] = useState('');
  const [orderQtyItem, setOrderQtyItem] = useState(null);
  const [orderQty, setOrderQty] = useState('1');
  const [orderPickerOpen, setOrderPickerOpen] = useState(false);
  const [pendingOrderItems, setPendingOrderItems] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [returnLot, setReturnLot] = useState(null);
  const [reservations, setReservations] = useState([]);
  const [reservationsLoading, setReservationsLoading] = useState(false);
  const [reservationsError, setReservationsError] = useState('');
  const [viewRepairOrder, setViewRepairOrder] = useState(null);
  const [viewRepairOrderLoading, setViewRepairOrderLoading] = useState(false);

  const supplierTerm = (supplierFilter || supplierCustom).trim();

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ exclude_zero_qty: 'true' });
      if (supplierTerm) params.set('supplier', supplierTerm);
      const [data, lots] = await Promise.all([
        apiRequest(`/autoservice/warehouse/items?${params.toString()}`),
        apiRequest('/autoservice/warehouse/purchase-lots'),
      ]);
      setItems(Array.isArray(data) ? data : []);
      setPurchaseLots(Array.isArray(lots) ? lots : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить склад автосервиса');
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
    loadItems();
    loadSupplierDocs();
  }, [isReady, isAuthenticated, user, loadItems, loadSupplierDocs]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/warehouse') {
        loadItems();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadItems]);

  useEffect(() => {
    if (!detailsItem?.id) {
      setReservations([]);
      setReservationsLoading(false);
      setReservationsError('');
      setDetailsMovements(null);
      setDetailsMovementsLoading(false);
      setDetailsMovementsError('');
      return undefined;
    }

    let cancelled = false;
    setReservationsLoading(true);
    setReservationsError('');
    apiRequest(`/autoservice/warehouse/items/${detailsItem.id}/reservations`)
      .then((data) => {
        if (cancelled) return;
        setReservations(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (cancelled) return;
        setReservations([]);
        setReservationsError(err?.message || 'Не удалось загрузить резерв');
      })
      .finally(() => {
        if (!cancelled) setReservationsLoading(false);
      });

    setDetailsMovementsLoading(true);
    setDetailsMovementsError('');
    apiRequest(`/autoservice/warehouse/items/${detailsItem.id}/movements`)
      .then((data) => {
        if (cancelled) return;
        setDetailsMovements(data || null);
      })
      .catch((err) => {
        if (cancelled) return;
        setDetailsMovements(null);
        setDetailsMovementsError(err?.message || 'Не удалось загрузить движения');
      })
      .finally(() => {
        if (!cancelled) setDetailsMovementsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [detailsItem?.id]);

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

  const filteredItems = useMemo(
    () => items.filter((item) => matchesAutoserviceWarehouseSearch(item, searchQuery)),
    [items, searchQuery],
  );

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

  const detailsItemReturnableLot = useMemo(
    () =>
      detailsItem
        ? purchaseLots.find(
            (lot) =>
              lot.item_id === detailsItem.id &&
              lot.max_returnable_qty > 0 &&
              !lot.active_return,
          )
        : null,
    [detailsItem, purchaseLots],
  );

  const openWriteOff = (item) => {
    if (!item || Number(item.available_qty) < 1) {
      setError('Нет доступного количества для списания (всё в резерве или остаток 0)');
      return;
    }
    setError('');
    setDetailsItem(null);
    setWriteOffItem(item);
    setWriteOffQty('1');
    setWriteOffReason('');
  };

  const openAddToOrder = (item) => {
    if (!item || Number(item.available_qty) < 1) {
      setError('Нет доступного количества для добавления в заказ-наряд');
      return;
    }
    setError('');
    setDetailsItem(null);
    setOrderQtyItem(item);
    setOrderQty('1');
  };

  const openEditItem = (item) => {
    if (!item) return;
    setError('');
    setDetailsItem(null);
    setEditItem(item);
  };

  const handleEditItem = async (values) => {
    if (!editItem?.id) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest(`/autoservice/warehouse/items/${editItem.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          brand: values.brand?.trim() || '',
          article: values.article?.trim() || '',
          name: values.name?.trim(),
          unit: values.unit || 'pcs',
          unit_price: Number(values.unit_price),
        }),
      });
      setEditItem(null);
      await loadItems();
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить изменения');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const handleWriteOff = async () => {
    if (!writeOffItem) return;
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/autoservice/warehouse/expenses', {
        method: 'POST',
        body: JSON.stringify({
          item_id: writeOffItem.id,
          quantity: Number(writeOffQty),
          reason: writeOffReason.trim() || null,
        }),
      });
      setWriteOffItem(null);
      await loadItems();
    } catch (err) {
      setError(err?.message || 'Не удалось списать запчасть');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddManual = async (values) => {
    setSubmitting(true);
    setError('');
    try {
      await apiRequest('/autoservice/warehouse/receipts', {
        method: 'POST',
        body: JSON.stringify({
          brand: values.brand?.trim() || '',
          article: values.article?.trim() || '',
          name: values.name?.trim(),
          quantity: values.quantity,
          unit: values.unit || 'pcs',
          unit_price: Number(values.unit_price),
        }),
      });
      setAddOpen(false);
      await loadItems();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить запчасть');
      throw err;
    } finally {
      setSubmitting(false);
    }
  };

  const confirmOrderQty = () => {
    if (!orderQtyItem) return;
    const qty = Math.max(1, Math.min(Number(orderQty) || 1, Number(orderQtyItem.available_qty) || 1));
    setPendingOrderItems([{ item_id: orderQtyItem.id, qty }]);
    setOrderQtyItem(null);
    setOrderPickerOpen(true);
  };

  const handlePickRepairOrder = async (orderId) => {
    if (!pendingOrderItems.length) return;
    await apiRequest(`/autoservice/repair-orders/${orderId}/autoservice-stock`, {
      method: 'POST',
      body: JSON.stringify({
        items: pendingOrderItems,
        markup_percent: Number(clientMarkupPercent) || 0,
      }),
    });
    setPendingOrderItems([]);
    await loadItems();
  };

  const listCountLabel = activeTab === 'stock'
    ? `${filteredItems.length} позиций`
    : activeTab === 'receipts'
      ? 'История поступлений'
      : 'История списаний';

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !userHasAutoserviceOrganization(user)) {
    return null;
  }

  return (
    <div className={autoserviceListPageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={autoserviceListHeaderTitleClass}>Склад автосервиса</h1>
          <p className={autoserviceListHeaderSubtitleClass}>
            {loading ? 'Загрузка…' : listCountLabel}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError('');
              setAddOpen(true);
            }}
            className={autoserviceListPrimaryButtonClass}
          >
            Добавить
          </button>
        </div>
      </div>

      <UnderlineTabs
        className="mb-4"
        ariaLabel="Разделы склада автосервиса"
        gapClassName="gap-4"
        tabs={[
          { id: 'stock', label: 'Остатки' },
          { id: 'receipts', label: 'Поступления' },
          { id: 'expenses', label: 'Расходы' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      {activeTab === 'stock' ? (
        <>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <AutoserviceLiveSearchField
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Поиск по бренду, артикулу, названию"
              ariaLabel="Поиск по складу автосервиса"
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
            <AutoserviceListRefreshButton loading={loading} onClick={loadItems} />
          </div>

          {filtersOpen ? (
            <div className="mb-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="block min-w-0">
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

          {error ? (
            <p className={autoserviceListErrorClass} role="alert">
              {error}
            </p>
          ) : null}
        </>
      ) : null}

      {activeTab === 'receipts' ? (
        <AutoserviceWarehouseReceiptsPage embedded />
      ) : activeTab === 'expenses' ? (
        <AutoserviceWarehouseExpensesPage embedded />
      ) : (
        <>
          <div className={autoserviceListTableWrapClass}>
            <table className={autoserviceListTableClass}>
              <thead>
                <tr className={autoserviceListTheadRowClass}>
                  <th className={`w-3/5 ${autoserviceListThClass}`}>Наименование</th>
                  <th className={`w-20 whitespace-nowrap !pr-2 ${autoserviceListThRightClass}`}>Кол-во</th>
                  <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {clientMarkupEnabled ? (
                        <ClientMarkupPopover readOnly={!canEditMarkupSettings} />
                      ) : null}
                      <span>Цена</span>
                    </span>
                  </th>
                  <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Сумма</th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`sk-item-${index}`}>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-36" /></td>
                      <td className={`w-20 whitespace-nowrap !pr-2 ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-16" /></td>
                      <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-16" /></td>
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-12 text-center text-ink-muted">
                      На складе автосервиса пока нет позиций
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const displayPrice = autoserviceWarehouseClientPrice(
                      item.unit_price,
                      catalogMarkupPercent,
                    );
                    return (
                      <tr
                        key={item.id}
                        className={autoserviceListTrClickableClass}
                        onClick={() => setDetailsItem(item)}
                      >
                        <td className={`min-w-0 ${autoserviceListTdClass}`}>
                          <div className="w-0 min-w-full truncate font-semibold text-ink">{item.name || '—'}</div>
                          {!item.name ? (
                            <div className="mt-0.5 text-xs text-ink-faint">№{item.id}</div>
                          ) : null}
                        </td>
                        <td className={`w-20 !pr-2 text-ink-muted ${autoserviceListTdRightClass} tabular-nums whitespace-nowrap`}>
                          {formatAutoserviceWarehouseQty(item)}
                        </td>
                        <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums`}>
                          {formatAutoserviceWarehouseMoney(displayPrice)}
                        </td>
                        <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums font-semibold`}>
                          {formatAutoserviceWarehouseMoney(displayPrice * Number(item.quantity || 0))}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className={autoserviceListMobileWrapClass}>
            {loading ? (
              <div className="divide-y divide-line-soft">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`msk-item-${index}`} className="border-b border-line-soft py-2 last:border-b-0">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1 h-3 w-24" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                На складе автосервиса пока нет позиций
              </p>
            ) : (
              filteredItems.map((item) => {
                const displayPrice = autoserviceWarehouseClientPrice(
                  item.unit_price,
                  catalogMarkupPercent,
                );
                return (
                  <WarehouseItemMobileCard
                    key={item.id}
                    item={item}
                    displayPrice={displayPrice}
                    onOpen={() => setDetailsItem(item)}
                  />
                );
              })
            )}
          </div>
        </>
      )}

      <AutoserviceWarehouseReturnModal
        receiptId={returnLot?.receipt_id || null}
        initialLot={returnLot}
        onClose={() => setReturnLot(null)}
        onCreated={loadItems}
      />

      <Modal
        open={Boolean(detailsItem)}
        onClose={() => setDetailsItem(null)}
        title={detailsItem ? autoserviceWarehouseItemLabel(detailsItem) : 'Позиция склада'}
        draggable
      >
        {detailsItem ? (
          <div className="space-y-4">
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-ink-muted">Бренд</dt>
                <dd className="font-medium text-ink">{detailsItem.brand || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Артикул</dt>
                <dd className="font-mono text-ink">{detailsItem.article || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-ink-muted">Наименование</dt>
                <dd className="font-medium text-ink">{detailsItem.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Количество</dt>
                <dd className="tabular-nums text-ink">{formatAutoserviceWarehouseQty(detailsItem)}</dd>
              </div>
              <div>
                <dt className="text-ink-muted">Цена</dt>
                <dd className="tabular-nums font-semibold text-ink">
                  {formatAutoserviceWarehouseMoney(
                    autoserviceWarehouseClientPrice(detailsItem.unit_price, catalogMarkupPercent),
                  )}
                </dd>
              </div>
            </dl>

            <AutoserviceWarehouseItemMovements
              movements={detailsMovements}
              loading={detailsMovementsLoading}
              error={detailsMovementsError}
              showStock={false}
              onOpenOrder={openRepairOrder}
            />

            {Number(detailsItem.reserved_qty) > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold text-ink">Резерв в заказ-нарядах</h3>
                {reservationsLoading ? (
                  <p className="text-sm text-ink-muted">Загрузка…</p>
                ) : reservationsError ? (
                  <p className="text-sm text-danger-600" role="alert">{reservationsError}</p>
                ) : reservations.length === 0 ? (
                  <p className="text-sm text-ink-muted">Нет активных резервов в заказ-нарядах</p>
                ) : (
                  <ul className="divide-y divide-line-soft rounded-sg border border-line">
                    {reservations.map((row) => (
                      <li
                        key={row.repair_order_id}
                        className="flex items-center justify-between gap-3 px-3 py-2.5 text-sm"
                      >
                        <div className="min-w-0">
                          <button
                            type="button"
                            className="font-medium text-brand-700 hover:text-brand-900"
                            onClick={() => openRepairOrder(row.repair_order_id)}
                          >
                            {repairOrderNumberLabel({
                              id: row.repair_order_id,
                              order_number: row.repair_order_number,
                            })}
                          </button>
                          <p className="mt-0.5 text-xs text-ink-muted">
                            {REPAIR_ORDER_STATUS_LABELS[row.order_status] || row.order_status}
                          </p>
                        </div>
                        <span className="shrink-0 tabular-nums font-medium text-ink">
                          {formatReservationQty(row.qty, row.unit || detailsItem.unit || 'pcs')}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : null}

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="secondary" onClick={() => openEditItem(detailsItem)}>
                Редактировать
              </Button>
              <Button variant="secondary" onClick={() => openAddToOrder(detailsItem)}>
                Добавить в заказ-наряд
              </Button>
              {detailsItemReturnableLot ? (
                <Button
                  variant="secondary"
                  onClick={() => {
                    setDetailsItem(null);
                    setReturnLot(detailsItemReturnableLot);
                  }}
                >
                  Вернуть
                </Button>
              ) : null}
              <Button onClick={() => openWriteOff(detailsItem)}>
                Списать
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <RepairOrderViewModal
        order={viewRepairOrder}
        loading={viewRepairOrderLoading}
        enablePayment
        onClose={() => setViewRepairOrder(null)}
        onEdit={(o) => {
          if (!o?.id) return;
          navigate(`/autoservice/orders/${o.id}/edit`);
        }}
        onOrderChange={(updated) => setViewRepairOrder(updated)}
      />

      <Modal
        open={Boolean(writeOffItem)}
        onClose={() => setWriteOffItem(null)}
        title="Списать со склада автосервиса"
        draggable
      >
        {writeOffItem ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{autoserviceWarehouseItemLabel(writeOffItem)}</p>
            <label className="block text-sm">
              <span className="font-medium text-ink-soft">Количество</span>
              <NumericInput
                min="1"
                max={writeOffItem.available_qty || 1}
                value={writeOffQty}
                onChange={(event) => setWriteOffQty(event.target.value)}
                className="sg-pill-input mt-1 w-full"
              />
              <span className="mt-1 block text-xs text-ink-muted">
                Доступно: {writeOffItem.available_qty} {formatShopPartUnit(writeOffItem.unit || 'pcs')}
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-ink-soft">Причина</span>
              <input
                type="text"
                value={writeOffReason}
                onChange={(event) => setWriteOffReason(event.target.value)}
                className="sg-pill-input mt-1 w-full"
                placeholder="Необязательно"
              />
            </label>
            <div className="flex justify-end gap-2 max-md:flex-col">
              <button type="button" className={warehouseSecondaryButtonClass} onClick={() => setWriteOffItem(null)}>
                Отмена
              </button>
              <button
                type="button"
                className={autoserviceListPrimaryButtonClass}
                disabled={submitting}
                onClick={handleWriteOff}
              >
                {submitting ? 'Списание…' : 'Списать'}
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(orderQtyItem)}
        onClose={() => setOrderQtyItem(null)}
        title="Добавить в заказ-наряд"
        draggable
      >
        {orderQtyItem ? (
          <div className="space-y-4">
            <p className="text-sm text-ink-soft">{autoserviceWarehouseItemLabel(orderQtyItem)}</p>
            <label className="block text-sm">
              <span className="font-medium text-ink-soft">Количество</span>
              <NumericInput
                min="1"
                max={orderQtyItem.available_qty || 1}
                value={orderQty}
                onChange={(event) => setOrderQty(event.target.value)}
                className="sg-pill-input mt-1 w-full"
              />
              <span className="mt-1 block text-xs text-ink-muted">
                Доступно: {orderQtyItem.available_qty} {formatShopPartUnit(orderQtyItem.unit || 'pcs')}
              </span>
            </label>
            <div className="flex justify-end gap-2 max-md:flex-col">
              <button type="button" className={warehouseSecondaryButtonClass} onClick={() => setOrderQtyItem(null)}>
                Отмена
              </button>
              <button type="button" className={autoserviceListPrimaryButtonClass} onClick={confirmOrderQty}>
                Выбрать заказ-наряд
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <AutoserviceWarehouseAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSubmit={handleAddManual}
        submitting={submitting}
        submitLabel="Добавить на склад"
      />

      <AutoserviceWarehouseAddModal
        open={Boolean(editItem)}
        onClose={() => setEditItem(null)}
        onSubmit={handleEditItem}
        submitting={submitting}
        mode="edit"
        editScope="warehouse"
        initialValues={editItem ? {
          brand: editItem.brand || '',
          article: editItem.article || '',
          name: editItem.name || '',
          unit: editItem.unit || 'pcs',
          unit_price: editItem.unit_price ?? 0,
        } : null}
      />

      <RepairOrderPickerModal
        open={orderPickerOpen}
        onClose={() => {
          setOrderPickerOpen(false);
          setPendingOrderItems([]);
        }}
        title="Добавить в заказ-наряд"
        showCreateNew={false}
        onPickOrder={handlePickRepairOrder}
      />
    </div>
  );
}
