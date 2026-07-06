import { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import InventorySessionCard from '../../components/Warehouse/InventorySessionCard';
import InventoryWizard from '../../components/Warehouse/InventoryWizard';
import { useAuthReady } from '../../hooks/useAuthReady';
import { fetchStorageLocations } from '../../redux/slices/OrganizationSlice';
import { apiRequest } from '../../utils/apiClient';
import { canCreateInventory, canViewInventory } from '../../utils/inventoryAccess';
import { useShowWarehouseInventory } from '../../utils/siteReviewsPublic';

export default function WmsStoragesPage() {
  const dispatch = useDispatch();
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((state) => state.auth.permissionCodes);
  const showWarehouseInventory = useShowWarehouseInventory();

  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [wizardOpen, setWizardOpen] = useState(false);

  const canView = showWarehouseInventory && canViewInventory(user, permissionCodes);
  const canCreate = showWarehouseInventory && canCreateInventory(user, permissionCodes);

  const loadSessions = useCallback(async () => {
    if (!canView) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/inventory/sessions', { method: 'GET' });
      setSessions(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить инвентаризации');
    } finally {
      setLoading(false);
    }
  }, [canView]);

  useEffect(() => {
    if (!isReady || !user?.organization_id || !canView) return;
    dispatch(fetchStorageLocations(user.organization_id));
    loadSessions();
  }, [isReady, user?.organization_id, canView, dispatch, loadSessions]);

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!user?.organization_id || !canView) {
    return <Navigate to="/" replace />;
  }

  const activeSessions = sessions.filter((s) => s.status === 'counting' || s.status === 'draft');
  const completedSessions = sessions.filter((s) => s.status === 'completed');

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-0">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <Link to="/settings/storage-addresses" className="text-sm text-indigo-600 hover:underline mb-2 inline-block">
            ← Адресное хранение
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Инвентаризация</h1>
          <p className="text-sm text-gray-600 mt-1">
            Пересчёт остатков на складе с отчётом расхождений и корректировками.
          </p>
        </div>
        {canCreate && (
          <button
            type="button"
            onClick={() => setWizardOpen(true)}
            className="shrink-0 px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
          >
            Новая инвентаризация
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
        </div>
      ) : (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Активные ({activeSessions.length})
            </h2>
            {activeSessions.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-center text-sm text-gray-600">
                Нет активных инвентаризаций.
                {canCreate && (
                  <>
                    {' '}
                    <button
                      type="button"
                      onClick={() => setWizardOpen(true)}
                      className="text-indigo-600 hover:underline"
                    >
                      Создать новую
                    </button>
                  </>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {activeSessions.map((session) => (
                  <InventorySessionCard
                    key={session.id}
                    session={session}
                    onOpen={() => setWizardOpen(true)}
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">
              Завершённые ({completedSessions.length})
            </h2>
            {completedSessions.length === 0 ? (
              <div className="rounded-xl border border-gray-200 bg-white px-4 py-6 text-sm text-gray-500">
                История завершённых инвентаризаций появится здесь.
              </div>
            ) : (
              <div className="space-y-3">
                {completedSessions.map((session) => (
                  <InventorySessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}

      <InventoryWizard
        open={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onCompleted={loadSessions}
      />
    </div>
  );
}
