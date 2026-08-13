import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { Input } from '../UI/Field';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';
import { canUseClientMarkup } from '../../utils/clientMarkupUtils';
import { vehicleLabel } from './RepairOrderViewModal';
import {
  importPurchaseGroupsToRepairOrder,
  purchaseItemsAlreadyOnRepairOrder,
  saveLinkedRepairOrder,
  saveRepairOrderPurchaseDraft,
  snapshotPurchaseItems,
} from '../../utils/repairOrderPurchaseDraft';

function formatDate(value) {
  return formatServerDateTime(value) || '—';
}

export default function RepairOrderPickerModal({
  open,
  onClose,
  groups = [],
  linkedRepairOrder = null,
  onImported,
}) {
  const navigate = useNavigate();
  const user = useSelector((state) => state.auth.user);
  const storedClientMarkupPercent = useSelector(
    (state) => Number(state.clientMarkup.percent) || 0,
  );
  const clientMarkupPercent = canUseClientMarkup(user) ? storedClientMarkupPercent : 0;
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [importingId, setImportingId] = useState(null);

  const loadOrders = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ scope: 'active' });
      if (search.trim()) params.set('q', search.trim());
      const data = await apiRequest(`/autoservice/repair-orders?${params.toString()}`);
      setOrders(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить заказ-наряды');
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    if (!open) return undefined;
    loadOrders();
    return undefined;
  }, [open, loadOrders]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();
    const matched = !term
      ? [...orders]
      : orders.filter((order) => {
        const haystack = [
          order.order_number,
          order.client?.name,
          order.client?.phone,
          order.vehicle?.make,
          order.vehicle?.model,
          order.vehicle?.plate,
          order.vehicle?.vin,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(term);
      });
    const currentId = linkedRepairOrder?.id;
    if (!currentId) return matched;
    return matched.sort((a, b) => {
      if (a.id === currentId) return -1;
      if (b.id === currentId) return 1;
      return 0;
    });
  }, [orders, search, linkedRepairOrder]);

  const handleImport = async (orderId) => {
    if (purchaseItemsAlreadyOnRepairOrder(groups, orderId)) {
      onClose();
      return;
    }
    setImportingId(orderId);
    setError('');
    try {
      const updated = await importPurchaseGroupsToRepairOrder(
        apiRequest,
        orderId,
        groups,
        clientMarkupPercent,
      );
      saveLinkedRepairOrder(updated);
      onImported?.(updated);
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить позиции в заказ-наряд');
    } finally {
      setImportingId(null);
    }
  };

  const handleCreateNew = () => {
    const draftGroups = groups.map((group) => ({
      orderType: group.orderType,
      itemIds: group.itemIds,
      items: snapshotPurchaseItems(group.items),
    }));
    saveRepairOrderPurchaseDraft({
      groups: draftGroups,
      createdAt: Date.now(),
    });
    onClose();
    navigate('/autoservice/orders/new', {
      state: { fromPurchaseImport: true },
    });
  };

  const modalTitle = linkedRepairOrder ? 'Изменить заказ-наряд' : 'Добавить к заказ-наряду';

  return (
    <Modal
      open={open}
      onClose={onClose}
      size="lg"
      title={modalTitle}
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={handleCreateNew}>
            Создать новый заказ-наряд
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Поиск по номеру, клиенту, авто…"
        />
        {error ? <p className="text-sm text-danger-600" role="alert">{error}</p> : null}
        {loading ? (
          <p className="py-6 text-center text-sm text-ink-muted">Загрузка…</p>
        ) : filteredOrders.length === 0 ? (
          <p className="py-6 text-center text-sm text-ink-muted">
            Активных заказ-нарядов не найдено. Создайте новый.
          </p>
        ) : (
          <ul className="max-h-80 space-y-2 overflow-y-auto">
            {filteredOrders.map((order) => {
              const isCurrent = linkedRepairOrder?.id === order.id;
              return (
              <li key={order.id}>
                <button
                  type="button"
                  disabled={importingId === order.id}
                  onClick={() => handleImport(order.id)}
                  className={`flex w-full items-start justify-between gap-3 rounded-sg border px-3 py-3 text-left transition disabled:opacity-60 ${
                    isCurrent
                      ? 'border-brand-400 bg-brand-50/60'
                      : 'border-line bg-surface hover:border-brand-300 hover:bg-brand-50/40'
                  }`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-ink">
                      №{order.order_number}
                      {' · '}
                      {order.client?.name || 'Клиент'}
                      {isCurrent ? (
                        <span className="ml-2 text-xs font-medium text-brand-600">(текущий)</span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 truncate text-xs text-ink-muted">
                      {vehicleLabel(order.vehicle)}
                      {' · '}
                      {formatDate(order.scheduled_at)}
                    </p>
                  </div>
                  <span className="shrink-0 text-xs font-medium text-brand-600">
                    {importingId === order.id
                      ? (linkedRepairOrder ? 'Перенос…' : 'Добавление…')
                      : (isCurrent
                        ? 'Оставить'
                        : (linkedRepairOrder ? 'Перенести' : 'Выбрать'))}
                  </span>
                </button>
              </li>
              );
            })}
          </ul>
        )}
      </div>
    </Modal>
  );
}
