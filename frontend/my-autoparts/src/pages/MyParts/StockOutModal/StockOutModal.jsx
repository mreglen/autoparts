import React from 'react';
import Modal from '../../../components/UI/Modal';
import Button from '../../../components/UI/Button';

const fieldClass =
  'w-full min-h-11 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm max-md:text-base text-gray-900 focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30';

const StockOutModal = ({
  isOpen,
  onClose,
  selectedPart,
  operationType,
  formData,
  onFormChange,
  onConfirm,
}) => (
  <Modal
    open={isOpen}
    onClose={onClose}
    title={operationType === 'sale' ? 'Продажа запчасти' : 'Списание запчасти'}
    size="sm"
    footer={(
      <div className="flex flex-wrap justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          Отмена
        </Button>
        <Button variant="primary" onClick={onConfirm}>
          Подтвердить
        </Button>
      </div>
    )}
  >
    {selectedPart && (
      <div className="mb-4 rounded-xl bg-gray-50 px-3 py-2.5 text-sm text-gray-600 ring-1 ring-gray-200/80">
        <div>Бренд: {selectedPart.brand || '—'}</div>
        <div>Артикул: {selectedPart.article || '—'}</div>
        <div>Остаток: {selectedPart.quantity || '—'}</div>
      </div>
    )}

    <div className="mb-4">
      <label className="mb-1 block text-sm font-medium text-gray-700">Количество</label>
      <input
        type="number"
        min="1"
        max={selectedPart?.quantity}
        value={formData.quantity}
        onChange={(e) => onFormChange('quantity', e.target.value)}
        className={fieldClass}
      />
    </div>

    {operationType === 'sale' ? (
      <>
        <div className="mb-4">
          <label className="mb-1 block text-sm font-medium text-gray-700">Цена продажи, ₽</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={formData.price}
            onChange={(e) => onFormChange('price', e.target.value)}
            className={fieldClass}
          />
        </div>
        <div className="mb-1">
          <label className="mb-1 block text-sm font-medium text-gray-700">Комментарий</label>
          <textarea
            value={formData.comment || ''}
            onChange={(e) => onFormChange('comment', e.target.value)}
            className={`${fieldClass} min-h-[88px] resize-y`}
            rows="3"
            placeholder="Например: продажа клиенту, самовывоз..."
          />
        </div>
      </>
    ) : (
      <div className="mb-1">
        <label className="mb-1 block text-sm font-medium text-gray-700">Причина списания</label>
        <textarea
          value={formData.reason}
          onChange={(e) => onFormChange('reason', e.target.value)}
          className={`${fieldClass} min-h-[88px] resize-y`}
          rows="3"
          placeholder="Например: брак, утеря, поломка..."
        />
      </div>
    )}
  </Modal>
);

export default StockOutModal;
