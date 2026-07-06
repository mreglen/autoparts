import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest, apiRequestFormData, API_BASE } from '../../utils/apiClient';
import { formatDromLocalError } from '../../utils/dromExport';

function formatErrorMessage(err) {
  return err?.message || String(err);
}

export default function DromIntegrationPage() {
  const user = useSelector((state) => state.auth.user);
  const orgId = user?.organization_id;
  const fileInputRef = useRef(null);

  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
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
      const body = { is_enabled: isEnabled };
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
      if (data.local_validation_ok) {
        setNotice('Файл загружен и проверен.');
      } else {
        setNotice('Файл загружен; есть ошибки валидации — см. ниже.');
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  const validationErrors = lastAutoload?.local_errors || [];
  const hasValidationErrors = lastAutoload && lastAutoload.local_validation_ok === false && validationErrors.length > 0;

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
        <h1 className="text-2xl font-bold text-gray-900 max-md:hidden">Drom — выгрузка XLSX</h1>
        <p className="text-sm text-gray-600 mt-1">
          Формирование файла автозагрузки для ручной загрузки на Drom.ru. API-публикация не используется.
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
        <p className="font-medium mb-1">Как это работает</p>
        <ol className="list-decimal list-inside space-y-1 text-blue-800">
          <li>Включите выгрузку и экспортируйте товары со страницы «Мои запчасти».</li>
          <li>Скачайте XLSX-файл здесь или скопируйте ссылку для автозагрузки на Drom.ru.</li>
          <li>Загрузите файл в личном кабинете Drom в разделе автозагрузки запчастей.</li>
        </ol>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4">
        <h2 className="text-base font-semibold text-gray-900 mb-4">Выгрузка XLSX</h2>

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
                {isEnabled ? 'Выгрузка включена' : 'Выгрузка отключена'}
              </p>
              <p className="text-xs text-gray-500 mt-0.5">
                При включении появится кнопка «Экспорт Drom» в «Мои запчасти»
              </p>
            </div>
          </div>
        </div>

        <div className="mt-4">
          <button
            type="button"
            disabled={saving || loading}
            onClick={handleSave}
            className="w-full px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors max-md:min-h-11"
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </button>
        </div>
      </div>

      {isEnabled && (
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Файл автозагрузки</h2>

          <div className="space-y-3">
            <Link
              to="/settings/integration/drom/nomenclature"
              className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              Просмотреть номенклатуру
            </Link>

            <button
              type="button"
              onClick={handleDownloadAutoload}
              disabled={!lastAutoload?.saved_path}
              className="block w-full px-4 py-3 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Скачать XLSX
            </button>

            <button
              type="button"
              onClick={handleCopyFileLink}
              disabled={!lastAutoload?.saved_path}
              className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
              className="block w-full px-4 py-3 bg-white border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-colors"
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
                Файл ещё не создан. Экспортируйте товары со страницы «Мои запчасти» или загрузите готовый XLSX.
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
      )}
    </div>
  );
}
