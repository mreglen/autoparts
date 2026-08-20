import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AutoserviceListRefreshButton from '../../components/Autoservice/AutoserviceListRefreshButton';
import { Skeleton } from '../../components/UI';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import AutoserviceReceiptDocumentModal from '../../components/Autoservice/AutoserviceReceiptDocumentModal';
import {
  autoserviceListErrorClass,
  autoserviceListHeaderSubtitleClass,
  autoserviceListHeaderTitleClass,
  autoserviceListMobileWrapClass,
  autoserviceListPageClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThClass,
  autoserviceListThRightClass,
  autoserviceListTheadRowClass,
  autoserviceListTrClickableClass,
} from '../../utils/warehouseListUi';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU');
}

function ReceiptMobileCard({ row, onOpen }) {
  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <button type="button" onClick={onOpen} className="w-full text-left">
        <div className="flex items-start justify-between gap-2">
          <span className="font-semibold text-indigo-700">{row.number}</span>
          <span className="shrink-0 tabular-nums font-semibold text-gray-900">
            {formatAutoserviceWarehouseMoney(row.total_amount)}
          </span>
        </div>
        <p className="mt-1 text-sm text-gray-600">
          {formatDate(row.doc_date)}
          {' · '}
          {row.supplier_name}
        </p>
      </button>
    </div>
  );
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
    <div className={autoserviceListPageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={autoserviceListHeaderTitleClass}>Поступления</h1>
          <p className={autoserviceListHeaderSubtitleClass}>
            {loading ? 'Загрузка…' : `${filteredRows.length} документов`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AutoserviceLiveSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск по номеру или поставщику"
          ariaLabel="Поиск поступлений"
        />
        <AutoserviceListRefreshButton loading={loading} onClick={loadRows} />
      </div>

      {error ? (
        <p className={autoserviceListErrorClass} role="alert">
          {error}
        </p>
      ) : null}

      <div className={autoserviceListTableWrapClass}>
        <table className={autoserviceListTableClass}>
          <thead>
            <tr className={autoserviceListTheadRowClass}>
              <th className={`w-32 ${autoserviceListThClass}`}>Номер</th>
              <th className={`w-28 ${autoserviceListThClass}`}>Дата</th>
              <th className={autoserviceListThClass}>Поставщик</th>
              <th className={autoserviceListThRightClass}>Сумма</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`sk-${index}`}>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-20" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-24" /></td>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-40" /></td>
                  <td className={autoserviceListTdRightClass}><Skeleton className="ml-auto h-4 w-20" /></td>
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-12 text-center text-gray-500">
                  Поступлений пока нет
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={autoserviceListTrClickableClass}
                  onClick={() => setSelectedDocId(row.id)}
                >
                  <td className={autoserviceListTdClass}>
                    <span className="font-semibold text-indigo-700">{row.number}</span>
                  </td>
                  <td className={`${autoserviceListTdClass} whitespace-nowrap`}>{formatDate(row.doc_date)}</td>
                  <td className={autoserviceListTdClass}>{row.supplier_name}</td>
                  <td className={`${autoserviceListTdRightClass} tabular-nums font-semibold`}>
                    {formatAutoserviceWarehouseMoney(row.total_amount)}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={autoserviceListMobileWrapClass}>
        {loading ? (
          <div className="divide-y divide-gray-100">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`msk-${index}`} className="py-3">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-2 h-4 w-40" />
              </div>
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-gray-500">Поступлений пока нет</p>
        ) : (
          filteredRows.map((row) => (
            <ReceiptMobileCard key={row.id} row={row} onOpen={() => setSelectedDocId(row.id)} />
          ))
        )}
      </div>

      <AutoserviceReceiptDocumentModal
        docId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onUpdated={loadRows}
      />
    </div>
  );
}
