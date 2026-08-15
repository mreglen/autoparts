import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate } from 'react-router-dom';
import { apiRequest, apiRequestFormData, API_BASE, BACKEND_BASE } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FieldLabel,
  Input,
  Modal,
  Skeleton,
} from '../../components/UI';
import { warehousePageClass } from '../../utils/warehouseListUi';
import { canAccessAvitoIntegration } from './integrationAccess';
import { useAvitoAccountStatus } from '../../hooks/useAvitoAccountStatus';
import { canUseAvitoProFeatures } from '../../utils/avitoProAccess';
import AvitoProExpiredBanner from '../../components/AvitoProExpiredBanner/AvitoProExpiredBanner';

const AVITO_DEVELOPERS_URL = 'https://developers.avito.ru';

function InlineNotice({ tone = 'success', children, onClose, className = '' }) {
  const tones = {
    success: 'border-success-100 bg-success-50 text-success-700',
    error: 'border-danger-100 bg-danger-50 text-danger-700',
    warning: 'border-warning-100 bg-warning-50 text-warning-700',
    info: 'border-line bg-surface-subtle text-ink-soft',
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-sg border px-4 py-3 ${tones[tone] || tones.info} ${className}`}
      role="status"
    >
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {onClose ? (
        <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Закрыть">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function AvitoConnectWizardModal({
  open,
  onClose,
  clientId,
  setClientId,
  clientSecret,
  setClientSecret,
  avitoUserId,
  setAvitoUserId,
  secretConfigured,
  saving,
  onSave,
  loadingCreds,
}) {
  const uidNum = parseInt(avitoUserId, 10);
  const canSave =
    clientId.trim().length > 0 &&
    (secretConfigured || clientSecret.trim().length > 0) &&
    uidNum > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Подключение Авито"
      size="sm"
      footer={(
        <Button
          type="button"
          className="w-full"
          disabled={saving || loadingCreds || !canSave}
          loading={saving}
          onClick={() => onSave()}
        >
          {saving ? 'Подключение…' : 'Подключить'}
        </Button>
      )}
    >
      {loadingCreds ? (
        <div className="space-y-3 py-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <div className="space-y-4">
          <div>
            <FieldLabel htmlFor="avito-client-id">Client ID</FieldLabel>
            <Input
              id="avito-client-id"
              type="text"
              value={clientId}
              onChange={(ev) => setClientId(ev.target.value)}
              autoComplete="off"
              placeholder="Введите Client ID"
            />
          </div>
          <div>
            <FieldLabel htmlFor="avito-client-secret">Client secret</FieldLabel>
            <Input
              id="avito-client-secret"
              type="password"
              value={clientSecret}
              onChange={(ev) => setClientSecret(ev.target.value)}
              placeholder={secretConfigured ? 'Оставьте пустым, если не меняете' : 'Введите Client secret'}
              autoComplete="new-password"
            />
          </div>
          <div>
            <FieldLabel htmlFor="avito-user-id">ID пользователя Авито</FieldLabel>
            <Input
              id="avito-user-id"
              type="number"
              min="1"
              value={avitoUserId}
              onChange={(ev) => setAvitoUserId(ev.target.value)}
              placeholder="Числовой ID, например 123456789"
            />
          </div>
          <a
            href={AVITO_DEVELOPERS_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            Получить ключи на developers.avito.ru
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
            </svg>
          </a>
        </div>
      )}
    </Modal>
  );
}

function formatErrorMessage(err) {
  const msg = err?.message || String(err);
  return msg;
}

/** Блок «Результат проверки» — только полезное для пользователя (без пути к файлу, HTTP и тела ответа загрузки в Авито). */
function shouldShowResultCard(result) {
  if (!result || typeof result !== 'object') return false;
  if ((result.local_errors || []).length > 0) return true;
  if (result.avito_report != null) return true;
  if (result.avito_token_error) return true;
  return false;
}

function mapLastAutoloadToState(last) {
  if (!last || typeof last !== 'object') {
    return { items: [], uploadResult: null, savedPath: '' };
  }
  const items = Array.isArray(last.items) ? last.items : [];
  const uploadResult = {
    local_validation_ok: last.local_validation_ok,
    local_errors: last.local_errors || [],
    avito_report: last.avito_report,
    avito_token_error: last.avito_token_error,
    updated_at: last.updated_at,
  };
  return {
    items,
    uploadResult: shouldShowResultCard(uploadResult) ? uploadResult : null,
    savedPath: last.saved_path || '',
  };
}

export default function AvitoIntegrationPage() {
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((s) => s.auth.permissionCodes);
  const orgId = user?.organization_id;
  const canAccess = canAccessAvitoIntegration(user, permissionCodes);
  const { status: avitoAccountStatus, refetch: refetchAvitoAccountStatus } = useAvitoAccountStatus(orgId, {
    enabled: Boolean(orgId),
  });
  const avitoProActive = canUseAvitoProFeatures(avitoAccountStatus);

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [avitoUserId, setAvitoUserId] = useState('');
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [integrationEnabled, setIntegrationEnabled] = useState(true);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const [items, setItems] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [savedPath, setSavedPath] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [savingBulkAction, setSavingBulkAction] = useState(false);
  const [photoIndexes, setPhotoIndexes] = useState({});
  const [publishing, setPublishing] = useState(false);
  const [isAvitoConnectOpen, setIsAvitoConnectOpen] = useState(false);
  const [isConfirmDisableOpen, setIsConfirmDisableOpen] = useState(false);
  const [webhookSubscribing, setWebhookSubscribing] = useState(false);

  const avitoApiConnected =
    Boolean(secretConfigured && (clientId || '').trim() && (avitoUserId || '').trim() && integrationEnabled);

  const messengerWebhookUrl = useMemo(() => {
    const base = String(BACKEND_BASE || '')
      .trim()
      .replace(/\/+$/, '')
      .replace(/\/api$/, '');
    if (!base) return '';
    return `${base}/webhooks/avito/messenger`;
  }, []);

  const getPublicFileUrl = useCallback((path) => {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) return path;
    return `${window.location.origin}${path.startsWith('/') ? path : `/${path}`}`;
  }, []);

  const loadCredentials = useCallback(async () => {
    if (!orgId) return;
    setLoadingCreds(true);
    setError(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/credentials`, { method: 'GET' });
      setClientId(data.client_id || '');
      setAvitoUserId(data.avito_user_id != null ? String(data.avito_user_id) : '');
      setSecretConfigured(!!data.client_secret_configured);
      setIntegrationEnabled(data.enabled !== false); // Default to true if not specified
      const {
        items: cachedItems,
        uploadResult: cachedPreview,
        savedPath: cachedSavedPath,
      } = mapLastAutoloadToState(data.last_autoload);
      setItems(cachedItems);
      setUploadResult(cachedPreview);
      setSavedPath(cachedSavedPath);
      setWarnings([]);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoadingCreds(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  useEffect(() => {
    if (!orgId || !avitoApiConnected) return;
    refetchAvitoAccountStatus();
  }, [orgId, avitoApiConnected, refetchAvitoAccountStatus]);


  const statuses = useMemo(() => {
    const set = new Set();
    items.forEach((row) => {
      if (row.avito_status) set.add(row.avito_status);
    });
    return Array.from(set).sort();
  }, [items]);

  const makeRowKey = (row, idx) =>
    `${row.sheet || 'sheet'}-${row.row || idx}-${row.part_number || ''}`;

  const isRowChecked = useCallback((row, idx) => {
    const key = makeRowKey(row, idx);
    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(row.avito_status || '');
    const anyFilters = selectedStatuses.length > 0;
    return selectAll
      ? true
      : anyFilters
        ? matchesStatus
        : selectedRowKeys.includes(key);
  }, [selectAll, selectedStatuses, selectedRowKeys]);

  const selectedRows = useMemo(
    () =>
      items
        .filter((row, idx) => isRowChecked(row, idx))
        .map((row) => ({ sheet: row.sheet, row: row.row }))
        .filter((r) => r.sheet && r.row != null),
    [items, isRowChecked],
  );

  const handleToggleFilterStatus = (st) => {
    setSelectAll(false);
    setSelectedRowKeys([]);
    setSelectedStatuses((prev) =>
      prev.includes(st) ? prev.filter((s) => s !== st) : [...prev, st],
    );
  };

  const handleToggleSelectAll = (checked) => {
    setSelectAll(checked);
    setSelectedRowKeys([]);
    setSelectedStatuses([]);
  };

  const handleToggleRow = (row, idx) => {
    const key = makeRowKey(row, idx);
    setSelectAll(false);
    setSelectedStatuses([]);
    setSelectedRowKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleApplyBulkAction = async () => {
    if (!orgId || !bulkAction || selectedRows.length === 0) return;
    setSavingBulkAction(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/autoload/actions`, {
        method: 'POST',
        body: JSON.stringify({
          action: bulkAction,
          rows: selectedRows,
        }),
      });
      setItems(data.items || []);
      setSavedPath(data.saved_path || '');
      setWarnings(data.warnings || []);
      const summary = {
        local_validation_ok: data.local_validation_ok,
        local_errors: data.local_errors || [],
        avito_report: data.avito_report,
        avito_token_error: data.avito_token_error,
        updated_at: new Date().toISOString(),
      };
      setUploadResult(shouldShowResultCard(summary) ? summary : null);
      setNotice('Действия сохранены и файл автозагрузки отправлен в Авито API.');
      setBulkAction('');
      setSelectAll(false);
      setSelectedRowKeys([]);
      setSelectedStatuses([]);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSavingBulkAction(false);
    }
  };


  const handleCopyAutoloadLink = async () => {
    const url = getPublicFileUrl(savedPath);
    if (!url) {
      setError('Нет сохранённого файла автозагрузки для копирования ссылки.');
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      setNotice('Ссылка на файл автозагрузки скопирована.');
      setError(null);
    } catch {
      setError('Не удалось скопировать ссылку в буфер обмена.');
    }
  };

  const handleDownloadAutoload = async () => {
    if (!orgId) return;
    try {
      // Используем новый endpoint для скачивания без кэша
      const downloadUrl = `${API_BASE}/organizations/${orgId}/avito/autoload/download`;
      
      // Получаем токен авторизации
      const token = localStorage.getItem('token');
      
      // Скачиваем файл с заголовками авторизации
      const response = await fetch(downloadUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });
      
      if (!response.ok) {
        throw new Error('Ошибка при скачивании файла');
      }
      
      // Получаем blob и создаём ссылку для скачивания
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'autoload.xlsx';
      document.body.appendChild(link);
      link.click();
      
      // Очищаем
      window.URL.revokeObjectURL(url);
      document.body.removeChild(link);
      
      setNotice('Файл автозагрузки скачан.');
    } catch (err) {
      setError('Не удалось скачать файл: ' + (err?.message || String(err)));
    }
  };

  const handleSyncAvitoAdIds = async () => {
    if (!orgId) return;
    try {
      setSaving(true);
      const data = await apiRequest(`/organizations/${orgId}/avito/sync-ad-ids`, {
        method: 'POST',
      });
      setNotice(data.message || 'Синхронизация запущена');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSaving(false);
    }
  };


  const saveAvitoCredentials = async () => {
    if (!orgId) return false;
    const uid = parseInt(avitoUserId, 10);
    if (!uid || uid <= 0) {
      setError('Укажите корректный ID пользователя Авито');
      return false;
    }
    if (!clientId.trim()) {
      setError('Укажите Client ID');
      return false;
    }
    if (!secretConfigured && !clientSecret.trim()) {
      setError('Укажите Client secret');
      return false;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = {
        client_id: clientId.trim(),
        avito_user_id: uid,
      };
      if (clientSecret.trim()) {
        body.client_secret = clientSecret.trim();
      }
      await apiRequest(`/organizations/${orgId}/avito/credentials`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setNotice('API Авито подключён, ключи сохранены. Вебхук Messenger зарегистрирован.');
      setClientSecret('');
      setSecretConfigured(true);
      await loadCredentials();
      
      // Автоматически подписываем вебхук после подключения API
      try {
        await apiRequest('/avito/messenger/webhook/subscribe', { method: 'POST' });
        setNotice('API Авито подключён, ключи сохранены. Вебхук Messenger зарегистрирован.');
      } catch (webhookErr) {
        // Не прерываем основной процесс, просто логируем ошибку вебхука
        console.warn('Не удалось подписаться на вебхук:', webhookErr);
      }
      
      // Проверяем статус Avito Pro после подключения
      try {
        await refetchAvitoAccountStatus({ force: true });
      } catch (deliveryErr) {
        console.warn('Ошибка проверки статуса Avito Pro:', deliveryErr);
      }
      
      setIsAvitoConnectOpen(false);
      return true;
    } catch (e) {
      setError(formatErrorMessage(e));
      return false;
    } finally {
      setSaving(false);
    }
  };

  const openAvitoConnectModal = () => {
    setError(null);
    setIsAvitoConnectOpen(true);
  };

  const closeAvitoConnectModal = () => {
    setIsAvitoConnectOpen(false);
  };

  const handleToggleIntegration = useCallback(async () => {
    if (!orgId || !secretConfigured) return;
    setToggling(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/toggle-enabled`, { method: 'PATCH' });
      setIntegrationEnabled(data.enabled);
      if (data.enabled) {
        setNotice('Интеграция с Авито включена.');
      } else {
        setNotice('Интеграция с Авито отключена.');
      }
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setToggling(false);
    }
  }, [orgId, secretConfigured]);

  const handleDisableClick = () => {
    setIsConfirmDisableOpen(true);
  };

  const handleConfirmDisable = async () => {
    setIsConfirmDisableOpen(false);
    await handleToggleIntegration();
  };

  // Handle Escape key for confirmation modal — ConfirmDialog handles Escape.
  const handleCancelDisable = () => {
    setIsConfirmDisableOpen(false);
  };

  const subscribeAvitoMessengerWebhook = useCallback(async () => {
    if (!orgId || !avitoApiConnected) return;
    setWebhookSubscribing(true);
    setError(null);
    try {
      const data = await apiRequest('/avito/messenger/webhook/subscribe', { method: 'POST' });
      setNotice(`Вебхук Messenger зарегистрирован в Avito: ${data?.url || ''}`);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setWebhookSubscribing(false);
    }
  }, [orgId, avitoApiConnected]);

  const handlePublishAutoload = async () => {
    if (!orgId) return;
    setPublishing(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/autoload/publish`, { method: 'POST' });
      const summary = {
        local_validation_ok: true,
        local_errors: [],
        avito_report: data.avito_report,
        avito_token_error: data.avito_token_error,
        updated_at: new Date().toISOString(),
      };
      setUploadResult(shouldShowResultCard(summary) ? summary : null);
      setNotice('Файл автозагрузки отправлен в Avito API.');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setPublishing(false);
    }
  };

  const handleFile = async (e) => {
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
    setUploadResult(null);
    const fd = new FormData();
    fd.append('file', file);
    try {
      const data = await apiRequestFormData(
        `/organizations/${orgId}/avito/autoload/upload`,
        fd,
        { method: 'POST' }
      );
      setItems(data.items || []);
      setSavedPath(data.saved_path || '');
      setWarnings(data.warnings || []);
      const summary = {
        local_validation_ok: data.local_validation_ok,
        local_errors: data.local_errors || [],
        avito_report: data.avito_report,
        avito_token_error: data.avito_token_error,
        updated_at: new Date().toISOString(),
      };
      setUploadResult(shouldShowResultCard(summary) ? summary : null);
      if (data.local_validation_ok) {
        setNotice('Файл сохранён, таблица запчастей обновлена.');
      } else {
        setNotice('Файл сохранён; есть замечания локальной проверки');
      }
    } catch (err) {
      setError(formatErrorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  if (!isReady) {
    return <AuthLoadingScreen />;
  }

  if (!canAccess) {
    return <Navigate to="/" replace />;
  }

  if (!orgId) {
    return (
      <div className={`${warehousePageClass} min-w-0`}>
        <EmptyState
          illustration="empty"
          title="Нет организации"
          description="Интеграция Авито доступна для аккаунтов с привязкой к организации."
        />
      </div>
    );
  }

  const connectionTone = avitoApiConnected ? 'success' : secretConfigured ? 'warning' : 'neutral';
  const connectionLabel = avitoApiConnected
    ? 'Подключено'
    : secretConfigured
      ? 'Отключено'
      : 'Не подключено';

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageIntro
          title="Интеграция с Авито"
          description="API, автозагрузка объявлений и синхронизация"
          className="mb-0"
        />
        <Link
          to="/settings/integration"
          className="text-sm font-medium text-brand-700 hover:text-brand-800 max-md:hidden"
        >
          ← Все интеграции
        </Link>
      </div>

      <div className="md:hidden">
        <InlineNotice tone="info">
          <p className="text-xs text-ink-muted">
            Массовые действия удобнее на ПК.{' '}
            <Link to="/settings/integration/avito/nomenclature" className="font-medium text-brand-700 underline">
              Номенклатура
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

      <AvitoProExpiredBanner status={avitoAccountStatus} />

      {warnings?.length > 0 ? (
        <InlineNotice tone="warning">
          <p className="mb-1 font-medium">Предупреждения</p>
          <ul className="space-y-1">
            {warnings.map((w, idx) => (
              <li key={idx}>• {w}</li>
            ))}
          </ul>
        </InlineNotice>
      ) : null}

      <Card>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-ink">API приложения</h2>
            {loadingCreds ? (
              <Skeleton className="mt-2 h-5 w-48" />
            ) : (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={connectionTone}>{connectionLabel}</Badge>
                {secretConfigured ? (
                  <p className="text-sm text-ink-muted">
                    User ID:{' '}
                    <span className="font-mono text-ink">{avitoUserId}</span>
                  </p>
                ) : (
                  <p className="text-sm text-ink-muted">Ключи ещё не сохранены</p>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {secretConfigured ? (
              <Button
                type="button"
                variant={integrationEnabled ? 'danger' : 'primary'}
                size="sm"
                onClick={integrationEnabled ? handleDisableClick : handleToggleIntegration}
                disabled={toggling}
                loading={toggling}
              >
                {toggling ? 'Переключение…' : integrationEnabled ? 'Отключить' : 'Включить'}
              </Button>
            ) : null}
            <Button type="button" size="sm" onClick={openAvitoConnectModal}>
              {avitoApiConnected || secretConfigured ? 'Изменить' : 'Подключить'}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <h2 className="text-base font-semibold text-ink">Автозагрузка объявлений</h2>
        <p className="mt-1 text-sm text-ink-muted">
          Загрузите XLSX, опубликуйте в Авито или откройте номенклатуру
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label
            className={`inline-flex min-h-10 cursor-pointer items-center justify-center rounded-sg border border-line bg-white px-4 text-sm font-semibold text-ink-soft transition hover:bg-surface-muted ${
              !avitoProActive || uploading ? 'cursor-not-allowed opacity-50' : ''
            }`}
          >
            {uploading ? 'Загрузка…' : 'Загрузить XLSX'}
            <input
              type="file"
              accept=".xlsx"
              className="hidden"
              disabled={uploading || !avitoProActive}
              onChange={handleFile}
            />
          </label>
          <Button
            type="button"
            variant="soft"
            size="sm"
            onClick={handlePublishAutoload}
            disabled={!savedPath || publishing || !avitoProActive}
            loading={publishing}
          >
            {publishing ? 'Публикация…' : 'Опубликовать'}
          </Button>
          {!loadingCreds && savedPath ? (
            <Button as={Link} to="/settings/integration/avito/nomenclature" variant="secondary" size="sm">
              Просмотреть{items.length > 0 ? ` (${items.length})` : ''}
            </Button>
          ) : null}
        </div>

        {savedPath ? (
          <div className="mt-4 flex flex-col gap-3 border-t border-line pt-4 sm:flex-row sm:flex-wrap sm:items-center">
            <Button type="button" size="sm" onClick={handleDownloadAutoload}>
              Скачать файл
            </Button>
            <Button
              type="button"
              variant="soft"
              size="sm"
              onClick={handleSyncAvitoAdIds}
              disabled={saving || !avitoProActive}
              loading={saving}
              title="Синхронизировать Avito ID из описаний объявлений"
            >
              {saving ? 'Синхронизация…' : 'Синхронизировать Avito ID'}
            </Button>
            <button
              type="button"
              onClick={handleCopyAutoloadLink}
              className="text-sm font-medium text-brand-700 hover:text-brand-800"
            >
              Скопировать ссылку
            </button>
            <span className="truncate text-xs text-ink-faint" title={getPublicFileUrl(savedPath)}>
              {getPublicFileUrl(savedPath)}
            </span>
          </div>
        ) : null}

        {!loadingCreds && items.length === 0 && !savedPath ? (
          <div className="mt-4">
            <EmptyState
              illustration="empty"
              title="Файл ещё не загружен"
              description="Загрузите XLSX, чтобы начать работу с автозагрузкой."
            />
          </div>
        ) : null}
      </Card>

      {uploadResult && shouldShowResultCard(uploadResult) ? (
        <Card padding="none" className="overflow-hidden">
          <div className="border-b border-line bg-surface-subtle/60 px-5 py-3 sm:px-6">
            <h3 className="text-sm font-semibold text-ink">Результат выгрузки</h3>
          </div>
          <div className="p-5 sm:p-6">
            {uploadResult.avito_token_error ? (
              <InlineNotice tone="error">
                <p>{uploadResult.avito_token_error}</p>
              </InlineNotice>
            ) : uploadResult.avito_report ? (
              (() => {
                const report = uploadResult.avito_report;
                const total = report.total || report.items_count || 0;
                const success = report.success || report.loaded || report.ok_count || 0;
                const errorsCount = report.errors || report.error_count || report.failed || 0;
                const warningsCount = report.warnings || report.warning_count || 0;
                const reportItems = report.items || report.results || [];
                const calculatedTotal = reportItems.length > 0 ? reportItems.length : total;
                const calculatedSuccess =
                  calculatedTotal > 0 && success === 0
                    ? reportItems.filter((i) => !i.errors && !i.warnings).length
                    : success;
                const calculatedErrors =
                  calculatedTotal > 0 && errorsCount === 0
                    ? reportItems.filter((i) => i.errors && i.errors.length > 0).length
                    : errorsCount;
                const calculatedWarnings =
                  calculatedTotal > 0 && warningsCount === 0
                    ? reportItems.filter(
                        (i) =>
                          i.warnings &&
                          i.warnings.length > 0 &&
                          (!i.errors || i.errors.length === 0),
                      ).length
                    : warningsCount;

                return (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-soft">Успешно</span>
                      <span className="font-semibold text-ink">{calculatedSuccess}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-soft">Предупреждения</span>
                      <span className="font-semibold text-ink">{calculatedWarnings}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="text-ink-soft">Ошибки</span>
                      <span className="font-semibold text-ink">{calculatedErrors}</span>
                    </div>
                    {calculatedTotal > 0 ? (
                      <div className="flex items-center justify-between gap-3 border-t border-line pt-3 text-sm">
                        <span className="text-ink-muted">Всего</span>
                        <span className="font-semibold text-ink">{calculatedTotal}</span>
                      </div>
                    ) : null}
                  </div>
                );
              })()
            ) : (
              <InlineNotice tone="info">
                <p>Файл сохранён</p>
              </InlineNotice>
            )}
          </div>
        </Card>
      ) : null}

      <AvitoConnectWizardModal
        open={isAvitoConnectOpen}
        onClose={closeAvitoConnectModal}
        clientId={clientId}
        setClientId={setClientId}
        clientSecret={clientSecret}
        setClientSecret={setClientSecret}
        avitoUserId={avitoUserId}
        setAvitoUserId={setAvitoUserId}
        secretConfigured={secretConfigured}
        saving={saving}
        onSave={saveAvitoCredentials}
        loadingCreds={loadingCreds}
      />

      <ConfirmDialog
        open={isConfirmDisableOpen}
        onClose={handleCancelDisable}
        onConfirm={handleConfirmDisable}
        title="Отключить интеграцию?"
        message="Автозагрузка и Messenger будут остановлены, экспорт на Авито — заблокирован. Включить обратно можно в любой момент."
        confirmLabel={toggling ? 'Отключение…' : 'Отключить'}
        danger
        loading={toggling}
      />
    </div>
  );
}
