import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
import AutoserviceWarehouseAddModal from '../../components/Autoservice/AutoserviceWarehouseAddModal';
import AutoserviceWarehouseReturnModal from '../../components/Autoservice/AutoserviceWarehouseReturnModal';
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
  autoserviceListTdActionsClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThActionsClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClass,
  autoserviceListTrClickableClass,
  warehouseSecondaryButtonClass,
} from '../../utils/warehouseListUi';

const REPAIR_ORDER_STATUS_LABELS = {
  review: 'На проверке',
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

function PurchaseLotMobileCard({ lot, onReturn }) {
  return (
    <div className="border-b border-line-soft py-2 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium text-ink">{lot.name}</p>
          <p className="mt-0.5 text-xs text-ink-muted">
            {[lot.brand, lot.article].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="mt-1 text-sm text-ink-muted">
            {lot.supplier_name}
            {lot.source_order_id ? ` · Заказ №${lot.source_order_id}` : ''}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Поступило {lot.quantity} · Доступно к возврату {lot.max_returnable_qty}
          </p>
        </div>
        <div className="shrink-0">
          {lot.active_return ? (
            <span className="text-xs font-medium text-brand-700">
              №{lot.active_return.id}
            </span>
          ) : (
            <Button type="button" variant="secondary" size="sm" onClick={onReturn}>
              Вернуть
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AutoserviceWarehousePage() {
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
  const [activeTab, setActiveTab] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [detailsItem, setDetailsItem] = useState(null);
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

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, lots] = await Promise.all([
        apiRequest('/autoservice/warehouse/items?exclude_zero_qty=true'),
        apiRequest('/autoservice/warehouse/purchase-lots'),
      ]);
      setItems(Array.isArray(data) ? data : []);
      setPurchaseLots(Array.isArray(lots) ? lots : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить склад автосервиса');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    if (!userHasAutoserviceOrganization(user)) return;
    loadItems();
  }, [isReady, isAuthenticated, user, loadItems]);

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

    return () => {
      cancelled = true;
    };
  }, [detailsItem?.id]);

  const filteredItems = useMemo(
    () => items.filter((item) => matchesAutoserviceWarehouseSearch(item, searchQuery)),
    [items, searchQuery],
  );
  const filteredLots = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return purchaseLots;
    return purchaseLots.filter((lot) => [
      lot.brand,
      lot.article,
      lot.name,
      lot.supplier_name,
      lot.source_order_id,
    ].some((value) => String(value || '').toLowerCase().includes(query)));
  }, [purchaseLots, searchQuery]);

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

  const listCount = activeTab === 'purchases' ? filteredLots.length : filteredItems.length;
  const listCountLabel = activeTab === 'purchases'
    ? `${listCount} партий`
    : `${listCount} позиций`;

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
          { id: 'all', label: 'Все товары' },
          { id: 'purchases', label: 'Из закупок' },
        ]}
        value={activeTab}
        onChange={setActiveTab}
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AutoserviceLiveSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder={
            activeTab === 'purchases'
              ? 'Поиск по товару, поставщику или заказу'
              : 'Поиск по бренду, артикулу, названию'
          }
          ariaLabel="Поиск по складу автосервиса"
        />
        <AutoserviceListRefreshButton loading={loading} onClick={loadItems} />
      </div>

      {error ? (
        <p className={autoserviceListErrorClass} role="alert">
          {error}
        </p>
      ) : null}

      {activeTab === 'purchases' ? (
        <>
          <div className={autoserviceListTableWrapClass}>
            <table className={autoserviceListTableClass}>
              <thead>
                <tr className={autoserviceListTheadRowClass}>
                  <th className={`min-w-0 ${autoserviceListThClass}`}>Товар</th>
                  <th className={`min-w-0 ${autoserviceListThClass}`}>Поставщик</th>
                  <th className={`w-24 whitespace-nowrap ${autoserviceListThClass}`}>Заказ</th>
                  <th className={`w-20 whitespace-nowrap ${autoserviceListThRightClass}`}>Поступило</th>
                  <th className={`w-20 whitespace-nowrap ${autoserviceListThRightClass}`}>Резерв</th>
                  <th className={`w-20 whitespace-nowrap ${autoserviceListThRightClass}`}>К возврату</th>
                  <th className={autoserviceListThActionsClass}>Действие</th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`sk-lot-${index}`}>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-36" /></td>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-28" /></td>
                      <td className={`w-24 ${autoserviceListTdClass} text-center`}><Skeleton className="mx-auto h-4 w-16" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={autoserviceListTdActionsClass}><Skeleton className="ml-auto h-8 w-16 rounded-sg-sm" /></td>
                    </tr>
                  ))
                ) : filteredLots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-ink-muted">
                      На складе нет партий из оформленных заказов
                    </td>
                  </tr>
                ) : (
                  filteredLots.map((lot) => (
                    <tr key={lot.receipt_id} className={autoserviceListTrClass}>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}>
                        <p className="w-0 min-w-full truncate font-medium text-ink">{lot.name}</p>
                        <p className="mt-0.5 text-xs text-ink-muted">
                          {[lot.brand, lot.article].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}>
                        <div className="w-0 min-w-full truncate text-ink">{lot.supplier_name}</div>
                      </td>
                      <td className={`w-24 whitespace-nowrap ${autoserviceListTdClass} text-center`}>№ {lot.source_order_id}</td>
                      <td className={`w-20 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums`}>{lot.quantity}</td>
                      <td className={`w-20 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums`}>
                        {lot.item_reserved_qty || 0}
                      </td>
                      <td className={`w-20 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums`}>
                        {lot.max_returnable_qty}
                      </td>
                      <td className={autoserviceListTdActionsClass}>
                        {lot.active_return ? (
                          <span className="text-xs font-medium text-brand-700">
                            Заявка №{lot.active_return.id} · {lot.active_return.status_code}
                          </span>
                        ) : (
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            onClick={() => setReturnLot(lot)}
                          >
                            Вернуть
                          </Button>
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
                  <div key={`msk-lot-${index}`} className="border-b border-line-soft py-2 last:border-b-0">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-1 h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : filteredLots.length === 0 ? (
              <p className="py-10 text-center text-sm text-ink-muted">
                На складе нет партий из оформленных заказов
              </p>
            ) : (
              filteredLots.map((lot) => (
                <PurchaseLotMobileCard
                  key={lot.receipt_id}
                  lot={lot}
                  onReturn={() => setReturnLot(lot)}
                />
              ))
            )}
          </div>
        </>
      ) : (
        <>
          <div className={autoserviceListTableWrapClass}>
            <table className={autoserviceListTableClass}>
              <thead>
                <tr className={autoserviceListTheadRowClass}>
                  <th className={`min-w-0 ${autoserviceListThClass}`}>Наименование</th>
                  <th className={`w-20 whitespace-nowrap ${autoserviceListThRightClass}`}>Кол-во</th>
                  <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {clientMarkupEnabled ? (
                        <ClientMarkupPopover readOnly={!canEditMarkupSettings} />
                      ) : null}
                      <span>Цена</span>
                    </span>
                  </th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`sk-item-${index}`}>
                      <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-36" /></td>
                      <td className={`w-20 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-16" /></td>
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="py-12 text-center text-ink-muted">
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
                          <div className="w-0 min-w-full truncate font-medium text-ink">{item.name || '—'}</div>
                          {!item.name ? (
                            <div className="mt-0.5 text-xs text-ink-faint">№{item.id}</div>
                          ) : null}
                        </td>
                        <td className={`w-20 ${autoserviceListTdRightClass} tabular-nums whitespace-nowrap`}>
                          {formatAutoserviceWarehouseQty(item)}
                        </td>
                        <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums font-semibold`}>
                          {formatAutoserviceWarehouseMoney(displayPrice)}
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
                          <Link
                            to={`/autoservice/orders/${row.repair_order_id}/edit`}
                            className="font-medium text-brand-700 hover:text-brand-900"
                            onClick={() => setDetailsItem(null)}
                          >
                            {repairOrderNumberLabel({
                              id: row.repair_order_id,
                              order_number: row.repair_order_number,
                            })}
                          </Link>
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
              <Button onClick={() => openWriteOff(detailsItem)}>
                Списать
              </Button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(writeOffItem)}
        onClose={() => setWriteOffItem(null)}
        title="Списать со склада автосервиса"
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
