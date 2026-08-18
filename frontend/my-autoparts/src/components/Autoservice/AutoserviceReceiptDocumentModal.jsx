import React, { useCallback, useEffect, useState } from 'react';
import Modal from '../UI/Modal';
import { Skeleton } from '../UI';
import { apiRequest } from '../../utils/apiClient';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function MetaItem({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

export default function AutoserviceReceiptDocumentModal({ docId, onClose }) {
  const [doc, setDoc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : doc ? (
        <div className="space-y-5">
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

          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-gray-50 text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Бренд</th>
                  <th className="px-4 py-3">Артикул</th>
                  <th className="px-4 py-3">Наименование</th>
                  <th className="px-4 py-3 text-right">Кол-во</th>
                  <th className="px-4 py-3 text-right">Цена</th>
                  <th className="px-4 py-3 text-right">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {(doc.lines || []).map((line) => (
                  <tr key={line.id} className="text-gray-800">
                    <td className="px-4 py-3">{line.brand || '—'}</td>
                    <td className="px-4 py-3 font-mono text-gray-600">{line.article || '—'}</td>
                    <td className="px-4 py-3">{line.name || '—'}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{line.quantity} шт.</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {formatAutoserviceWarehouseMoney(line.unit_price)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums font-semibold">
                      {formatAutoserviceWarehouseMoney(line.line_total)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-gray-200 bg-gray-50">
                <tr>
                  <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-gray-700">
                    Итого
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-gray-900">
                    {formatAutoserviceWarehouseMoney(doc.total_amount)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}
