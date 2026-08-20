import React from 'react';

const StockOutModal = ({ 
  isOpen, 
  onClose, 
  selectedPart, 
  operationType, 
  formData, 
  onFormChange, 
  onConfirm 
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="p-6">
          <h2 className="text-lg font-bold text-gray-800 mb-4">
            {operationType === 'sale' ? 'Продажа запчасти' : 'Списание запчасти'}
          </h2>

          {selectedPart && (
            <div className="text-sm text-gray-600 mb-4">
              <div>Бренд: {selectedPart.brand || '—'}</div>
              <div>Артикул: {selectedPart.article || '—'}</div>
              <div>Остаток: {selectedPart.quantity || '—'}</div>
            </div>
          )}

          <div className="mb-4">
            <label className="block text-sm text-gray-700 mb-1">Количество</label>
            <input
              type="number"
              min="1"
              max={selectedPart?.quantity}
              value={formData.quantity}
              onChange={(e) => onFormChange('quantity', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md"
            />
          </div>

          {operationType === 'sale' ? (
            <>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">Цена продажи, ₽</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.price}
                  onChange={(e) => onFormChange('price', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                />
              </div>
              <div className="mb-4">
                <label className="block text-sm text-gray-700 mb-1">Комментарий</label>
                <textarea
                  value={formData.comment || ''}
                  onChange={(e) => onFormChange('comment', e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  rows="3"
                  placeholder="Например: продажа клиенту, самовывоз..."
                />
              </div>
            </>
          ) : (
            <div className="mb-4">
              <label className="block text-sm text-gray-700 mb-1">Причина списания</label>
              <textarea
                value={formData.reason}
                onChange={(e) => onFormChange('reason', e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
                rows="3"
                placeholder="Например: брак, утеря, поломка..."
              />
            </div>
          )}

          <div className="flex justify-end space-x-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 hover:text-gray-800"
            >
              Отмена
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 transition"
            >
              Подтвердить
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockOutModal;