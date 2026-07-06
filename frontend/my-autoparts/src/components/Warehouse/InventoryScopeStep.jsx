import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';

export default function InventoryScopeStep({ onNext, onCancel }) {
  const { user } = useSelector((state) => state.auth);
  const storageLocations = useSelector((state) => state.organization.storageLocations) || [];

  const [storageLocationId, setStorageLocationId] = useState('');
  const [scopeType, setScopeType] = useState('location_all');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!storageLocationId && storageLocations.length > 0) {
      setStorageLocationId(String(storageLocations[0].id));
    }
  }, [storageLocations, storageLocationId]);

  const handleStart = async () => {
    if (!storageLocationId) {
      setError('Выберите склад');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const session = await apiRequest('/inventory/sessions', {
        method: 'POST',
        body: JSON.stringify({
          storage_location_id: Number(storageLocationId),
          scope_type: scopeType,
          title: title.trim() || null,
        }),
      });
      onNext(session);
    } catch (e) {
      setError(e?.message || 'Не удалось создать инвентаризацию');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Шаг 1. Охват инвентаризации</h2>
        <p className="text-sm text-gray-600 mt-1">
          Выберите склад и область подсчёта. Будут созданы строки по текущим остаткам.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Склад</label>
        <select
          value={storageLocationId}
          onChange={(e) => setStorageLocationId(e.target.value)}
          className="w-full h-10 px-3 border border-gray-300 rounded-lg bg-white text-sm"
        >
          <option value="">Выберите склад</option>
          {storageLocations.map((loc) => (
            <option key={loc.id} value={loc.id}>
              {loc.address || `Склад #${loc.id}`}
            </option>
          ))}
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Охват</label>
        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="radio"
              name="scopeType"
              checked={scopeType === 'location_all'}
              onChange={() => setScopeType('location_all')}
            />
            Все товары на складе
          </label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Название (необязательно)</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={`Инвентаризация ${new Date().toLocaleDateString('ru-RU')}`}
          className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Отмена
        </button>
        <button
          type="button"
          disabled={loading || !user?.organization_id}
          onClick={handleStart}
          className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Создание…' : 'Начать подсчёт'}
        </button>
      </div>
    </div>
  );
}
