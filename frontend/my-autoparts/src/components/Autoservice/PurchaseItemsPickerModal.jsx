import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import AutoserviceLiveSearchField from './AutoserviceLiveSearchField';
import { apiAxios } from '../../utils/apiClient';
import { buildUnifiedOrders, getUnifiedOrderKey } from '../../utils/orderSourceMeta';
import {
  groupPurchaseSelections,
  purchaseSelectionKey,
} from '../../utils/repairOrderPurchaseDraft';
import {
  autoserviceListTableClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
} from '../../utils/warehouseListUi';

const EMPTY_SELECTED_KEYS = new Set();

const selectClass =
  'h-10 min-w-0 shrink-0 rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-700 outline-none focus:bg-white focus:ring-2 focus:ring-indigo-400/70 max-md:h-11';

function orderConditionKey(source) {
  if (source === 'new') return 'new';
  if (source === 'used') return 'used';
  return 'none';
}

function orderSupplierName(order) {
  return (order?.organization_name || order?.seller || '').trim();
}

function purchaseItemMatchesQuery(item, query) {
  const haystack = [item.name, item.product_name, item.brand, item.partnumber]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function formatPrice(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU')} ₽`;
}

function formatOrderDate(value) {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString('ru-RU');
  } catch {
    return '';
  }
}

