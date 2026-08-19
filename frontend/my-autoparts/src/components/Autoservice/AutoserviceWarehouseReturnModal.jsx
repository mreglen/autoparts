import { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { apiRequest, apiRequestFormData } from '../../utils/apiClient';

const REASONS = [
  { id: 'defect', label: 'Брак / неисправность' },
  { id: 'wrong_item', label: 'Не тот товар' },
  { id: 'not_as_described', label: 'Не соответствует описанию' },
  { id: 'changed_mind', label: 'Передумали' },
  { id: 'other', label: 'Другое' },
];

export default function AutoserviceWarehouseReturnModal({
  receiptId,
  initialLot = null,
  onClose,
  onCreated,
}) {
  const [lot, setLot] = useState(initialLot);
  const [loading, setLoading] = useState(!initialLot);
  const [quantity, setQuantity] = useState('1');
  const [reason, setReason] = useState('defect');
  const [comment, setComment] = useState('');
  const [photos, setPhotos] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const loadLot = useCallback(async () => {
    if (!receiptId) return;
    setLoading(true);
    setError('');
    try {
      const rows = await apiRequest('/autoservice/warehouse/purchase-lots');
      const found = (rows || []).find((row) => Number(row.receipt_id) === Number(receiptId));
      if (!found) throw new Error('Партия закупки не найдена');
      setLot(found);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить партию');
    } finally {
      setLoading(false);
    }
  }, [receiptId]);

  useEffect(() => {
    setLot(initialLot);
    setQuantity('1');
    setReason('defect');
    setComment('');
    setPhotos([]);
    setError('');
    if (receiptId && !initialLot) loadLot();
  }, [receiptId, initialLot, loadLot]);

  const blockedByRepairOrder = Number(lot?.item_reserved_qty || 0) > 0;
  const maxQty = Number(lot?.max_returnable_qty || 0);
  const title = useMemo(
    () => (lot?.name ? `Возврат: ${lot.name}` : 'Возврат поставщику'),
    [lot],
  );

  const submit = async (event) => {
    event.preventDefault();
    if (!lot) return;
    setSubmitting(true);
    setError('');
    try {
      const photoUrls = [];
      for (const file of photos.slice(0, 5)) {
        const formData = new FormData();
        formData.append('file', file);
        const uploaded = await apiRequestFormData('/upload/media', formData);
        const url = uploaded?.path || uploaded?.url || uploaded?.photo_url;
        if (url) photoUrls.push(url.startsWith('/') ? url : `/${url}`);
      }
      await apiRequest('/autoservice/warehouse/returns', {
        method: 'POST',
        body: JSON.stringify({
          receipt_id: lot.receipt_id,
          quantity: Number(quantity),
          reason,
          comment: comment.trim() || null,
          photo_urls: photoUrls,
        }),
      });
      await onCreated?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Не удалось создать заявку');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal open={Boolean(receiptId)} onClose={onClose} title={title} size="md">
      {loading ? (
        <p className="py-8 text-center text-sm text-gray-500">Загрузка…</p>
      ) : blockedByRepairOrder ? (
        <div className="space-y-4">
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            Сначала удалите товар из заказ-наряда, чтобы снять резерв, затем оформите возврат.
          </div>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>Понятно</Button>
          </div>
        </div>
      ) : lot?.active_return ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">
            По этой партии уже создана заявка №{lot.active_return.id}.
            Статус: {lot.active_return.status_code}.
          </p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>Закрыть</Button>
          </div>
        </div>
      ) : maxQty < 1 ? (
        <div className="space-y-4">
          <p className="text-sm text-gray-700">В этой партии нет доступного количества для возврата.</p>
          <div className="flex justify-end">
            <Button type="button" onClick={onClose}>Закрыть</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-700">
            <p className="font-medium text-gray-900">{lot?.supplier_name}</p>
            <p className="mt-1">Заказ №{lot?.source_order_id} · доступно {maxQty} шт.</p>
          </div>
          <label className="block text-sm font-medium text-gray-700">
            Количество
            <input
              type="number"
              min="1"
              max={maxQty}
              value={quantity}
              onChange={(event) => setQuantity(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
              required
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Причина
            <select
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
            >
              {REASONS.map((item) => (
                <option key={item.id} value={item.id}>{item.label}</option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Комментарий
            <textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5"
            />
          </label>
          <label className="block text-sm font-medium text-gray-700">
            Фото (до 5)
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={(event) => setPhotos(Array.from(event.target.files || []).slice(0, 5))}
              className="mt-1 block w-full text-sm"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={onClose}>Отмена</Button>
            <Button type="submit" loading={submitting}>Создать заявку</Button>
          </div>
        </form>
      )}
      {!loading && error && !lot ? <p className="text-sm text-red-600">{error}</p> : null}
    </Modal>
  );
}
