import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest, apiRequestFormData, API_BASE } from '../../utils/apiClient';
import { formatDromLocalError } from '../../utils/dromExport';

function formatErrorMessage(err) {
  if (!err) return 'Ошибка';
  if (typeof err === 'string') return err;
  if (Array.isArray(err)) {
    return err.map((item) => item?.msg || String(item)).join('; ');
  }
  return err?.message || String(err);
}

export default function DromIntegrationPage() {
  const user = useSelector((state) => state.auth.user);
  const orgId = user?.organization_id;
  const fileInputRef = useRef(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [packetId, setPacketId] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [apiKeyConfigured, setApiKeyConfigured] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [lastSyncStatus, setLastSyncStatus] = useState(null);
  const [lastSyncError, setLastSyncError] = useState(null);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [lastAutoload, setLastAutoload] = useState(null);

  const applyCredentials = useCallback((data) => {
    setIsEnabled(!!data?.is_enabled);
    setPacketId(data?.packet_id ? String(data.packet_id) : '');
    setApiKeyConfigured(!!data?.api_key_configured);
    setApiKey('');
    setAutoSyncEnabled(data?.auto_sync_enabled !== false);
    setLastSyncAt(data?.last_sync_at || null);
    setLastSyncStatus(data?.last_sync_status ?? null);
    setLastSyncError(data?.last_sync_error || null);
    setLastAutoload(data?.last_autoload || null);
  }, []);

  const loadCredentials = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/credentials`, { method: 'GET' });
      applyCredentials(data);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId, applyCredentials]);

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
        packet_id: packetId.trim() || null,
        auto_sync_enabled: autoSyncEnabled,
      };
      if (apiKey.trim()) {
        body.api_key = apiKey.trim();
      }
      const data = await apiRequest(`/organizations/${orgId}/drom/credentials`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      applyCredentials(data);
      setNotice('Настройки Drom сохранены.');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  const handleSyncNow = async () => {
    if (!orgId) return;
    setSyncing(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/sync`, { method: 'POST' });
      if (data?.ok) {
        setNotice(`Синхронизация с Drom выполнена (чанков: ${data.chunks_sent || 1}).`);
      } else {
        setError(data?.error_message || data?.error_code || 'Ошибка синхронизации Drom');
      }
      await loadCredentials();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSyncing(false);
    }
  };

  const handleTestAuth = async () => {
    if (!orgId) return;
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/sync/test`, { method: 'POST' });
      if (data?.ok) {
        setNotice('Проверка packetId/ключа прошла успешно (HTTP 200).');
      } else {
        setError(data?.error_message || data?.error_code || 'Ошибка проверки доступа к Drom API');
      }
      await loadCredentials();
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setTesting(false);
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
      setNotice('Ссылка на файл скопирована. Используйте её для полного обновления прайса в ЛК Drom (раз в 14–30 дней).');
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  };

  const handleDownloadAutoload = async () => {
    if (!orgId) return;
    try {
      const downloadUrl = `${API_BASE}/organizations/${orgId}/drom/autoload/download`;
      const token = localStorage.getItem('token');
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) {
        throw new Error('Файл автозагрузки не найден');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'drom-autoload.xlsx';
      document.body.appendChild(link);
      link.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      setNotice('Файл XLSX скачан.');
    } catch (err) {
      setError(`Не удалось скачать файл: ${formatErrorMessage(err)}`);
    }
  };

  const handleUploadFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !orgId) return;
    if (!file.name.toLowerCase().endsWith('.xlsx')) {
      setError('Нужен файл в формате .xlsx');
      return;
    }
    setUploading(true);
    setError(null);
    setNotice(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await apiRequestFormData(
        `/organizations/${orgId}/drom/autoload/upload`,
        fd,
        { method: 'POST' },
      );
      setLastAutoload({
        saved_path: data.saved_path,
        items: data.items || [],
        local_validation_ok: data.local_validation_ok,
        local_errors: data.local_errors || [],
        warnings: data.warnings || [],
        updated_at: new Date().toISOString(),
      });
      if (data.sync?.ok) {
        setNotice('Файл загружен и отправлен в Drom API.');
      } else if (data.local_validation_ok) {
        setNotice(
          data.sync?.skipped
            ? 'Файл загружен. API sync пропущен (проверьте настройки).'
            : 'Файл загружен и проверен.',
        );
      } else {
        setNotice('Файл загружен; есть ошибки валидации — см. ниже.');
      }
      if (data.sync && data.sync.ok === false && !data.sync.skipped) {
        setError(data.sync.error_message || data.sync.error_code || 'Ошибка Drom API sync');
      }
      await loadCredentials();
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const validationErrors = lastAutoload?.local_errors || [];
  const hasValidationErrors =
    lastAutoload && lastAutoload.local_validation_ok === false && validationErrors.length > 0;

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
        <h1 className="text-2xl font-bold text-gray-900 max-md:hidden">Drom — прайс по API</h1>
        <p className="text-sm text-gray-600 mt-1">
          Онлайн-обновление позиций через API Drom и файл XLSX для полного обновления прайса.
        </p>
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

      <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-blue-900 text-sm">
        <p className="font-medium mb-1">Как подключить</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>
            Запросите у менеджера Drom уникальный ключ кабинета для API и узнайте{' '}
            <span className="font-medium">packetId</span> прайса (из URL{' '}
            <code className="text-xs bg-blue-100 px-1 rounded">
              …/packet/&#123;id&#125;/recurrent-update
            </code>
            ).
          </li>
          <li>
            Исходный прайс в ЛК Drom должен быть в том же формате XLSX, что формирует система
            (шаблон автозапчастей).
          </li>
          <li>
            API обновляет позиции онлайн; полный прайс всё равно обновляйте по ссылке раз в 14–30
            дней.
          </li>
        </ol>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Подключение</h2>

        <div className="flex max-md:flex-col max-md:items-stretch max-md:gap-3 items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
            <div>
              <p className="text-sm text-gray-700">
                {isEnabled ? 'Интеграция включена' : 'Интеграция отключена'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                Кнопка «Экспорт Drom» в «Мои запчасти»
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-3 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">packetId прайса</label>
            <input
              type="text"
              value={packetId}
              onChange={(e) => setPacketId(e.target.value)}
              placeholder="например 55359"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-md:min-h-11"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Ключ кабинета</label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={apiKeyConfigured ? 'Ключ сохранён — введите новый, чтобы заменить' : 'Ключ от менеджера Drom'}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 max-md:min-h-11"
              autoComplete="off"
            />
            {apiKeyConfigured && (
              <p className="text-xs text-emerald-700 mt-1">Ключ сохранён на сервере (шифрован).</p>
            )}
          </div>
          <div className="flex items-center gap-3 pt-1">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={autoSyncEnabled}
                onChange={(e) => setAutoSyncEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600" />
            </label>
            <div>
              <p className="text-sm text-gray-700">Автосинхронизация в API</p>
              <p className="text-xs text-gray-500 mt-0.5">
                После экспорта и при снятии проданных позиций
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          disabled={saving || loading}
          onClick={handleSave}
          className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors max-md:min-h-11"
        >
          {saving ? 'Сохранение…' : 'Сохранить'}
        </button>
      </div>

      {isEnabled && (
        <>
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Синхронизация API</h2>

            <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-sm space-y-1">
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">Последний sync</span>
                <span className="text-gray-900">
                  {lastSyncAt ? new Date(lastSyncAt).toLocaleString('ru-RU') : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-gray-600">HTTP статус</span>
                <span className="font-mono text-gray-900">{lastSyncStatus ?? '—'}</span>
              </div>
              {lastSyncError && (
                <div className="mt-2 text-xs text-red-700 whitespace-pre-wrap">{lastSyncError}</div>
              )}
              {!lastSyncError && lastSyncStatus === 200 && (
                <div className="mt-2 text-xs text-emerald-700">Последняя отправка успешна</div>
              )}
            </div>

            <div className="space-y-3">
              <button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing || testing || !packetId || !apiKeyConfigured}
                className="block w-full px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors max-md:min-h-11"
              >
                {syncing ? 'Отправка…' : 'Отправить прайс в Drom сейчас'}
              </button>
              <button
                type="button"
                onClick={handleTestAuth}
                disabled={testing || syncing || !packetId || !apiKeyConfigured}
                className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors max-md:min-h-11"
              >
                {testing ? 'Проверка…' : 'Проверить packetId и ключ'}
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h2 className="text-base font-semibold text-gray-900 mb-1">Файл прайса</h2>
            <p className="text-xs text-gray-500 mb-4">
              Для полного обновления в ЛК Drom (раз в 14–30 дней) — скачайте файл или скопируйте
              публичную ссылку.
            </p>

            <div className="space-y-3">
              <Link
                to="/settings/integration/drom/nomenclature"
                className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center max-md:min-h-11"
              >
                Просмотреть номенклатуру
              </Link>

              <button
                type="button"
                onClick={handleDownloadAutoload}
                disabled={!lastAutoload?.saved_path}
                className="block w-full px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors max-md:min-h-11"
              >
                Скачать XLSX
              </button>

              <button
                type="button"
                onClick={handleCopyFileLink}
                disabled={!lastAutoload?.saved_path}
                className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors max-md:min-h-11"
              >
                Скопировать ссылку на файл
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleUploadFile}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors max-md:min-h-11"
              >
                {uploading ? 'Загрузка…' : 'Загрузить XLSX вручную'}
              </button>
            </div>

            {lastAutoload && lastAutoload.saved_path && (
              <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Товаров в файле:</span>
                  <span className="font-mono text-gray-900">{lastAutoload.items?.length || 0}</span>
                </div>
                {lastAutoload.updated_at && (
                  <div className="mt-1 text-xs text-gray-500">
                    Обновлено: {new Date(lastAutoload.updated_at).toLocaleString('ru-RU')}
                  </div>
                )}
                {lastAutoload.local_validation_ok === true && (
                  <div className="mt-2 text-xs text-emerald-700">Локальная проверка пройдена</div>
                )}
              </div>
            )}

            {!lastAutoload?.saved_path && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm text-amber-800">
                  Файл ещё не создан. Экспортируйте товары со страницы «Мои запчасти» или загрузите
                  готовый XLSX.
                </p>
              </div>
            )}

            {hasValidationErrors && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-sm font-medium text-red-900 mb-2">Ошибки валидации XLSX</p>
                <ul className="text-sm text-red-800 space-y-1 list-disc list-inside">
                  {validationErrors.slice(0, 10).map((err, idx) => (
                    <li key={idx}>{formatDromLocalError(err)}</li>
                  ))}
                </ul>
                {validationErrors.length > 10 && (
                  <p className="text-xs text-red-700 mt-2">
                    И ещё {validationErrors.length - 10} ошибок…
                  </p>
                )}
              </div>
            )}

            {lastAutoload?.warnings?.length > 0 && (
              <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                <p className="text-sm font-medium text-amber-900 mb-1">Предупреждения</p>
                <ul className="text-sm text-amber-800 list-disc list-inside">
                  {lastAutoload.warnings.map((w, idx) => (
                    <li key={idx}>{typeof w === 'string' ? w : JSON.stringify(w)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
