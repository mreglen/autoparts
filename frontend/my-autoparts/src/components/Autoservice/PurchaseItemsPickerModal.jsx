import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { apiAxios } from '../../utils/apiClient';
import { buildUnifiedOrders, getUnifiedOrderKey } from '../../utils/orderSourceMeta';
import { normalizeNewPartsCustomerStatus } from '../../utils/garageOrderUi';
import {
  groupPurchaseSelections,
  purchaseSelectionKey,
} from '../../utils/repairOrderPurchaseDraft';

function formatPrice(amount) {
  return `${Number(amount || 0).toLocaleString('ru-RU')} ₽`;
}

export default function PurchaseItemsPickerModal({
  open,
  onClose,
  onConfirm,
  initialSelectedKeys = new Set(),
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [usedOrders, setUsedOrders] = useState([]);
  const [newOrders, setNewOrders] = useState([]);
  const [expandedOrderKey, setExpandedOrderKey] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState(new Set(initialSelectedKeys));

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
      size="lg"
      title="Выбрать из оформленных заказов"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleConfirm} disabled={selectedEntries.length === 0}>
            Добавить ({selectedEntries.length})
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {error ? <p className="text-sm text-danger-600" role="alert">{error}</p> : null}
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Загрузка заказов…</p>
        ) : unifiedOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">Оформленных заказов пока нет</p>
        ) : (
          <ul className="max-h-[28rem] space-y-3 overflow-y-auto">
            {unifiedOrders.map((entry) => {
              const orderType = entry.source;
              const order = entry.order;
              const key = getUnifiedOrderKey(entry);
              const items = order.items || [];
              const isExpanded = expandedOrderKey === key;
              const itemKeys = items.map((item) => purchaseSelectionKey(orderType, order.id, item.id));
              const allSelected = itemKeys.length > 0 && itemKeys.every((itemKey) => selectedKeys.has(itemKey));
              const someSelected = itemKeys.some((itemKey) => selectedKeys.has(itemKey));

              return (
                <li key={key} className="rounded-sg border border-line bg-surface">
                  <button
                    type="button"
                    onClick={() => setExpandedOrderKey(isExpanded ? null : key)}
                    className="flex w-full items-center justify-between px-3 py-2.5 text-left"
                  >
                    <span className="text-sm font-medium text-ink">
                      {orderType === 'new' ? 'NEW' : 'Б/У'}
                      {' · '}
                      №{order.id}
                      {' · '}
                      {items.length} поз.
                    </span>
                    <span className="text-xs text-brand-600">{isExpanded ? 'Свернуть' : 'Развернуть'}</span>
                  </button>
                  {isExpanded ? (
                    <div className="border-t border-line px-3 py-2">
                      {items.length > 1 ? (
                        <label className="mb-2 flex items-center gap-2 text-xs text-ink-muted">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            ref={(el) => {
                              if (el) el.indeterminate = someSelected && !allSelected;
                            }}
                            onChange={() => toggleAllInOrder(orderType, order.id, items)}
                            className="h-4 w-4 rounded border-line text-brand-600"
                          />
                          Выбрать всё
                        </label>
                      ) : null}
                      <ul className="space-y-2">
                        {items.map((item) => {
                          const itemKey = purchaseSelectionKey(orderType, order.id, item.id);
                          const title = item.name || item.product_name || 'Товар';
                          return (
                            <li key={itemKey}>
                              <label className="flex cursor-pointer items-start gap-2 rounded-sg border border-line/70 px-2 py-2 hover:bg-surface-muted/40">
                                <input
                                  type="checkbox"
                                  checked={selectedKeys.has(itemKey)}
                                  onChange={() => toggleItem(orderType, order.id, item)}
                                  className="mt-0.5 h-4 w-4 rounded border-line text-brand-600"
                                />
                                <span className="min-w-0 flex-1">
                                  <span className="block text-sm font-medium text-ink">{title}</span>
                                  <span className="mt-0.5 block text-xs text-ink-muted">
                                    {[item.brand, item.partnumber].filter(Boolean).join(' · ')}
                                    {' · '}
                                    {item.quantity || 0} шт. × {formatPrice(item.price)}
                                    {item.repair_order_id
                                      ? ` · заказ-наряд${item.repair_order_number ? ` №${item.repair_order_number}` : ''}`
                                      : ''}
                                  </span>
                                </span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
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