export default function PurchaseItemsPickerModal({
  open,
  onClose,
  onConfirm,
  initialSelectedKeys = EMPTY_SELECTED_KEYS,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [searchInput, setSearchInput] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('');
  const [conditionFilter, setConditionFilter] = useState('');
  const [selectedKeys, setSelectedKeys] = useState(() => new Set(initialSelectedKeys));

  useEffect(() => {
    if (!open) return;
    setSelectedKeys(new Set(initialSelectedKeys));
  }, [open, initialSelectedKeys]);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [usedRes, newRes] = await Promise.allSettled([
        apiAxios.get('/sales/purchases/used-orders'),
        apiAxios.get('/sales/purchases/new-orders'),
      ]);
      if (usedRes.status === 'fulfilled') {
        setUsedOrders(Array.isArray(usedRes.value.data) ? usedRes.value.data : []);
      } else {
        throw usedRes.reason;
      }
      if (newRes.status === 'fulfilled') {
        setNewOrders(Array.isArray(newRes.value.data) ? newRes.value.data : []);
      } else {
        setNewOrders([]);
      }
    } catch (err) {
      setError(err?.response?.data?.detail || err.message || 'Не удалось загрузить заказы');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    loadOrders();
    return undefined;
  }, [open, loadOrders]);

  const unifiedOrders = useMemo(
    () => buildUnifiedOrders(usedOrders, newOrders, [], { canViewNewOrders: true, avitoProActive: false }),
    [usedOrders, newOrders],
  );

  const supplierOptions = useMemo(() => {
    const names = new Set();
    unifiedOrders.forEach(({ order }) => {
      const name = orderSupplierName(order);
      if (name) names.add(name);
    });
    return [...names];
  }, [unifiedOrders]);

  const filteredOrders = useMemo(() => {
    const query = searchInput.trim().toLowerCase();
    return unifiedOrders
      .map((entry) => {
        const order = entry.order;
        const items = order.items || [];
        if (conditionFilter && orderConditionKey(entry.source) !== conditionFilter) return null;
        if (supplierFilter && orderSupplierName(order) !== supplierFilter) return null;
        if (!query) return { entry, items };
        const orderMatches = String(order.id ?? '')
          .toLowerCase()
          .includes(query);
        if (orderMatches) return { entry, items };
        const matched = items.filter((item) => purchaseItemMatchesQuery(item, query));
        return matched.length ? { entry, items: matched } : null;
      })
      .filter(Boolean);
  }, [unifiedOrders, searchInput, supplierFilter, conditionFilter]);

  const toggleItem = (orderType, orderId, item) => {
    const key = purchaseSelectionKey(orderType, orderId, item.id);
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const toggleAllInOrder = (orderType, orderId, items) => {
    const keys = items.map((item) => purchaseSelectionKey(orderType, orderId, item.id));
    const allSelected = keys.every((key) => selectedKeys.has(key));
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (allSelected) keys.forEach((key) => next.delete(key));
      else keys.forEach((key) => next.add(key));
      return next;
    });
  };

  const selectedEntries = useMemo(() => {
    const entries = [];
    unifiedOrders.forEach((entry) => {
      const orderType = entry.source;
      const order = entry.order;
      (order.items || []).forEach((item) => {
        const key = purchaseSelectionKey(orderType, order.id, item.id);
        if (!selectedKeys.has(key)) return;
        entries.push({
          orderType,
          orderId: order.id,
          itemId: item.id,
          brand: item.brand || '',
          partnumber: item.partnumber || '',
          name: item.name || item.product_name || '',
          quantity: item.quantity || 1,
          price: item.price || 0,
          product_id: item.product_id || null,
        });
      });
    });
    return entries;
  }, [selectedKeys, unifiedOrders]);

  const handleConfirm = () => {
    onConfirm?.(groupPurchaseSelections(selectedEntries));
    onClose();
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title="Выбрать из оформленных заказов"
      draggable
      footer={(
        <div className="flex flex-wrap justify-end gap-2 max-md:flex-col">
          <Button variant="secondary" onClick={onClose} className="max-md:min-h-11">
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={selectedEntries.length === 0} className="max-md:min-h-11">
            Добавить ({selectedEntries.length})
          </Button>
        </div>
      )}
    >
      <div className="space-y-3">
        <div className="sticky -top-4 z-10 -mx-5 flex flex-col gap-2 bg-surface px-5 py-2 sm:flex-row sm:items-center">
          <AutoserviceLiveSearchField
            value={searchInput}
            onChange={setSearchInput}
            placeholder="Название, артикул, № заказа"
            ariaLabel="Поиск по позициям и заказам"
          />
          <select
            className={selectClass}
            value={supplierFilter}
            onChange={(e) => setSupplierFilter(e.target.value)}
            aria-label="Фильтр по поставщику"
          >
            <option value="">Все поставщики</option>
            {supplierOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
          <select
            className={selectClass}
            value={conditionFilter}
            onChange={(e) => setConditionFilter(e.target.value)}
            aria-label="Фильтр по состоянию"
          >
            <option value="">Состояние: все</option>
            <option value="none">Не указано</option>
            <option value="new">Новый</option>
            <option value="used">Б/у</option>
          </select>
        </div>

        {error ? <p className="text-sm text-danger-600" role="alert">{error}</p> : null}
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Загрузка заказов…</p>
        ) : filteredOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            {unifiedOrders.length === 0 ? 'Оформленных заказов пока нет' : 'Ничего не найдено'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className={autoserviceListTableClass}>
              <thead>
                <tr className={autoserviceListTheadRowClass}>
                  <th className={`w-8 ${autoserviceListThClass}`} aria-label="Выбрать" />
                  <th className={`min-w-0 ${autoserviceListThClass}`}>Наименование</th>
                  <th className={`w-16 whitespace-nowrap ${autoserviceListThRightClass}`}>Кол-во</th>
                  <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Цена</th>
                  <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Сумма</th>
                </tr>
              </thead>
              {filteredOrders.map(({ entry, items }) => {
                const orderType = entry.source;
                const order = entry.order;
                const key = getUnifiedOrderKey(entry);
                const itemKeys = items.map((item) => purchaseSelectionKey(orderType, order.id, item.id));
                const allSelected = itemKeys.length > 0 && itemKeys.every((itemKey) => selectedKeys.has(itemKey));
                const someSelected = itemKeys.some((itemKey) => selectedKeys.has(itemKey));
                const sellerName = orderSupplierName(order);

                return (
                  <tbody key={key} className={autoserviceListTbodyClass}>
                    <tr className="border-t-2 border-line bg-surface-subtle">
                      <td className={`w-8 ${autoserviceListTdClass}`}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el) el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={() => toggleAllInOrder(orderType, order.id, items)}
                          aria-label={`Выбрать все позиции заказа №${order.id}`}
                          className="h-4 w-4 rounded border-line text-brand-600"
                        />
                      </td>
                      <td colSpan={4} className={`${autoserviceListTdClass} text-xs`}>
                        <span className="font-semibold text-ink">№{order.id}</span>
                        <span className="text-ink-faint"> · {orderType === 'new' ? 'Новый' : orderType === 'used' ? 'Б/у' : 'Не указано'}</span>
                        {sellerName ? <span className="text-ink-muted"> · {sellerName}</span> : null}
                        {formatOrderDate(order.created_at) ? (
                          <span className="text-ink-muted"> · {formatOrderDate(order.created_at)}</span>
                        ) : null}
                        <span className="text-ink-muted"> · {items.length} поз.</span>
                        {order.total_amount != null ? (
                          <span className="font-medium text-ink"> · {formatPrice(order.total_amount)}</span>
                        ) : null}
                      </td>
                    </tr>
                    {items.map((item) => {
                      const itemKey = purchaseSelectionKey(orderType, order.id, item.id);
                      const title = [
                        item.brand,
                        item.partnumber,
                        item.name || item.product_name,
                      ].filter(Boolean).join(' ') || 'Товар';
                      const qty = Number(item.quantity || 0);
                      const lineTotal = qty * Number(item.price || 0);
                      return (
                        <tr
                          key={itemKey}
                          className="cursor-pointer transition hover:bg-surface-muted/50"
                          onClick={() => toggleItem(orderType, order.id, item)}
                        >
                          <td className={`w-8 ${autoserviceListTdClass}`}>
                            <input
                              type="checkbox"
                              checked={selectedKeys.has(itemKey)}
                              onChange={() => toggleItem(orderType, order.id, item)}
                              onClick={(e) => e.stopPropagation()}
                              aria-label={title}
                              className="h-4 w-4 rounded border-line text-brand-600"
                            />
                          </td>
                          <td className={`min-w-0 ${autoserviceListTdClass}`}>
                            <div className="truncate text-ink">{title}</div>
                            {item.repair_order_id ? (
                              <div className="mt-0.5 text-[11px] text-ink-muted">
                                заказ-наряд{item.repair_order_number ? ` №${item.repair_order_number}` : ''}
                              </div>
                            ) : null}
                          </td>
                          <td className={`w-16 whitespace-nowrap tabular-nums text-ink-muted ${autoserviceListTdRightClass}`}>
                            {qty} шт.
                          </td>
                          <td className={`w-24 whitespace-nowrap tabular-nums ${autoserviceListTdRightClass}`}>
                            {formatPrice(item.price)}
                          </td>
                          <td className={`w-24 whitespace-nowrap tabular-nums font-semibold ${autoserviceListTdRightClass}`}>
                            {formatPrice(lineTotal)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                );
              })}
            </table>
          </div>
        )}
      </div>
    </Modal>
  );
}
