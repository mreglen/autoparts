import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { PaymentsTable } from './SitePaymentsPage';

export default function SitePaymentsHistoryPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/site-payments?scope=history');
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить историю');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.is_admin) {
      navigate('/', { replace: true });
      return;
    }
    load();
  }, [isReady, user, navigate, load]);

  const upsertRow = (updated) => {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)));
  };

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">История платежей сайта</h1>
          <p className="mt-1 text-sm text-gray-500">Все платежи, включая оплаченные и отменённые. Нажмите на строку для деталей.</p>
        </div>
        <Link
          to="/admin/site-payments"
          className="inline-flex items-center rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-800 shadow-sm hover:bg-gray-50"
        >
          ← К активным
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}
      {loading ? (
        <p className="py-10 text-center text-sm text-gray-500">Загрузка…</p>
      ) : (
        <PaymentsTable
          rows={rows}
          emptyText="Платежей пока нет."
          onRefreshRow={upsertRow}
          clickableRows
        />
      )}
    </div>
  );
}
