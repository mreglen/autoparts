import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { Skeleton } from '../UI';
import { apiRequest } from '../../utils/apiClient';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import { SHOP_PART_UNIT_LABELS } from '../../utils/repairOrderShopPartUtils';
import AutoserviceWarehouseReturnModal from './AutoserviceWarehouseReturnModal';

const inlineInputClass =
  'block w-full min-w-0 rounded-md border border-line bg-white px-2 py-1 text-xs leading-tight text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 disabled:bg-surface-subtle';
const inlineQtyClass =
  'w-14 shrink-0 rounded-md border border-line bg-white px-2 py-1 text-right text-xs tabular-nums text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 disabled:bg-surface-subtle';
const inlineSelectClass =
  'shrink-0 min-w-[3.5rem] rounded-md border border-line bg-white py-1 pl-2 pr-7 text-xs leading-tight text-ink focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500/20 disabled:bg-surface-subtle';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function toDateInputValue(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatMoneyInput(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  return String(n);
}

function lineDraftFromRow(line) {
  return {
    brand: line.brand || '',
    article: line.article || '',
    name: line.name || '',
    quantity: String(line.quantity ?? 1),
    unit: line.unit || 'pcs',
    unit_price: formatMoneyInput(line.unit_price),
  };
}

function isPurchaseReceiptLine(line) {
  return line?.cart_item_type === 'new' || line?.cart_item_type === 'used';
}

function MetaItem({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function ReceiptLineRow({
  line,
  isEditing,
  saving,
  onStartEdit,
  onCancelEdit,
  onSave,
  onReturn,
}) {
  const [draft, setDraft] = useState(() => lineDraftFromRow(line));

  useEffect(() => {
    if (!isEditing) {
      setDraft(lineDraftFromRow(line));
    }
  }, [isEditing, line]);

  const lineTotalPreview = useMemo(() => {
    const price = Number(draft.unit_price);
    const qty = Number(draft.quantity);
    if (Number.isNaN(price) || Number.isNaN(qty)) return line.line_total;
    return price * qty;
  }, [draft.unit_price, draft.quantity, line.line_total]);

  const qtyStep = draft.unit === 'pcs' ? '1' : '0.001';

  const patchDraft = (key, value) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  if (isEditing) {
    return (
      <tr className="bg-brand-50/30 text-xs text-ink-soft">
        <td className="px-2 py-2">
          <input
            type="text"
            className={inlineInputClass}
            value={draft.brand}
            onChange={(e) => patchDraft('brand', e.target.value)}
            disabled={saving}
          />
        </td>
        <td className="px-2 py-2">
          <input
            type="text"
            className={`${inlineInputClass} font-mono`}
            value={draft.article}
            onChange={(e) => patchDraft('article', e.target.value)}
            disabled={saving}
          />
        </td>
        <td className="max-w-[11rem] px-2 py-2">
          <input
            type="text"
            className={inlineInputClass}
            value={draft.name}
            onChange={(e) => patchDraft('name', e.target.value)}
            disabled={saving}
            required
          />
        </td>
        <td className="px-2 py-2 text-right tabular-nums">
          <div className="inline-flex items-center justify-end gap-1.5">
            <input
              type="number"
              min={draft.unit === 'pcs' ? 1 : 0.001}
              step={qtyStep}
              className={inlineQtyClass}
              value={draft.quantity}
              disabled={saving}
              onChange={(e) => patchDraft('quantity', e.target.value)}
            />
            <select
              className={inlineSelectClass}
              value={draft.unit}
              disabled={saving}
              onChange={(e) => patchDraft('unit', e.target.value)}
              aria-label="Единица измерения"
            >
              {Object.entries(SHOP_PART_UNIT_LABELS).map(([unit, label]) => (
                <option key={unit} value={unit}>{label}</option>
              ))}
            </select>
          </div>
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">
          <input
            type="number"
            min={0}
            step="0.01"
            className={`${inlineInputClass} w-20 text-right tabular-nums`}
            value={draft.unit_price}
            disabled={saving}
            onChange={(e) => patchDraft('unit_price', e.target.value)}
          />
        </td>
        <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums font-semibold text-ink">
          {formatAutoserviceWarehouseMoney(lineTotalPreview)}
        </td>
        <td className="px-2 py-2">
          <div className="flex justify-end gap-1.5">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={saving}
              onClick={onCancelEdit}
            >
              Отмена
            </Button>
            <Button
              type="button"
              size="sm"
              loading={saving}
              onClick={() => onSave(draft)}
            >
              Сохранить
            </Button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="text-ink-soft hover:bg-surface-muted/60">
      <td className="px-4 py-3">{line.brand || '—'}</td>
      <td className="px-4 py-3 font-mono text-ink-muted">{line.article || '—'}</td>
      <td className="max-w-[14rem] px-4 py-3 text-ink">{line.name || '—'}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        {line.quantity}{' '}
        <span className="text-ink-muted">
          {SHOP_PART_UNIT_LABELS[line.unit || 'pcs'] || line.unit || 'шт.'}
        </span>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {formatAutoserviceWarehouseMoney(line.unit_price)}
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold text-ink">
        {formatAutoserviceWarehouseMoney(line.line_total)}
      </td>
      <td className="px-4 py-3 text-right">
        <div className="flex flex-wrap items-center justify-end gap-1.5">
          {isPurchaseReceiptLine(line) ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => onReturn(line)}
            >
              Вернуть поставщику
            </Button>
          ) : null}
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onStartEdit}
          >
            Редактировать
          </Button>
        </div>
      </td>
    </tr>
  );
}

export default function AutoserviceReceiptDocumentModal({ docId, onClose, onUpdated }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingLineId, setSavingLineId] = useState(null);
  const [editingLineId, setEditingLineId] = useState(null);
  const [returnReceiptId, setReturnReceiptId] = useState(null);
  const [docDateDraft, setDocDateDraft] = useState('');
  const [savingDocDate, setSavingDocDate] = useState(false);

  const loadDoc = useCallback(async () => {
    if (!docId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/warehouse/receipts/${docId}`);
      setDoc(data);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить документ');
    } finally {
      setLoading(false);
    }
  }, [docId]);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  useEffect(() => {
    if (!docId) {
      setEditingLineId(null);
      setDocDateDraft('');
    }
  }, [docId]);

  useEffect(() => {
    if (doc?.doc_date) {
      setDocDateDraft(toDateInputValue(doc.doc_date));
    }
  }, [doc?.doc_date]);

  const docDateChanged = Boolean(
    doc?.doc_date
    && docDateDraft
    && docDateDraft !== toDateInputValue(doc.doc_date),
  );

  const saveDocDate = useCallback(async () => {
    if (!docId || !docDateDraft) return;
    setSavingDocDate(true);
    setError('');
    try {
      const data = await apiRequest(`/autoservice/warehouse/receipts/${docId}`, {
        method: 'PATCH',
        body: JSON.stringify({ doc_date: docDateDraft }),
      });
      setDoc(data);
      onUpdated?.();
    } catch (err) {
      setError(err?.message || 'Не удалось изменить дату поступления');
    } finally {
      setSavingDocDate(false);
    }
  }, [docId, docDateDraft, onUpdated]);

  const saveLineEdit = useCallback(async (line, draft) => {
    if (!docId) return;
    const name = String(draft.name ?? '').trim();
    if (!name) {
      throw new Error('Укажите наименование');
    }
    const priceRaw = String(draft.unit_price ?? '').trim();
    if (!priceRaw) {
      throw new Error('Укажите цену');
    }
    const qtyRaw = String(draft.quantity ?? '').trim();
    if (!qtyRaw) {
      throw new Error('Укажите количество');
    }
    const qtyNum = Number(qtyRaw);
    if (Number.isNaN(qtyNum) || qtyNum <= 0) {
      throw new Error('Укажите количество');
    }
    if ((draft.unit || 'pcs') === 'pcs' && !Number.isInteger(qtyNum)) {
      throw new Error('Количество в штуках должно быть целым числом');
    }

    setSavingLineId(line.id);
    setError('');
    try {
      const data = await apiRequest(
        `/autoservice/warehouse/receipts/${docId}/lines/${line.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify({
            brand: draft.brand ?? '',
            article: draft.article ?? '',
            name,
            quantity: qtyNum,
            unit: draft.unit || 'pcs',
            unit_price: Number(priceRaw),
          }),
        },
      );
      setDoc(data);
      setEditingLineId(null);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить изменения');
      throw err;
    } finally {
      setSavingLineId(null);
    }
  }, [docId]);

  return (
    <Modal
      open={Boolean(docId)}
      onClose={onClose}
      title={doc?.number ? `Поступление ${doc.number}` : 'Поступление'}
      size="xl"
      closeVariant="back"
    >
      {loading ? (
        <div className="space-y-4 py-2">
          <Skeleton className="h-20 w-full rounded-sg-lg" />
          <Skeleton className="h-48 w-full rounded-sg-lg" />
        </div>
      ) : doc ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
              {error}
            </div>
          ) : null}

          <dl className="grid gap-4 rounded-sg-lg border border-line bg-surface-subtle/60 px-4 py-4 sm:grid-cols-2 lg:grid-cols-3 sm:px-5">
            <MetaItem label="Номер">{doc.number}</MetaItem>
            <div className="min-w-0">
              <dt className="text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Дата</dt>
              <dd className="mt-1">
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="date"
                    className={inlineInputClass}
                    value={docDateDraft}
                    disabled={savingDocDate}
                    onChange={(e) => setDocDateDraft(e.target.value)}
                  />
                  {docDateChanged ? (
                    <Button
                      type="button"
                      size="sm"
                      loading={savingDocDate}
                      onClick={saveDocDate}
                    >
                      Сохранить
                    </Button>
                  ) : null}
                </div>
              </dd>
            </div>
            <MetaItem label="Поставщик">{doc.supplier_name}</MetaItem>
            {doc.repair_order_number ? (
              <MetaItem label="Заказ-наряд">№ {doc.repair_order_number}</MetaItem>
            ) : null}
            {doc.creator_name ? (
              <MetaItem label="Создал">{doc.creator_name}</MetaItem>
            ) : null}
          </dl>

          <div className="overflow-x-auto rounded-sg-lg border border-line bg-surface">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-surface-muted text-xs font-semibold uppercase tracking-wide text-ink-muted">
                <tr>
                  <th className="px-4 py-3">Бренд</th>
                  <th className="px-4 py-3">Артикул</th>
                  <th className="px-4 py-3">Наименование</th>
                  <th className="px-4 py-3 text-right">Кол-во / ед.</th>
                  <th className="px-4 py-3 text-right">Цена</th>
                  <th className="px-4 py-3 text-right">Сумма</th>
                  <th className="px-4 py-3 text-right" aria-label="Действия" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(doc.lines || []).map((line) => (
                  <ReceiptLineRow
                    key={line.id}
                    line={line}
                    isEditing={editingLineId === line.id}
                    saving={savingLineId === line.id}
                    onStartEdit={() => setEditingLineId(line.id)}
                    onCancelEdit={() => setEditingLineId(null)}
                    onSave={(draft) => saveLineEdit(line, draft).catch(() => {})}
                    onReturn={(targetLine) => setReturnReceiptId(targetLine.id)}
                  />
                ))}
              </tbody>
              <tfoot className="border-t border-line bg-surface-muted/60">
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-3 text-right text-sm font-semibold text-ink-soft"
                  >
                    Итого
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-ink">
                    {formatAutoserviceWarehouseMoney(doc.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
          <AutoserviceWarehouseReturnModal
            receiptId={returnReceiptId}
            onClose={() => setReturnReceiptId(null)}
            onCreated={loadDoc}
          />
        </div>
      ) : error ? (
        <div className="rounded-sg border border-danger-200 bg-danger-50 px-4 py-3 text-sm text-danger-800">
          {error}
        </div>
      ) : null}
    </Modal>
  );
}
