import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ClientMarkupPopover from '../../components/NewParts/ClientMarkupPopover';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AutoserviceListRefreshButton from '../../components/Autoservice/AutoserviceListRefreshButton';
import Modal from '../../components/UI/Modal';
import Button from '../../components/UI/Button';
import { Skeleton, UnderlineTabs } from '../../components/UI';
import RepairOrderPickerModal from '../../components/Autoservice/RepairOrderPickerModal';
import AutoserviceWarehouseAddModal from '../../components/Autoservice/AutoserviceWarehouseAddModal';
import AutoserviceWarehouseReturnModal from '../../components/Autoservice/AutoserviceWarehouseReturnModal';
import { useAuthReady } from '../../hooks/useAuthReady';
import useNewPartsMarkupPercent from '../../hooks/useNewPartsMarkupPercent';
import { canUseClientMarkup } from '../../utils/clientMarkupUtils';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import {
  autoserviceWarehouseClientPrice,
  autoserviceWarehouseItemLabel,
  formatAutoserviceWarehouseMoney,
  formatAutoserviceWarehouseQty,
  matchesAutoserviceWarehouseSearch,
} from '../../utils/autoserviceWarehouseUi';
import {
  autoserviceListActionsButtonClass,
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

function WarehouseItemActionsMenu({
  canAct,
  onEdit,
  onAddToOrder,
  onWriteOff,
  showLabel = true,
}) {
  return (
    <ActionsDropdown
      menuClassName="w-56 z-50"
      estimatedMenuHeight={160}
      showLabel={showLabel}
      buttonClassName={autoserviceListActionsButtonClass}
    >
      <ActionsDropdownItem onClick={onEdit}>Редактировать</ActionsDropdownItem>
      <ActionsDropdownItem disabled={!canAct} onClick={onAddToOrder}>
        Добавить в заказ-наряд
      </ActionsDropdownItem>
      <ActionsDropdownItem disabled={!canAct} onClick={onWriteOff}>
        Списать
      </ActionsDropdownItem>
    </ActionsDropdown>
  );
}

function WarehouseItemMobileCard({
  item,
  displayPrice,
  canAct,
  onOpen,
  onEdit,
  onAddToOrder,
  onWriteOff,
}) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onOpen} className="min-w-0 flex-1 text-left">
          <p className="font-medium text-gray-900">{item.name || '—'}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {[item.brand, item.article].filter(Boolean).join(' · ') || `№${item.id}`}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {formatAutoserviceWarehouseQty(item)}
            {' · '}
            {formatAutoserviceWarehouseMoney(displayPrice)}
          </p>
        </button>
        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
          <WarehouseItemActionsMenu
            canAct={canAct}
            showLabel={false}
            onEdit={onEdit}
            onAddToOrder={onAddToOrder}
            onWriteOff={onWriteOff}
          />
        </div>
      </div>
    </div>
  );
}

