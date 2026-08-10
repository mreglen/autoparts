import { useCallback, useEffect, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { formatServerDateTime } from '../../utils/serverDate';

const inputClass =
  'mt-1 block w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const wideInputClass = inputClass;

function LiftStatsModal({ lift, stats, loading, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/40" aria-label="Закрыть" onClick={onClose} />
      <div className="relative max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-xl ring-1 ring-gray-200">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h3 className="text-lg font-semibold text-gray-900">{lift?.name || 'Подъёмник'}</h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть"
          >
            ×
          </button>
        </div>
        <div className="space-y-4 p-5">
          {loading ? (
            <p className="text-sm text-gray-500">Загрузка статистики…</p>
          ) : stats ? (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs uppercase text-gray-500">Заказов</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total_orders}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs uppercase text-gray-500">Часов</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.total_hours}</p>
                </div>
                <div className="rounded-xl border border-gray-200 p-3">
                  <p className="text-xs uppercase text-gray-500">Без окончания</p>
                  <p className="text-2xl font-semibold text-gray-900">{stats.orders_without_end_time}</p>
                </div>
              </div>
              {Object.keys(stats.orders_by_status || {}).length > 0 ? (
                <div>
                  <p className="text-sm font-medium text-gray-700">По статусам</p>
                  <ul className="mt-2 space-y-1 text-sm text-gray-600">
                    {Object.entries(stats.orders_by_status).map(([status, count]) => (
                      <li key={status}>{status}: {count}</li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {stats.recent_orders?.length ? (
                <div>
                  <p className="text-sm font-medium text-gray-700">Последние заказы</p>
                  <ul className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200">
                    {stats.recent_orders.map((order) => (
                      <li key={order.id} className="px-3 py-2 text-sm">
                        <div className="font-medium text-gray-900">{order.order_number}</div>
                        <div className="text-gray-600">
                          {formatServerDateTime(order.scheduled_at)}
                          {order.scheduled_end_at
                            ? ` — ${formatServerDateTime(order.scheduled_end_at)}`
                            : ' · Окончание не указано'}
                        </div>
                        <div className="text-gray-500">{order.client_name} · {order.vehicle}</div>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </>
          ) : (
            <p className="text-sm text-gray-500">Статистика недоступна</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AutoserviceSettingsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [publicName, setPublicName] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [lifts, setLifts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [liftsLoading, setLiftsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');
  const [editingLiftId, setEditingLiftId] = useState(null);
  const [editingName, setEditingName] = useState('');
  const [actionMenuId, setActionMenuId] = useState(null);
  const [statsLift, setStatsLift] = useState(null);
  const [statsData, setStatsData] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  const loadSettings = useCallback(async () => {
    const data = await apiRequest('/autoservice/settings');
    setPublicName(data?.public_name || '');
    setPublicDescription(data?.public_description || '');
  }, []);

  const loadLifts = useCallback(async () => {
    setLiftsLoading(true);
    try {
      const data = await apiRequest('/autoservice/lifts?include_archived=true');
      setLifts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить подъёмники');
    } finally {
      setLiftsLoading(false);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadSettings(), loadLifts()]);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, [loadSettings, loadLifts]);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedMessage('');
    try {
      const data = await apiRequest('/autoservice/settings', {
        method: 'PUT',
        body: JSON.stringify({
          public_name: publicName.trim() || null,
          public_description: publicDescription.trim() || null,
        }),
      });
      setPublicName(data?.public_name || '');
      setPublicDescription(data?.public_description || '');
      setSavedMessage('Сохранено');
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  const handleAddLift = async () => {
    setError('');
    try {
      await apiRequest('/autoservice/lifts', { method: 'POST', body: JSON.stringify({}) });
      await loadLifts();
    } catch (err) {
      setError(err?.message || 'Не удалось добавить подъёмник');
    }
  };

  const startRename = (lift) => {
    setEditingLiftId(lift.id);
    setEditingName(lift.name);
    setActionMenuId(null);
  };

  const saveRename = async (liftId) => {
    const name = editingName.trim();
    if (!name) return;
    try {
      await apiRequest(`/autoservice/lifts/${liftId}`, {
        method: 'PATCH',
        body: JSON.stringify({ name }),
      });
      setEditingLiftId(null);
      await loadLifts();
    } catch (err) {
      setError(err?.message || 'Не удалось переименовать');
    }
  };

  const removeLift = async (liftId) => {
    setActionMenuId(null);
    if (!window.confirm('Удалить или архивировать подъёмник?')) return;
    try {
      await apiRequest(`/autoservice/lifts/${liftId}`, { method: 'DELETE' });
      await loadLifts();
    } catch (err) {
      setError(err?.message || 'Не удалось удалить');
    }
  };

  const openStats = async (lift) => {
    setStatsLift(lift);
    setStatsData(null);
    setStatsLoading(true);
    setActionMenuId(null);
    try {
      const data = await apiRequest(`/autoservice/lifts/${lift.id}/stats`);
      setStatsData(data);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить статистику');
    } finally {
      setStatsLoading(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="text-2xl font-bold text-gray-900">Настройки автосервиса</h1>
      <p className="mt-1 text-sm text-gray-500">Параметры организации для записей и слотов</p>

      {error && (
        <p className="mt-4 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
      {savedMessage && !error && (
        <p className="mt-4 text-sm text-emerald-700" role="status">
          {savedMessage}
        </p>
      )}

      {loading ? (
        <p className="mt-8 text-sm text-gray-500">Загрузка…</p>
      ) : (
        <>
          <form onSubmit={handleSave} className="mt-8 space-y-6">
            <div>
              <label htmlFor="public_name" className="block text-sm font-medium text-gray-700">
                Название автосервиса
              </label>
              <input
                id="public_name"
                value={publicName}
                onChange={(ev) => setPublicName(ev.target.value)}
                maxLength={160}
                className={wideInputClass}
              />
            </div>
            <div>
              <label htmlFor="public_description" className="block text-sm font-medium text-gray-700">
                Описание
              </label>
              <textarea
                id="public_description"
                rows={3}
                value={publicDescription}
                onChange={(ev) => setPublicDescription(ev.target.value)}
                maxLength={2000}
                className={wideInputClass}
              />
            </div>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center justify-center rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </form>

          <section className="mt-10 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Подъёмники</h2>
                <p className="text-sm text-gray-500">Управление рабочими местами организации</p>
              </div>
              <button
                type="button"
                onClick={handleAddLift}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Добавить подъёмник
              </button>
            </div>

            <div className="mt-4 overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Название</th>
                    <th className="px-4 py-3">Статус</th>
                    <th className="px-4 py-3 text-right">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {liftsLoading ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Загрузка…</td>
                    </tr>
                  ) : lifts.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="px-4 py-8 text-center text-gray-500">Подъёмников пока нет</td>
                    </tr>
                  ) : (
                    lifts.map((lift) => (
                      <tr
                        key={lift.id}
                        className="hover:bg-gray-50/80"
                        onDoubleClick={() => openStats(lift)}
                      >
                        <td className="px-4 py-3">
                          {editingLiftId === lift.id ? (
                            <input
                              className="w-full rounded-lg border border-gray-300 px-2 py-1"
                              value={editingName}
                              onChange={(e) => setEditingName(e.target.value)}
                              onBlur={() => saveRename(lift.id)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') saveRename(lift.id);
                                if (e.key === 'Escape') setEditingLiftId(null);
                              }}
                              autoFocus
                            />
                          ) : (
                            <span className="font-medium text-gray-900">{lift.name}</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {lift.is_active ? (
                            <span className="inline-flex rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-800 ring-1 ring-inset ring-emerald-200">
                              Активен
                            </span>
                          ) : (
                            <span className="inline-flex rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600 ring-1 ring-inset ring-gray-200">
                              Архив
                            </span>
                          )}
                        </td>
                        <td className="relative px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setActionMenuId(actionMenuId === lift.id ? null : lift.id)}
                            className="rounded-lg px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-50"
                          >
                            Действия
                          </button>
                          {actionMenuId === lift.id ? (
                            <div className="absolute right-4 z-10 mt-1 w-44 rounded-xl border border-gray-200 bg-white py-1 text-left shadow-lg">
                              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => startRename(lift)}>Переименовать</button>
                              <button type="button" className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50" onClick={() => openStats(lift)}>Просмотреть</button>
                              <button type="button" className="block w-full px-3 py-2 text-left text-sm text-red-700 hover:bg-red-50" onClick={() => removeLift(lift.id)}>Удалить</button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {statsLift ? (
        <LiftStatsModal
          lift={statsLift}
          stats={statsData}
          loading={statsLoading}
          onClose={() => {
            setStatsLift(null);
            setStatsData(null);
          }}
        />
      ) : null}
    </div>
  );
}
