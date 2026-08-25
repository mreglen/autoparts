import React, { useState, useEffect } from 'react';
import Modal from '../../components/UI/Modal';
import Button from '../../components/UI/Button';

const fieldClass =
  'w-24 min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm max-md:text-base text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30';

const ReturnModal = ({
  isOpen,
  onClose,
  items,
  onConfirm,
  onRemoveItem,
}) => {
  const [quantities, setQuantities] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && items && items.length > 0) {
      const initialQuantities = {};
      items.forEach((item) => {
        initialQuantities[item.id] = item.quantity;
      });
      setQuantities(initialQuantities);
      setErrors({});
    }
  }, [isOpen, items]);

  if (!isOpen || !items || items.length === 0) return null;

  const handleQuantityChange = (itemId, value) => {
    const numValue = parseInt(value, 10) || 0;
    const item = items.find((i) => i.id === itemId);
    const maxQuantity = item.quantity;

    setQuantities((prev) => ({
      ...prev,
      [itemId]: numValue,
    }));

    if (numValue < 1) {
      setErrors((prev) => ({
        ...prev,
        [itemId]: 'Количество должно быть больше 0',
      }));
    } else if (numValue > maxQuantity) {
      setErrors((prev) => ({
        ...prev,
        [itemId]: `Максимум ${maxQuantity} шт.`,
      }));
    } else {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };

  const handleConfirm = () => {
    if (Object.keys(errors).length > 0) {
      return;
    }

    const hasValidQuantities = items.every((item) => {
      const quantity = quantities[item.id];
      return quantity >= 1 && quantity <= item.quantity;
    });

    if (!hasValidQuantities) {
      return;
    }

    const returnData = items.map((item) => ({
      stockOutId: item.id,
      productId: item.product_id || item.productId,
      quantity: quantities[item.id],
      returnPrice: item.sale_price > 0 ? item.sale_price : (item.product?.price || 0),
      reason: item.reason || null,
      storageLocationId: item.storage_location_id || item.storageLocationId,
    }));

    onConfirm(returnData);
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title={`Возврат запчастей (${items.length})`}
      size="lg"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="secondary" onClick={onClose}>
            Отмена
          </Button>
          <Button variant="primary" onClick={handleConfirm} disabled={hasErrors}>
            Вернуть запчасти
          </Button>
        </div>
      )}
    >
      <div className="space-y-4">
        {items.map((item) => (
          <div key={item.id} className="rounded-xl border border-gray-200 p-4">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                {onRemoveItem && (
                  <button
                    type="button"
                    onClick={() => onRemoveItem(item.id)}
                    className="float-right ml-2 flex h-11 w-11 items-center justify-center rounded-full hover:bg-gray-100"
                    title="Убрать из возврата"
                    aria-label="Убрать из возврата"
                  >
                    <img src="/img/close_sm.svg" alt="" className="h-4 w-4" />
                  </button>
                )}
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-medium text-gray-900">
                    {item.product?.brand} {item.product?.name}
                  </span>
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.sale_price > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                  }`}
                  >
                    {item.sale_price > 0 ? 'Продажа' : 'Списание'}
                  </span>
                </div>
                <div className="text-sm text-gray-600">
                  Артикул: {item.product?.article || '—'} •
                  Внутренний код: {item.product?.internal_code || '—'} •
                  Дата: {item.movement_date}
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  Цена возврата: {item.sale_price > 0 ? `${item.sale_price.toFixed(2)} ₽` : `${item.product?.price?.toFixed(2) || '—'} ₽`}
                </div>
              </div>
              <div className="shrink-0 text-right text-sm text-gray-600">
                Доступно: {item.quantity} шт.
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <label className="text-sm font-medium text-gray-700">
                Вернуть количество:
              </label>
              <input
                type="number"
                min="1"
                max={item.quantity}
                value={quantities[item.id] || ''}
                onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                className={`${fieldClass} ${errors[item.id] ? 'border-red-300 focus:ring-red-500' : ''}`}
              />
              <span className="text-sm text-gray-600">шт.</span>
            </div>

            {errors[item.id] && (
              <div className="mt-2 text-sm text-red-600">
                {errors[item.id]}
              </div>
            )}
          </div>
        ))}
      </div>
    </Modal>
  );
};

export default ReturnModal;
