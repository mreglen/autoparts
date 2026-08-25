import React, { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';

const RejectProductModal = ({ isOpen, onClose, onReject, productName }) => {
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOpen) setReason('');
  }, [isOpen]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onReject(reason.trim());
    setReason('');
  };

  return (
    <Modal
      open={isOpen}
      onClose={onClose}
      title="Отклонить запчасть"
      size="sm"
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" className="w-full sm:w-auto" onClick={onClose}>
            Отмена
          </Button>
          <Button type="submit" form="reject-product-form" variant="danger" className="w-full sm:w-auto">
            Отклонить
          </Button>
        </div>
      )}
    >
      {productName ? (
        <div className="mb-4 rounded-lg bg-gray-50 p-3">
          <p className="text-sm text-gray-600">Запчасть:</p>
          <p className="font-medium text-gray-900">{productName}</p>
        </div>
      ) : null}

      <form id="reject-product-form" onSubmit={handleSubmit}>
        <label htmlFor="reject-product-reason" className="mb-2 block text-sm font-medium text-gray-700">
          Комментарий (необязательно)
        </label>
        <textarea
          id="reject-product-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={4}
          className="w-full min-h-[6rem] rounded-xl border border-gray-300 px-3 py-2 text-sm max-md:text-base focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
          placeholder="Укажите причину отклонения, если нужно..."
        />
      </form>
    </Modal>
  );
};

export default RejectProductModal;
