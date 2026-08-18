import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import { Skeleton } from '../UI';
import { apiRequest } from '../../utils/apiClient';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import { SHOP_PART_UNIT_LABELS } from '../../utils/repairOrderShopPartUtils';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function formatMoneyInput(value) {
  if (value == null || value === '') return '';
  const n = Number(value);
  if (Number.isNaN(n)) return '';
  return String(n);
}

function MetaItem({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

function EditablePriceInput({
  value,
  placeholder,
  saving,
  onSave,
}) {
  const [draft, setDraft] = useState(
    value == null || value === '' ? '' : formatMoneyInput(value),
  );

  useEffect(() => {
    setDraft(value == null || value === '' ? '' : formatMoneyInput(value));
  }, [value]);

  const commit = async () => {
    const trimmed = String(draft ?? '').trim();
    const current = value == null || value === '' ? '' : formatMoneyInput(value);
    if (trimmed === current) return;
    await onSave(trimmed);
  };

  return (
    <input
      type="number"
      min={0}
      step="0.01"
      className="w-full min-w-[5.5rem] rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-right text-sm tabular-nums focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
      value={draft}
      placeholder={placeholder}
      disabled={saving}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={() => { commit().catch(() => {}); }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          e.currentTarget.blur();
        }
      }}
    />
  );
}

function EditableUnitSelect({ value, saving, onSave }) {
  return (
    <select
      className="rounded-lg border border-gray-200 bg-white px-2 py-1.5 text-sm focus:border-indigo-400 focus:outline-none focus:ring-2 focus:ring-indigo-100 disabled:opacity-60"
      value={value || 'pcs'}
      disabled={saving}
      onChange={(e) => {
        const next = e.target.value;
        if (next !== (value || 'pcs')) {
          onSave(next).catch(() => {});
        }
      }}
    >
      {Object.entries(SHOP_PART_UNIT_LABELS).map(([unit, label]) => (
        <option key={unit} value={unit}>{label}</option>
      ))}
    </select>
  );
}

function ReceiptLineRow({ line, hasClientPriceColumn, saving, onSave }) {
  const [purchaseDraft, setPurchaseDraft] = useState(formatMoneyInput(line.unit_price));
  const [clientDraft, setClientDraft] = useState(
    line.client_unit_price_override == null
      ? ''
      : formatMoneyInput(line.client_unit_price_override),
  );

  useEffect(() => {
    setPurchaseDraft(formatMoneyInput(line.unit_price));
    setClientDraft(
      line.client_unit_price_override == null
        ? ''
        : formatMoneyInput(line.client_unit_price_override),
    );
  }, [line.unit_price, line.client_unit_price_override]);

  const showClientColumn = hasClientPriceColumn
    && line.can_edit_price
    && line.automatic_client_unit_price != null;
  const clientPlaceholder = line.automatic_client_unit_price != null
    ? formatMoneyInput(line.automatic_client_unit_price)
    : '';

  return (
    <tr className="text-gray-800">
      <td className="px-4 py-3">{line.brand || '—'}</td>
      <td className="px-4 py-3 font-mono text-gray-600">{line.article || '—'}</td>
      <td className="px-4 py-3">{line.name || '—'}</td>
      <td className="px-4 py-3 text-right tabular-nums">
        <div className="inline-flex items-center justify-end gap-2">
          <span>{line.quantity}</span>
          {line.can_edit_unit ? (
            <EditableUnitSelect
              value={line.unit || 'pcs'}
              saving={saving}
              onSave={async (unit) => {
                await onSave(line, {
                  purchaseRaw: purchaseDraft,
                  clientRaw: clientDraft,
                  unit,
                });
              }}
            />
          ) : (
            <span className="text-gray-500">
              {SHOP_PART_UNIT_LABELS[line.unit || 'pcs'] || line.unit || 'шт.'}
            </span>
          )}
        </div>
      </td>
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
        {line.can_edit_price ? (
          <EditablePriceInput
            value={line.unit_price}
            saving={saving}
            onSave={async (raw) => {
              setPurchaseDraft(raw);
              await onSave(line, { purchaseRaw: raw, clientRaw: clientDraft });
            }}
          />
        ) : (
          formatAutoserviceWarehouseMoney(line.unit_price)
        )}
      </td>
      {hasClientPriceColumn ? (
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
          {showClientColumn ? (
            <EditablePriceInput
              value={line.client_unit_price_override}
              placeholder={clientPlaceholder}
              saving={saving}
              onSave={async (raw) => {
                setClientDraft(raw);
                await onSave(line, { purchaseRaw: purchaseDraft, clientRaw: raw });
              }}
            />
          ) : (
            '—'
          )}
        </td>
      ) : null}
      <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums font-semibold">
        {formatAutoserviceWarehouseMoney(line.line_total)}
      </td>
    </tr>
  );
}

