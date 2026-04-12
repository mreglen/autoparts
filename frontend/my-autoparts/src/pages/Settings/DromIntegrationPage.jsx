import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest, BACKEND_BASE } from '../../utils/apiClient';

function formatErrorMessage(err) {
  return err?.message || String(err);
}

export default function DromIntegrationPage() {
  const user = useSelector((state) => state.auth.user);
  const orgId = user?.organization_id;

  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [lastAutoload, setLastAutoload] = useState(null);

  const loadCredentials = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/credentials`, { method: 'GET' });
      setIsEnabled(!!data?.is_enabled);
      setLastAutoload(data?.last_autoload || null);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  const handleSave = async () => {
    if (!orgId) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        is_enabled: isEnabled,
      };
      await apiRequest(`/organizations/${orgId}/drom/credentials`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setNotice('Настройки Drom сохранены.');
      await loadCredentials();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleCopyFileLink = async () => {
    if (!orgId) return;
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/autoload/file-link`, { method: 'GET' });
      const url = data?.file_url;
      if (!url) {
        setError('Нет сохранённого файла для копирования ссылки.');
        return;
      }
      const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;
      await navigator.clipboard.writeText(fullUrl);
      setNotice('Ссылка на файл скопирована в буфер обмена.');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  };

  if (!orgId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
        Интеграция Drom доступна для аккаунтов с привязкой к организации.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <Link
          to="/settings/integration"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Назад к интеграциям
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Интеграция Drom</h1>
        <p className="text-sm text-gray-600 mt-1">Управление интеграцией с площадкой Drom.ru</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}

      {notice && (
        <div className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-emerald-800 text-sm">
          {notice}
        </div>
      )}

      {/* Статус подключения */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Подключение к Drom API</h2>
        
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            <div>
              {isEnabled ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <p className="text-sm text-gray-700">Подключено</p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Не подключено</p>
              )}
            </div>
          </div>
        </div>

        {isEnabled && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">Интеграция с Drom включена. Вы можете экспортировать товары в XLSX файл.</p>
          </div>
        )}

        <div className="mt-4">
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {/* Автозагрузка */}
      {isEnabled && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Автозагрузка объявлений</h2>
          
          <div className="space-y-3">
            <Link
              to="/settings/integration/drom/nomenclature"
              className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              Просмотреть номенклатуру
            </Link>

            <button
              type="button"
              onClick={handleCopyFileLink}
              className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors"
            >
              Скопировать ссылку на файл
            </button>
          </div>

          {lastAutoload && lastAutoload.saved_path && (
            <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Файл:</span>
                <span className="font-mono text-gray-900">{lastAutoload.items?.length || 0} товаров</span>
              </div>
              {lastAutoload.updated_at && (
                <div className="mt-1 text-xs text-gray-500">
                  Обновлено: {new Date(lastAutoload.updated_at).toLocaleString('ru-RU')}
                </div>
              )}
            </div>
          )}

          {!lastAutoload?.saved_path && (
            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-sm text-amber-800">Файл еще не создан. Экспортируйте товары со страницы "Мои запчасти".</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
