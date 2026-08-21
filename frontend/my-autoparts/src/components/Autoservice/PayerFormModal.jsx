import { useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import AutoservicePayerRequisitesFields from './AutoservicePayerRequisitesFields';
import { apiRequest } from '../../utils/apiClient';
import {
  emptyPayerRequisites,
  payerRequisitesPayload,
  validatePayerRequisites,
} from '../../utils/autoservicePayerRequisites';

const btnPrimary =
  'inline-flex h-10 items-center justify-center rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60';

const btnGhost =
  'inline-flex h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 transition hover:bg-gray-50';

export default function PayerFormModal({
  open,
  mode = 'create',
  payer,
  initialForm,
  onClose,
  onSaved,
}) {
  const [form, setForm] = useState(emptyPayerRequisites());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setForm({
      ...emptyPayerRequisites(payer),
      ...(initialForm || {}),
    });
    setError('');
    setSaving(false);
  }, [payer, mode, open, initialForm]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    const validationError = validatePayerRequisites(form);
    if (validationError) {
      setError(validationError);
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = payerRequisitesPayload(form);
      const saved = mode === 'create'
        ? await apiRequest('/autoservice/payers', {
            method: 'POST',
            body: JSON.stringify(payload),
          })
        : await apiRequest(`/autoservice/payers/${payer.id}`, {
            method: 'PATCH',
            body: JSON.stringify(payload),
          });
      await onSaved?.(saved);
      onClose?.();
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'create' ? 'Новый плательщик' : 'Изменить плательщика'}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className={btnGhost} disabled={saving}>
            Отмена
          </button>
          <button type="submit" form="payer-form" disabled={saving} className={btnPrimary}>
            {saving ? '…' : 'Сохранить'}
          </button>
        </div>
      }
    >
      <form id="payer-form" onSubmit={handleSubmit}>
        <AutoservicePayerRequisitesFields form={form} onChange={setForm} disabled={saving} />
        {error ? <p className="mt-3 text-sm text-red-600">{error}</p> : null}
      </form>
    </Modal>
  );
}
