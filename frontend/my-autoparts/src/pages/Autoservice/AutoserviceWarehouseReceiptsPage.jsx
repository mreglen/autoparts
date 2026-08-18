import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import AutoserviceReceiptDocumentModal from '../../components/Autoservice/AutoserviceReceiptDocumentModal';
import {
  warehousePageClass,
  warehousePillControlClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

export default function AutoserviceWarehouseReceiptsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/warehouse/receipts');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить поступления');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    if (!userHasAutoserviceOrganization(user)) return;
    loadRows();
  }, [isReady, isAuthenticated, user, loadRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.number, row.supplier_name, row.repair_order_number, row.creator_name]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [rows, searchQuery]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !userHasAutoserviceOrganization(user)) return null;

  return (
    <div className={warehousePageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Поступления</h1>
          <p className="mt-1 text-sm text-gray-500">Документы поступления на склад автосервиса</p>
        </div>
        <button
          type="button"
          onClick={loadRows}
          className="inline-flex min-h-10 items-center justify-center rounded-lg border border-gray-300 bg-white px-4 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Обновить
        </button>
      </div>

      <div className={`${warehouseToolbarClass} mb-4`}>
        <input
          type="search"
          value={searchQuery}
          onChange={(event) => setSearchQuery(event.target.value)}
          placeholder="Поиск по номеру или поставщику"
          className={`${warehousePillControlClass} sm:max-w-md`}
        />
      </div>

      {error ? (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-xl border border-gray-200 bg-white px-6 py-12 text-center text-sm text-gray-500">
          Загрузка…
        </div>
      ) : filteredRows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-300 bg-white px-6 py-14 text-center">
          <p className="text-sm text-gray-600">Поступлений пока нет</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
              <tr>
                <th className="px-4 py-3">Номер</th>
                <th className="px-4 py-3">Дата</th>
                <th className="px-4 py-3">Поставщик</th>
                <th className="px-4 py-3 text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className="cursor-pointer text-gray-800 hover:bg-gray-50"
                  onClick={() => setSelectedDocId(row.id)}
                >
                  <td className="px-4 py-3 font-medium text-indigo-700">{row.number}</td>
                  <td className="px-4 py-3 whitespace-nowrap">{formatDate(row.doc_date)}</td>
                  <td className="px-4 py-3">{row.supplier_name}</td>
                  <td className="px-4 py-3 text-right tabular-nums font-semibold">
                    {formatAutoserviceWarehouseMoney(row.total_amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AutoserviceReceiptDocumentModal
        docId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
      />
    </div>
  );
}
