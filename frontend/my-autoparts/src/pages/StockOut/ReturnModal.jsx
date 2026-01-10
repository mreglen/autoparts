import React, { useState, useEffect } from 'react';

const ReturnModal = ({
  isOpen,
  onClose,
  items, // массив элементов для возврата
  onConfirm,
  onRemoveItem // функция для удаления позиции из списка
}) => {
  const [quantities, setQuantities] = useState({});
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (isOpen && items && items.length > 0) {
      // Инициализируем количества по умолчанию
      const initialQuantities = {};
      items.forEach(item => {
        initialQuantities[item.id] = item.quantity;
      });
      setQuantities(initialQuantities);
      setErrors({});
    }
  }, [isOpen, items]);

  if (!isOpen || !items || items.length === 0) return null;

  const handleQuantityChange = (itemId, value) => {
    const numValue = parseInt(value) || 0;
    const item = items.find(i => i.id === itemId);
    const maxQuantity = item.quantity;

    setQuantities(prev => ({
      ...prev,
      [itemId]: numValue
    }));

    // Валидация
    if (numValue < 1) {
      setErrors(prev => ({
        ...prev,
        [itemId]: 'Количество должно быть больше 0'
      }));
    } else if (numValue > maxQuantity) {
      setErrors(prev => ({
        ...prev,
        [itemId]: `Максимум ${maxQuantity} шт.`
      }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[itemId];
        return newErrors;
      });
    }
  };

  const handleConfirm = () => {
    // Проверяем, есть ли ошибки
    if (Object.keys(errors).length > 0) {
      return;
    }

    // Проверяем, что все количества корректны
    const hasValidQuantities = items.every(item => {
      const quantity = quantities[item.id];
      return quantity >= 1 && quantity <= item.quantity;
    });

    if (!hasValidQuantities) {
      return;
    }

    // Формируем данные для возврата
    const returnData = items.map(item => ({
      stockOutId: item.id,
      productId: item.product_id || item.productId,
      quantity: quantities[item.id],
      returnPrice: item.sale_price > 0 ? item.sale_price : (item.product?.price || 0),
      reason: item.reason || null,
      storageLocationId: item.storage_location_id || item.storageLocationId
    }));

    onConfirm(returnData);
  };

  const hasErrors = Object.keys(errors).length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            Возврат запчастей ({items.length})
          </h2>

          <div className="space-y-4">
            {items.map((item) => (
              <div key={item.id} className="border border-gray-200 rounded-lg p-4">
                <div className="flex justify-between items-start mb-3">
                  <div className="flex-1">
                    {onRemoveItem && (
                      <button
                        onClick={() => onRemoveItem(item.id)}
                        className="float-right ml-2 p-1 hover:bg-gray-100 rounded-full transition-colors"
                        title="Убрать из возврата"
                      >
                        <img src="/img/close_sm.svg" alt="Удалить" className="w-4 h-4" />
                      </button>
                    )}
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-900">
                        {item.product?.brand} {item.product?.name}
                      </span>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                        item.sale_price > 0 ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {item.sale_price > 0 ? 'Продажа' : 'Списание'}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600">
                      Артикул: {item.product?.article || '—'} •
                      Внутренний код: {item.product?.internal_code || '—'} •
                      Дата: {item.movement_date}
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Цена возврата: {item.sale_price > 0 ? `${item.sale_price.toFixed(2)} ₽` : `${item.product?.price?.toFixed(2) || '—'} ₽`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm text-gray-600 mb-1">
                      Доступно: {item.quantity} шт.
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-gray-700">
                    Вернуть количество:
                  </label>
                  <input
                    type="number"
                    min="1"
                    max={item.quantity}
                    value={quantities[item.id] || ''}
                    onChange={(e) => handleQuantityChange(item.id, e.target.value)}
                    className={`w-20 px-2 py-1 border rounded-md text-sm ${
                      errors[item.id] ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'
                    }`}
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

          <div className="flex justify-end space-x-3 mt-6 pt-4 border-t">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={handleConfirm}
              disabled={hasErrors}
              className={`px-4 py-2 rounded-md text-white font-medium ${
                hasErrors
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-indigo-600 hover:bg-indigo-700'
              } transition-colors`}
            >
              Вернуть запчасти
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReturnModal;
