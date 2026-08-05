import { useCallback, useEffect, useState } from 'react';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';

const inputClass =
  'mt-1 block w-full max-w-xs rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

const wideInputClass =
  'mt-1 block w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

export default function AutoserviceSettingsPage() {
  const { isReady, isAuthenticated, user } = useAuthReady();
  const [liftsCount, setLiftsCount] = useState(0);
  const [publicName, setPublicName] = useState('');
  const [publicDescription, setPublicDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/settings');
      setLiftsCount(typeof data?.lifts_count === 'number' ? data.lifts_count : 0);
      setPublicName(data?.public_name || '');
      setPublicDescription(data?.public_description || '');
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить настройки');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isReady && isAuthenticated) load();
  }, [isReady, isAuthenticated, load]);

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSavedMessage('');
    const value = Number(liftsCount);
    if (!Number.isInteger(value) || value < 0) {
      setError('Количество подъёмников должно быть целым числом ≥ 0');
      setSaving(false);
      return;
    }
    try {
      const data = await apiRequest('/autoservice/settings', {
        method: 'PUT',
        body: JSON.stringify({
          lifts_count: value,
          public_name: publicName.trim() || null,
          public_description: publicDescription.trim() || null,
        }),
      });
      setLiftsCount(typeof data?.lifts_count === 'number' ? data.lifts_count : value);
      setPublicName(data?.public_name || '');
      setPublicDescription(data?.public_description || '');
      setSavedMessage('Сохранено');
    } catch (err) {
      setError(err?.message || 'Не удалось сохранить');
    } finally {
      setSaving(false);
    }
  };

  if (!isReady) return <AuthLoadingScreen />;
  if (!isAuthenticated || !user) return null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
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
          <div>
            <label htmlFor="lifts_count" className="block text-sm font-medium text-gray-700">
              Количество подъёмников
            </label>
            <input
              id="lifts_count"
              type="number"
              min={0}
              step={1}
              value={liftsCount}
              onChange={(ev) => setLiftsCount(ev.target.value === '' ? '' : Number(ev.target.value))}
              className={inputClass}
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
      )}
    </div>
  );
}