export default function AutoserviceReceiptDocumentModal({ docId, onClose }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [savingLineId, setSavingLineId] = useState(null);

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

  const saveLinePrices = useCallback(async (line, { purchaseRaw, clientRaw, unit }) => {
    if (!docId || (!line?.can_edit_price && !line?.can_edit_unit)) return;
    const body = {};
    if (line.can_edit_price) {
      const currentPurchase = formatMoneyInput(line.unit_price);
      const purchaseTrimmed = String(purchaseRaw ?? '').trim();
      if (purchaseTrimmed !== currentPurchase) {
        if (!purchaseTrimmed) {
          throw new Error('Укажите закупочную цену');
        }
        body.unit_price = Number(purchaseTrimmed);
      }

      const hasClientField = line.automatic_client_unit_price != null;
      if (hasClientField) {
        const currentClient = line.client_unit_price_override == null
          ? ''
          : formatMoneyInput(line.client_unit_price_override);
        const clientTrimmed = String(clientRaw ?? '').trim();
        if (clientTrimmed !== currentClient) {
          if (!clientTrimmed) {
            body.clear_client_unit_price_override = true;
          } else {
            body.client_unit_price_override = Number(clientTrimmed);
          }
        }
      }
    }

    if (unit != null && line.can_edit_unit && unit !== (line.unit || 'pcs')) {
      body.unit = unit;
    }

    if (Object.keys(body).length === 0) return;

    setSavingLineId(line.id);
    setError('');
    try {
      const data = await apiRequest(
        `/autoservice/warehouse/receipts/${docId}/lines/${line.id}`,
        { method: 'PATCH', body: JSON.stringify(body) },
      );
      setDoc(data);
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить цену');
      throw err;
    } finally {
      setSavingLineId(null);
    }
  }, [docId]);

  const hasClientPriceColumn = (doc?.lines || []).some(
    (line) => line.can_edit_price && line.automatic_client_unit_price != null,
  );

  return (
    <Modal
      open={Boolean(docId)}
      onClose={onClose}
      title={doc?.number ? `Поступление ${doc.number}` : 'Поступление'}
      size="lg"
      closeVariant="back"
    >
      {loading ? (
        <div className="space-y-3 py-4">
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : doc ? (
        <div className="space-y-5">
          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              {error}
            </div>
          ) : null}

          <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <MetaItem label="Номер">{doc.number}</MetaItem>
            <MetaItem label="Дата">{formatDate(doc.doc_date)}</MetaItem>
            <MetaItem label="Поставщик">{doc.supplier_name}</MetaItem>
            {doc.repair_order_number ? (
              <MetaItem label="Заказ-наряд">№ {doc.repair_order_number}</MetaItem>
            ) : null}
            {doc.creator_name ? (
              <MetaItem label="Создал">{doc.creator_name}</MetaItem>
            ) : null}
          </dl>

          {doc.supplier_kind === 'manual' ? (
            <p className="text-xs text-gray-500">
              Закупочная цена и единица измерения синхронизируются со складом и заказ-нарядом.
              Если очистить цену для клиента, она рассчитается по закупочной с наценкой.
            </p>
          ) : null}

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Бренд</th>
                  <th className="px-4 py-3">Артикул</th>
                  <th className="px-4 py-3">Наименование</th>
                  <th className="px-4 py-3 text-right">Кол-во / ед.</th>
                  <th className="px-4 py-3 text-right">Закупочная</th>
                  {hasClientPriceColumn ? (
                    <th className="px-4 py-3 text-right">Цена клиента</th>
                  ) : null}
                  <th className="px-4 py-3 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(doc.lines || []).map((line) => (
                  <ReceiptLineRow
                    key={line.id}
                    line={line}
                    hasClientPriceColumn={hasClientPriceColumn}
                    saving={savingLineId === line.id}
                    onSave={saveLinePrices}
                  />
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td
                    colSpan={hasClientPriceColumn ? 6 : 5}
                    className="px-4 py-3 text-right text-sm font-semibold text-gray-700"
                  >
                    Итого
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                    {formatAutoserviceWarehouseMoney(doc.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}
    </Modal>
  );
}
