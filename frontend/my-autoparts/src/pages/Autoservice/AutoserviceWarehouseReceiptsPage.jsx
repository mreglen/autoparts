import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import AutoserviceLiveSearchField from '../../components/Autoservice/AutoserviceLiveSearchField';
import AutoserviceListRefreshButton from '../../components/Autoservice/AutoserviceListRefreshButton';
import { ConfirmDialog, Skeleton } from '../../components/UI';
import { useAuthReady } from '../../hooks/useAuthReady';
import { userHasAutoserviceOrganization } from '../../utils/sellerAutoserviceMode';
import { formatAutoserviceWarehouseMoney } from '../../utils/autoserviceWarehouseUi';
import AutoserviceReceiptDocumentModal from '../../components/Autoservice/AutoserviceReceiptDocumentModal';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListErrorClass,
  autoserviceListHeaderSubtitleClass,
  autoserviceListHeaderTitleClass,
  autoserviceListMobileWrapClass,
  autoserviceListPageClass,
  autoserviceListTableClass,
  autoserviceListTableWrapClass,
  autoserviceListTbodyClass,
  autoserviceListTdActionsClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
  autoserviceListThActionsClass,
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
  const docLabel = row.repair_order_number
    ? `Заказ-наряд ${row.repair_order_number}`
    : row.doc_number
      ? `№ ${row.doc_number}`
      : '—';
  return (
    <button type="button" onClick={onOpen} className="w-full border-b border-line-soft py-2 text-left last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <span className="min-w-0 flex-1 truncate font-medium text-ink">{row.name || '—'}</span>
        <span className="shrink-0 tabular-nums font-semibold text-ink">
          {formatAutoserviceWarehouseMoney(row.line_total)}
        </span>
      </div>
      <p className="mt-1 text-xs text-ink-muted">
        {formatDate(row.doc_date)}
        {' · '}
        {row.quantity} {row.unit === 'pcs' ? 'шт.' : row.unit}
      </p>
      <p className="mt-0.5 text-xs text-ink-muted truncate">
        {docLabel}
      </p>
    </button>
  );
}

export default function AutoserviceWarehouseReceiptsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [deleteDoc, setDeleteDoc] = useState(null);
  const [deletingDocId, setDeletingDocId] = useState(null);

  const loadRows = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/warehouse/receipts/lines');
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

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/autoservice/warehouse/receipts') {
        loadRows();
      }
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadRows]);

  const filteredRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => [row.doc_number, row.name, row.supplier_name, row.repair_order_number]
      .some((value) => String(value || '').toLowerCase().includes(q)));
  }, [rows, searchQuery]);

  const handleDeleteConfirm = useCallback(async () => {
    if (!deleteDoc) return;
    setDeletingDocId(deleteDoc.id);
    setError('');
    try {
      await apiRequest(`/autoservice/warehouse/receipts/${deleteDoc.id}`, { method: 'DELETE' });
      setDeleteDoc(null);
      if (selectedDocId === deleteDoc.id) setSelectedDocId(null);
      await loadRows();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить поступление');
    } finally {
      setDeletingDocId(null);
    }
  }, [deleteDoc, loadRows, selectedDocId]);

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !userHasAutoserviceOrganization(user)) return null;

  return (
    <div className={autoserviceListPageClass}>
      <div className="mb-4 flex flex-col gap-3 sm:mb-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className={autoserviceListHeaderTitleClass}>Поступления</h1>
          <p className={autoserviceListHeaderSubtitleClass}>
            {loading ? 'Загрузка…' : `${filteredRows.length} позиций`}
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <AutoserviceLiveSearchField
          value={searchQuery}
          onChange={setSearchQuery}
          placeholder="Поиск по товару или заказ-наряду"
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
              <th className={`w-28 ${autoserviceListThClass}`}>Дата</th>
              <th className={`min-w-0 ${autoserviceListThClass}`}>Наименование</th>
              <th className={`w-20 whitespace-nowrap ${autoserviceListThRightClass}`}>Кол-во</th>
              <th className={`w-24 whitespace-nowrap ${autoserviceListThRightClass}`}>Сумма</th>
              <th className={`w-40 pl-3 text-center ${autoserviceListThClass}`}>Документ</th>
            </tr>
          </thead>
          <tbody className={autoserviceListTbodyClass}>
            {loading ? (
              Array.from({ length: 6 }).map((_, index) => (
                <tr key={`sk-${index}`}>
                  <td className={autoserviceListTdClass}><Skeleton className="h-4 w-24" /></td>
                  <td className={`min-w-0 ${autoserviceListTdClass}`}><Skeleton className="h-4 w-40" /></td>
                  <td className={`w-20 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-10" /></td>
                  <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass}`}><Skeleton className="ml-auto h-4 w-16" /></td>
                  <td className={`w-40 pl-3 ${autoserviceListTdClass} truncate text-center`}><Skeleton className="mx-auto h-4 w-20" /></td>
                </tr>
              ))
            ) : filteredRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-12 text-center text-ink-muted">
                  Позиций пока нет
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => (
                <tr
                  key={row.id}
                  className={autoserviceListTrClickableClass}
                  onClick={() => setSelectedDocId(row.doc_id)}
                >
                  <td className={`${autoserviceListTdClass} whitespace-nowrap`}>{formatDate(row.doc_date)}</td>
                  <td className={`min-w-0 ${autoserviceListTdClass}`}>
                    <div className="w-0 min-w-full truncate font-medium text-ink">{row.name || '—'}</div>
                  </td>
                  <td className={`w-20 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums`}>
                    {row.quantity} {row.unit === 'pcs' ? 'шт.' : row.unit}
                  </td>
                  <td className={`w-24 whitespace-nowrap ${autoserviceListTdRightClass} tabular-nums font-semibold`}>
                    {formatAutoserviceWarehouseMoney(row.line_total)}
                  </td>
                  <td className={`w-40 pl-3 ${autoserviceListTdClass} truncate text-center`}>
                    {row.repair_order_number
                      ? `Заказ-наряд ${row.repair_order_number}`
                      : row.doc_number
                        ? `№ ${row.doc_number}`
                        : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className={autoserviceListMobileWrapClass}>
        {loading ? (
          <div className="divide-y divide-line-soft">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={`msk-${index}`} className="border-b border-line-soft py-2 last:border-b-0">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="mt-1 h-4 w-40" />
              </div>
            ))}
          </div>
        ) : filteredRows.length === 0 ? (
          <p className="py-10 text-center text-sm text-ink-muted">Позиций пока нет</p>
        ) : (
          filteredRows.map((row) => (
            <ReceiptMobileCard
              key={row.id}
              row={row}
              onOpen={() => setSelectedDocId(row.doc_id)}
            />
          ))
        )}
      </div>

      <AutoserviceReceiptDocumentModal
        docId={selectedDocId}
        onClose={() => setSelectedDocId(null)}
        onUpdated={loadRows}
        onDeleteRequest={(doc) => setDeleteDoc(doc)}
        deleting={Boolean(deletingDocId)}
      />

      <ConfirmDialog
        open={Boolean(deleteDoc)}
        onClose={() => {
          if (!deletingDocId) setDeleteDoc(null);
        }}
        onConfirm={handleDeleteConfirm}
        title="Удалить поступление?"
        message={
          deleteDoc
            ? `Поступление ${deleteDoc.number} будет удалено вместе с записями на складе, как будто его не было.`
            : ''
        }
        confirmLabel="Удалить"
        danger
        loading={Boolean(deletingDocId)}
      />
    </div>
  );
}
