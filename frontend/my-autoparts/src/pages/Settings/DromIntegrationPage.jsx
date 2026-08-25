import { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest, apiRequestFormData, API_BASE } from '../../utils/apiClient';
import { formatDromLocalError } from '../../utils/dromExport';
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  FieldHint,
  FieldLabel,
  Input,
  Skeleton,
} from '../../components/UI';
import { SettingsToggle } from './settingsUi';
import { warehousePageClass } from '../../utils/warehouseListUi';

function formatErrorMessage(err) {
  if (!err) return 'Ошибка';
  if (typeof err === 'string') return err;
  if (Array.isArray(err)) {
    return err.map((item) => item?.msg || String(item)).join('; ');
  }
  return err?.message || String(err);
}

function InlineNotice({ tone = 'success', children, onClose }) {
  const tones = {
    success: 'border-success-100 bg-success-50 text-success-700',
    error: 'border-danger-100 bg-danger-50 text-danger-700',
    warning: 'border-warning-100 bg-warning-50 text-warning-700',
    info: 'border-line bg-surface-subtle text-ink-soft',
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-sg border px-4 py-3 ${tones[tone] || tones.info}`}
      role="status"
    >
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
          aria-label="Закрыть"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
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
      setNotice(
        'Ссылка на файл скопирована. Используйте её для полного обновления прайса в ЛК Drom (раз в 14–30 дней).',
      );
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
      <div className={`${warehousePageClass} min-w-0`}>
        <EmptyState
          illustration="empty"
          title="Нет организации"
          description="Интеграция Drom доступна для аккаунтов с привязкой к организации."
        />
      </div>
    );
  }

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            to="/settings/integration"
            className="mb-1 inline-block text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← Все интеграции
          </Link>
          <PageIntro
            title="Drom — прайс по API"
            description="Онлайн-обновление позиций и файл XLSX для полного обновления прайса"
            className="mb-0"
          />
        </div>
        {loading ? <Skeleton className="h-6 w-24" /> : (
          <Badge tone={isEnabled ? 'success' : 'neutral'}>
            {isEnabled ? 'Включено' : 'Выключено'}
          </Badge>
        )}
      </div>

      <div className="md:hidden">
        <InlineNotice tone="info">
          <p className="text-xs text-ink-muted">
            Массовый экспорт и загрузка номенклатуры удобнее на ПК.{' '}
            <Link to="/settings/integration/drom/nomenclature" className="font-medium text-brand-700 underline">
              Номенклатура Drom
            </Link>
          </p>
        </InlineNotice>
      </div>

      {error ? (
        <InlineNotice tone="error" onClose={() => setError(null)}>
          <p className="whitespace-pre-wrap">{error}</p>
        </InlineNotice>
      ) : null}
      {notice ? (
        <InlineNotice tone="success" onClose={() => setNotice(null)}>
          <p>{notice}</p>
        </InlineNotice>
      ) : null}

      <InlineNotice tone="info">
        <p className="mb-1 font-medium text-ink">Как подключить</p>
        <ol className="list-inside list-decimal space-y-1 text-ink-soft">
          <li>
            Запросите у менеджера Drom ключ кабинета и узнайте{' '}
            <span className="font-medium">packetId</span> прайса (из URL{' '}
            <code className="rounded bg-white/70 px-1 text-xs">…/packet/{'{id}'}/recurrent-update</code>
            ).
          </li>
          <li>Исходный прайс в ЛК Drom должен быть в том же формате XLSX, что формирует система.</li>
          <li>API обновляет позиции онлайн; полный прайс обновляйте по ссылке раз в 14–30 дней.</li>
        </ol>
      </InlineNotice>

      <Card>
        <h2 className="text-base font-semibold text-ink">Подключение</h2>
        <p className="mt-1 text-sm text-ink-muted">Ключи, packetId и режимы синхронизации</p>

        <div className="mt-4 space-y-3">
          <SettingsToggle
            checked={isEnabled}
            onChange={(e) => setIsEnabled(e.target.checked)}
            label={isEnabled ? 'Интеграция включена' : 'Интеграция отключена'}
            description="Кнопка «Экспорт Drom» в «Мои запчасти»"
          />

          <div>
            <FieldLabel htmlFor="drom-packet-id">packetId прайса</FieldLabel>
            <Input
              id="drom-packet-id"
              type="text"
              value={packetId}
              onChange={(e) => setPacketId(e.target.value)}
              placeholder="например 55359"
            />
          </div>

          <div>
            <FieldLabel htmlFor="drom-api-key">Ключ кабинета</FieldLabel>
            <Input
              id="drom-api-key"
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder={
                apiKeyConfigured
                  ? 'Ключ сохранён — введите новый, чтобы заменить'
                  : 'Ключ от менеджера Drom'
              }
              autoComplete="off"
            />
            {apiKeyConfigured ? (
              <FieldHint>Ключ сохранён на сервере (шифрован).</FieldHint>
            ) : null}
          </div>

          <SettingsToggle
            checked={autoSyncEnabled}
            onChange={(e) => setAutoSyncEnabled(e.target.checked)}
            label="Автосинхронизация в API"
            description="После экспорта и при снятии проданных позиций"
          />
        </div>

        <div className="mt-4">
          <Button
            type="button"
            className="w-full sm:w-auto"
            disabled={saving || loading}
            loading={saving}
            onClick={handleSave}
          >
            {saving ? 'Сохранение…' : 'Сохранить'}
          </Button>
        </div>
      </Card>

      {isEnabled ? (
        <>
          <Card>
            <h2 className="text-base font-semibold text-ink">Синхронизация API</h2>
            <p className="mt-1 text-sm text-ink-muted">Отправка прайса и проверка доступа</p>

            <div className="mt-4 space-y-2 rounded-sg border border-line bg-surface-subtle/50 px-4 py-3 text-sm">
              <div className="flex justify-between gap-3">
                <span className="text-ink-muted">Последний sync</span>
                <span className="text-ink">
                  {lastSyncAt ? new Date(lastSyncAt).toLocaleString('ru-RU') : '—'}
                </span>
              </div>
              <div className="flex justify-between gap-3">
                <span className="text-ink-muted">HTTP статус</span>
                <span className="font-mono text-ink">{lastSyncStatus ?? '—'}</span>
              </div>
              {lastSyncError ? (
                <p className="whitespace-pre-wrap text-xs text-danger-600">{lastSyncError}</p>
              ) : null}
              {!lastSyncError && lastSyncStatus === 200 ? (
                <p className="text-xs text-success-700">Последняя отправка успешна</p>
              ) : null}
            </div>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button
                type="button"
                onClick={handleSyncNow}
                disabled={syncing || testing || !packetId || !apiKeyConfigured}
                loading={syncing}
              >
                {syncing ? 'Отправка…' : 'Отправить прайс в Drom сейчас'}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleTestAuth}
                disabled={testing || syncing || !packetId || !apiKeyConfigured}
                loading={testing}
              >
                {testing ? 'Проверка…' : 'Проверить packetId и ключ'}
              </Button>
            </div>
          </Card>

          <Card>
            <h2 className="text-base font-semibold text-ink">Файл прайса</h2>
            <p className="mt-1 text-sm text-ink-muted">
              Для полного обновления в ЛК Drom (раз в 14–30 дней) скачайте файл или скопируйте
              публичную ссылку.
            </p>

            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <Button as={Link} to="/settings/integration/drom/nomenclature" variant="secondary">
                Просмотреть номенклатуру
              </Button>
              <Button
                type="button"
                onClick={handleDownloadAutoload}
                disabled={!lastAutoload?.saved_path}
              >
                Скачать XLSX
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleCopyFileLink}
                disabled={!lastAutoload?.saved_path}
              >
                Скопировать ссылку
              </Button>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="hidden"
                onChange={handleUploadFile}
              />
              <Button
                type="button"
                variant="secondary"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                loading={uploading}
              >
                {uploading ? 'Загрузка…' : 'Загрузить XLSX вручную'}
              </Button>
            </div>

            {lastAutoload?.saved_path ? (
              <div className="mt-4 rounded-sg border border-line bg-surface-subtle/50 px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-ink-muted">Товаров в файле</span>
                  <span className="font-mono text-ink">{lastAutoload.items?.length || 0}</span>
                </div>
                {lastAutoload.updated_at ? (
                  <p className="mt-1 text-xs text-ink-faint">
                    Обновлено: {new Date(lastAutoload.updated_at).toLocaleString('ru-RU')}
                  </p>
                ) : null}
                {lastAutoload.local_validation_ok === true ? (
                  <p className="mt-2 text-xs text-success-700">Локальная проверка пройдена</p>
                ) : null}
              </div>
            ) : (
              <div className="mt-4">
                <InlineNotice tone="warning">
                  <p>
                    Файл ещё не создан. Экспортируйте товары со страницы «Мои запчасти» или загрузите
                    готовый XLSX.
                  </p>
                </InlineNotice>
              </div>
            )}

            {hasValidationErrors ? (
              <div className="mt-4">
                <InlineNotice tone="error">
                  <p className="mb-2 font-medium">Ошибки валидации XLSX</p>
                  <ul className="list-inside list-disc space-y-1">
                    {validationErrors.slice(0, 10).map((err, idx) => (
                      <li key={idx}>{formatDromLocalError(err)}</li>
                    ))}
                  </ul>
                  {validationErrors.length > 10 ? (
                    <p className="mt-2 text-xs">И ещё {validationErrors.length - 10} ошибок…</p>
                  ) : null}
                </InlineNotice>
              </div>
            ) : null}

            {lastAutoload?.warnings?.length > 0 ? (
              <div className="mt-4">
                <InlineNotice tone="warning">
                  <p className="mb-1 font-medium">Предупреждения</p>
                  <ul className="list-inside list-disc space-y-1">
                    {lastAutoload.warnings.map((w, idx) => (
                      <li key={idx}>{typeof w === 'string' ? w : JSON.stringify(w)}</li>
                    ))}
                  </ul>
                </InlineNotice>
              </div>
            ) : null}
          </Card>
        </>
      ) : null}
    </div>
  );
}
