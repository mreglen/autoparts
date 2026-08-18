import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import ClientMarkupPopover from '../../components/NewParts/ClientMarkupPopover';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import Modal from '../../components/UI/Modal';
import Button from '../../components/UI/Button';
import RepairOrderPickerModal from '../../components/Autoservice/RepairOrderPickerModal';
import AutoserviceWarehouseAddModal from '../../components/Autoservice/AutoserviceWarehouseAddModal';
import { useAuthReady } from '../../hooks/useAuthReady';
import useNewPartsMarkupPercent from '../../hooks/useNewPartsMarkupPercent';
import { canUseClientMarkup } from '../../utils/clientMarkupUtils';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import {
  autoserviceWarehouseClientPrice,
  formatAutoserviceWarehouseMoney,
  formatAutoserviceWarehouseQty,
  matchesAutoserviceWarehouseSearch,
} from '../../utils/autoserviceWarehouseUi';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehousePrimaryButtonClass,
  warehouseSecondaryButtonClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

function itemLabel(item) {
  return [item?.brand, item?.article, item?.name].filter(Boolean).join(' · ') || 'Запчасть';
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

  const loadItems = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/warehouse/items');
      setItems(Array.isArray(data) ? data : []);
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

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!isAuthenticated || !userHasAutoserviceOrganization(user)) {
    return null;
  }

  return (
    <div className={warehousePageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Склад автосервиса</h1>
          <p className="mt-1 text-sm text-gray-500">Остатки запчастей автосервиса</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setError('');
              setAddOpen(true);
            }}
            className={warehousePrimaryButtonClass}
          >
            Добавить
          </button>
          <button
            type="button"
            onClick={loadItems}
            className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Обновить
          </button>
        </div>
      </div>

      <div className={`${warehouseToolbarClass} mb-4`}>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск по бренду, артикулу, названию"
          className={`${warehousePillControlClass} sm:max-w-md`}
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Загрузка…
        </div>
      ) : filteredItems.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-gray-600">На складе автосервиса пока нет позиций</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Бренд</th>
                <th className="px-4 py-3">Артикул</th>
                <th className="px-4 py-3">Наименование</th>
                <th className="px-4 py-3 text-right">Кол-во</th>
                <th className="px-4 py-3 text-right">
                  <span className="inline-flex items-center justify-end gap-1.5">
                    {clientMarkupEnabled ? <ClientMarkupPopover /> : null}
                    <span>Цена</span>
                  </span>
                </th>
                <th className="px-4 py-3 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredItems.map((item) => {
                const displayPrice = autoserviceWarehouseClientPrice(
                  item.unit_price,
                  catalogMarkupPercent,
                );
                const canAct = Number(item.available_qty) > 0;
                return (
                  <tr
                    key={item.id}
                    className="cursor-pointer text-gray-800 hover:bg-gray-50"
                    onDoubleClick={() => setDetailsItem(item)}
                  >
                    <td className="px-4 py-3 font-medium">{item.brand || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{item.article || '—'}</td>
                    <td className="px-4 py-3">{item.name || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums whitespace-nowrap">
                      {formatAutoserviceWarehouseQty(item)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatAutoserviceWarehouseMoney(displayPrice)}
                    </td>
                    <td className="px-4 py-3 text-right" onDoubleClick={(e) => e.stopPropagation()}>
                      <ActionsDropdown
                        showLabel
                        label="Действия"
                        menuClassName="w-56 z-50"
                        estimatedMenuHeight={160}
                        buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50"
                      >
                        <ActionsDropdownItem onClick={() => openEditItem(item)}>
                          Редактировать
                        </ActionsDropdownItem>
                        <ActionsDropdownItem
                          disabled={!canAct}
                          onClick={() => openAddToOrder(item)}
                        >
                          Добавить в заказ-наряд
                        </ActionsDropdownItem>
                        <ActionsDropdownItem
                          disabled={!canAct}
                          onClick={() => openWriteOff(item)}
                        >
                          Списать
                        </ActionsDropdownItem>
                      </ActionsDropdown>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      <Modal
        open={Boolean(detailsItem)}
        onClose={() => setDetailsItem(null)}
        title={detailsItem ? itemLabel(detailsItem) : 'Позиция склада'}
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
            <p className="text-sm text-gray-700">{itemLabel(writeOffItem)}</p>
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
                className={warehousePrimaryButtonClass}
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
            <p className="text-sm text-gray-700">{itemLabel(orderQtyItem)}</p>
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
              <button type="button" className={warehousePrimaryButtonClass} onClick={confirmOrderQty}>
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
