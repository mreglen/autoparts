import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
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
  const [expandedOrderKey, setExpandedOrderKey] = useState(null);
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
      <div className="space-y-2">
        {error ? <p className="text-sm text-danger-600" role="alert">{error}</p> : null}
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Загрузка заказов…</p>
        ) : unifiedOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Оформленных заказов пока нет</p>
        ) : (
          <ul className="space-y-2">
            {unifiedOrders.map((entry) => {
              const orderType = entry.source;
              const order = entry.order;
              const key = getUnifiedOrderKey(entry);
              const items = order.items || [];
              const isExpanded = expandedOrderKey === key;
              const itemKeys = items.map((item) => purchaseSelectionKey(orderType, order.id, item.id));
              const allSelected = itemKeys.length > 0 && itemKeys.every((itemKey) => selectedKeys.has(itemKey));
              const someSelected = itemKeys.some((itemKey) => selectedKeys.has(itemKey));
              const sellerName = order.organization_name || '';

              return (
                <li key={key} className="rounded-sg border border-line bg-surface">
                  <button
                    type="button"
                    onClick={() => setExpandedOrderKey(isExpanded ? null : key)}
                    className="flex w-full min-h-11 items-center justify-between gap-2 px-3 py-2 text-left"
                  >
                    <span className="min-w-0 text-sm text-ink">
                      <span className="font-medium">
                        №{order.id}
                        <span className="font-normal text-ink-faint"> · {orderType === 'new' ? 'Новый' : 'Б/У'}</span>
                      </span>
                      {sellerName ? (
                        <span className="text-ink-muted"> · {sellerName}</span>
                      ) : null}
                      <span>
                        {formatOrderDate(order.created_at) ? ` · ${formatOrderDate(order.created_at)}` : ''}
                      </span>
                      <span className="text-ink-muted"> · {items.length} поз.</span>
                      {order.total_amount != null ? (
                        <span className="font-medium"> · {formatPrice(order.total_amount)}</span>
                      ) : null}
                    </span>
                    <span className="shrink-0 text-xs text-brand-600">
                      {isExpanded ? 'Свернуть' : 'Развернуть'}
                    </span>
                  </button>
                  {isExpanded ? (
                    <div className="border-t border-line px-2 py-2">
                      <div className="overflow-x-auto">
                        <table className={autoserviceListTableClass}>
                          <thead>
                            <tr className={autoserviceListTheadRowClass}>
                              <th className={`w-8 ${autoserviceListThClass}`}>
                                <input
                                  type="checkbox"
                                  checked={allSelected}
                                  ref={(el) => {
                                    if (el) el.indeterminate = someSelected && !allSelected;
                                  }}
                                  onChange={() => toggleAllInOrder(orderType, order.id, items)}
                                  aria-label="Выбрать всё"
                                  className="h-4 w-4 rounded border-line text-brand-600"
                                />
                              </th>
                              <th className={`min-w-0 ${autoserviceListThClass}`}>Наименование</th>
                              <th className={`w-16 whitespace-nowrap ${autoserviceListThRightClass}`}>Кол-во</th>
                              <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Цена</th>
                              <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Сумма</th>
                            </tr>
                          </thead>
                          <tbody className={autoserviceListTbodyClass}>
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
                                <tr key={itemKey} className="cursor-pointer transition hover:bg-surface-muted/50">
                                  <td className={`w-8 ${autoserviceListTdClass}`}>
                                    <input
                                      type="checkbox"
                                      checked={selectedKeys.has(itemKey)}
                                      onChange={() => toggleItem(orderType, order.id, item)}
                                      aria-label={title}
                                      className="h-4 w-4 rounded border-line text-brand-600"
                                    />
                                  </td>
                                  <td
                                    className={`min-w-0 ${autoserviceListTdClass}`}
                                    onClick={() => toggleItem(orderType, order.id, item)}
                                  >
                                    <div className="truncate text-ink">{title}</div>
                                    {item.repair_order_id ? (
                                      <div className="mt-0.5 text-xs text-ink-muted">
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
                        </table>
                      </div>
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