function PurchaseLotMobileCard({ lot, onReturn }) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="font-medium text-gray-900">{lot.name}</p>
          <p className="mt-0.5 text-xs text-gray-500">
            {[lot.brand, lot.article].filter(Boolean).join(' · ') || '—'}
          </p>
          <p className="mt-1 text-sm text-gray-600">
            {lot.supplier_name}
            {lot.source_order_id ? ` · Заказ №${lot.source_order_id}` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500">
            Поступило {lot.quantity} · Доступно к возврату {lot.max_returnable_qty}
          </p>
        </div>
        <div className="shrink-0">
          {lot.active_return ? (
            <span className="text-xs font-medium text-indigo-700">
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
  const clientMarkupEnabled = canUseClientMarkup(user);
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

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [data, lots] = await Promise.all([
        apiRequest('/autoservice/warehouse/items'),
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
                  <th className={autoserviceListThClass}>Товар</th>
                  <th className={autoserviceListThClass}>Поставщик</th>
                  <th className={`w-24 ${autoserviceListThClass}`}>Заказ</th>
                  <th className={autoserviceListThRightClass}>Поступило</th>
                  <th className={autoserviceListThRightClass}>Резерв</th>
                  <th className={autoserviceListThRightClass}>К возврату</th>
                  <th className={autoserviceListThActionsClass}>Действие</th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`sk-lot-${index}`}>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-36" /></td>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-28" /></td>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-16" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-10" /></td>
                      <td className={autoserviceListTdActionsClass}><Skeleton className="ml-auto h-8 w-16 rounded-lg" /></td>
                    </tr>
                  ))
                ) : filteredLots.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-gray-500">
                      На складе нет партий из оформленных заказов
                    </td>
                  </tr>
                ) : (
                  filteredLots.map((lot) => (
                    <tr key={lot.receipt_id} className={autoserviceListTrClass}>
                      <td className={autoserviceListTdClass}>
                        <p className="font-medium text-gray-900">{lot.name}</p>
                        <p className="mt-0.5 text-xs text-gray-500">
                          {[lot.brand, lot.article].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </td>
                      <td className={autoserviceListTdClass}>{lot.supplier_name}</td>
                      <td className={autoserviceListTdClass}>№ {lot.source_order_id}</td>
                      <td className={`${autoserviceListTdRightClass} tabular-nums`}>{lot.quantity}</td>
                      <td className={`${autoserviceListTdRightClass} tabular-nums`}>
                        {lot.item_reserved_qty || 0}
                      </td>
                      <td className={`${autoserviceListTdRightClass} tabular-nums`}>
                        {lot.max_returnable_qty}
                      </td>
                      <td className={autoserviceListTdActionsClass}>
                        {lot.active_return ? (
                          <span className="text-xs font-medium text-indigo-700">
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
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`msk-lot-${index}`} className="py-3">
                    <Skeleton className="h-4 w-32" />
                    <Skeleton className="mt-2 h-3 w-40" />
                  </div>
                ))}
              </div>
            ) : filteredLots.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
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
                  <th className={`w-24 ${autoserviceListThClass}`}>Бренд</th>
                  <th className={`w-28 ${autoserviceListThClass}`}>Артикул</th>
                  <th className={autoserviceListThClass}>Наименование</th>
                  <th className={autoserviceListThRightClass}>Кол-во</th>
                  <th className={autoserviceListThRightClass}>
                    <span className="inline-flex items-center justify-end gap-1.5">
                      {clientMarkupEnabled ? <ClientMarkupPopover /> : null}
                      <span>Цена</span>
                    </span>
                  </th>
                  <th className={autoserviceListThActionsClass}>Действия</th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {loading ? (
                  Array.from({ length: 6 }).map((_, index) => (
                    <tr key={`sk-item-${index}`}>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-16" /></td>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                      <td className={autoserviceListTdClass}><Skeleton className="h-4 w-36" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-12" /></td>
                      <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-16" /></td>
                      <td className={autoserviceListTdActionsClass}><Skeleton className="ml-auto h-8 w-20 rounded-lg" /></td>
                    </tr>
                  ))
                ) : filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-500">
                      На складе автосервиса пока нет позиций
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => {
                    const displayPrice = autoserviceWarehouseClientPrice(
                      item.unit_price,
                      catalogMarkupPercent,
                    );
                    const canAct = Number(item.available_qty) > 0;
                    return (
                      <tr
                        key={item.id}
                        className={autoserviceListTrClickableClass}
                        onClick={(event) => {
                          if (event.target.closest('.actions-dropdown')) return;
                          setDetailsItem(item);
                        }}
                      >
                        <td className={`${autoserviceListTdClass} font-medium`}>{item.brand || '—'}</td>
                        <td className={`${autoserviceListTdClass} font-mono text-gray-600`}>{item.article || '—'}</td>
                        <td className={autoserviceListTdClass}>
                          <div className="font-medium text-gray-900">{item.name || '—'}</div>
                          {!item.brand && !item.article ? (
                            <div className="mt-0.5 text-xs text-gray-400">№{item.id}</div>
                          ) : null}
                        </td>
                        <td className={`${autoserviceListTdRightClass} tabular-nums whitespace-nowrap`}>
                          {formatAutoserviceWarehouseQty(item)}
                        </td>
                        <td className={`${autoserviceListTdRightClass} tabular-nums font-semibold`}>
                          {formatAutoserviceWarehouseMoney(displayPrice)}
                        </td>
                        <td className={autoserviceListTdActionsClass}>
                          <WarehouseItemActionsMenu
                            canAct={canAct}
                            onEdit={() => openEditItem(item)}
                            onAddToOrder={() => openAddToOrder(item)}
                            onWriteOff={() => openWriteOff(item)}
                          />
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
              <div className="divide-y divide-gray-100">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={`msk-item-${index}`} className="flex items-start justify-between gap-3 py-3">
                    <div className="min-w-0 flex-1 space-y-2">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="h-3 w-24" />
                    </div>
                    <Skeleton className="h-8 w-8 rounded-lg" />
                  </div>
                ))}
              </div>
            ) : filteredItems.length === 0 ? (
              <p className="py-10 text-center text-sm text-gray-500">
                На складе автосервиса пока нет позиций
              </p>
            ) : (
              filteredItems.map((item) => {
                const displayPrice = autoserviceWarehouseClientPrice(
                  item.unit_price,
                  catalogMarkupPercent,
                );
                const canAct = Number(item.available_qty) > 0;
                return (
                  <WarehouseItemMobileCard
                    key={item.id}
                    item={item}
                    displayPrice={displayPrice}
                    canAct={canAct}
                    onOpen={() => setDetailsItem(item)}
                    onEdit={() => openEditItem(item)}
                    onAddToOrder={() => openAddToOrder(item)}
                    onWriteOff={() => openWriteOff(item)}
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
                <dt className="text-gray-500">Бренд</dt>
                <dd className="font-medium text-gray-900">{detailsItem.brand || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Артикул</dt>
                <dd className="font-mono text-gray-900">{detailsItem.article || '—'}</dd>
              </div>
              <div className="col-span-2">
                <dt className="text-gray-500">Наименование</dt>
                <dd className="font-medium text-gray-900">{detailsItem.name || '—'}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Количество</dt>
                <dd className="tabular-nums text-gray-900">{formatAutoserviceWarehouseQty(detailsItem)}</dd>
              </div>
              <div>
                <dt className="text-gray-500">Цена</dt>
                <dd className="tabular-nums font-semibold text-gray-900">
                  {formatAutoserviceWarehouseMoney(
                    autoserviceWarehouseClientPrice(detailsItem.unit_price, catalogMarkupPercent),
                  )}
                </dd>
              </div>
            </dl>
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
            <p className="text-sm text-gray-700">{autoserviceWarehouseItemLabel(writeOffItem)}</p>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Количество</span>
              <input
                type="number"
                min="1"
                max={writeOffItem.available_qty || 1}
                value={writeOffQty}
                onChange={(event) => setWriteOffQty(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Доступно: {writeOffItem.available_qty} шт.
              </span>
            </label>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Причина</span>
              <input
                type="text"
                value={writeOffReason}
                onChange={(event) => setWriteOffReason(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Необязательно"
              />
            </label>
            <div className="flex justify-end gap-2">
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
            <p className="text-sm text-gray-700">{autoserviceWarehouseItemLabel(orderQtyItem)}</p>
            <label className="block text-sm">
              <span className="font-medium text-gray-700">Количество</span>
              <input
                type="number"
                min="1"
                max={orderQtyItem.available_qty || 1}
                value={orderQty}
                onChange={(event) => setOrderQty(event.target.value)}
                className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="mt-1 block text-xs text-gray-500">
                Доступно: {orderQtyItem.available_qty} шт.
              </span>
            </label>
            <div className="flex justify-end gap-2">
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
