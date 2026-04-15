import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest, apiRequestFormData, BACKEND_BASE } from '../../utils/apiClient';

const AD_TYPE_NOT_SPECIFIED = '__NOT_SPECIFIED__';

function CategoryPickerModal({
  open,
  orgId,
  onClose,
  onPick,
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [tree, setTree] = useState([]);
  const [expanded, setExpanded] = useState(() => new Set());
  const [query, setQuery] = useState('');

  const toggle = (key) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  useEffect(() => {
    if (!open || !orgId) return;
    let active = true;
    setLoading(true);
    setError(null);
    apiRequest(`/organizations/${orgId}/avito/autoload/category-tree`, { method: 'GET' })
      .then((data) => {
        if (!active) return;
        const t = Array.isArray(data?.tree) ? data.tree : [];
        setTree(t);
      })
      .catch((e) => {
        if (active) setError(e?.message || String(e));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [open, orgId]);

  const filteredTree = useMemo(() => {
    const q = (query || '').trim().toLowerCase();
    if (!q) return tree;
    const filter = (nodes) => {
      const out = [];
      nodes.forEach((n) => {
        const title = String(n?.title || '').trim();
        const children = Array.isArray(n?.children) ? n.children : [];
        const matched = title.toLowerCase().includes(q);
        if (matched) {
          // Если совпала категория — показываем всю ветку ниже (подкатегории не фильтруем).
          out.push({ title, children });
          return;
        }
        const filteredChildren = filter(children);
        if (filteredChildren.length > 0) {
          out.push({ title, children: filteredChildren });
        }
      });
      return out;
    };
    return filter(tree);
  }, [tree, query]);

  const renderNodes = (nodes, path) => {
    if (!Array.isArray(nodes) || nodes.length === 0) return null;
    const q = (query || '').trim();
    return (
      <ul className="space-y-1">
        {nodes.map((n, idx) => {
          const title = String(n?.title || '').trim();
          const children = Array.isArray(n?.children) ? n.children : [];
          const key = `${path}/${idx}:${title}`;
          const hasChildren = children.length > 0;
          const isExpanded = q ? true : expanded.has(key);
          return (
            <li key={key}>
              <div className="flex items-center gap-2">
                {hasChildren ? (
                  <button
                    type="button"
                    onClick={() => toggle(key)}
                    disabled={!!q}
                    className="w-6 h-6 inline-flex items-center justify-center border border-gray-300 rounded text-xs bg-white hover:bg-gray-50"
                    aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                  >
                    {isExpanded ? '-' : '+'}
                  </button>
                ) : (
                  <span className="w-6 h-6 inline-flex items-center justify-center text-gray-300">•</span>
                )}
                <button
                  type="button"
                  onClick={() => onPick(title)}
                  className="text-sm text-blue-700 hover:underline text-left"
                >
                  {title || '(без названия)'}
                </button>
              </div>
              {hasChildren && isExpanded && (
                <div className="ml-8 mt-1">
                  {renderNodes(children, key)}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    );
  };

  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-3xl max-h-[85vh] rounded-lg shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 gap-4">
          <h3 className="text-lg font-semibold text-gray-900">Выбор категории</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
          >
            Закрыть
          </button>
        </div>
        <div className="p-4 overflow-auto">
          <div className="flex items-center gap-2 mb-3">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Поиск по дереву…"
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
            />
          </div>
          {loading ? (
            <p className="text-sm text-gray-500">Загрузка дерева категорий…</p>
          ) : error ? (
            <p className="text-sm text-red-700 whitespace-pre-wrap">{error}</p>
          ) : filteredTree.length === 0 ? (
            <p className="text-sm text-gray-500">Ничего не найдено.</p>
          ) : (
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              {renderNodes(filteredTree, 'root')}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const AVITO_DEVELOPERS_URL = 'https://developers.avito.ru';

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
  useEffect(() => {
    if (!open) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [open, onClose]);

  if (!open) return null;

  const uidNum = parseInt(avitoUserId, 10);
  const canSave =
    clientId.trim().length > 0 &&
    (secretConfigured || clientSecret.trim().length > 0) &&
    uidNum > 0;

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/80 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="avito-connect-title"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            
            <h2 id="avito-connect-title" className="text-xl font-bold text-gray-900">
              Подключение Авито
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 p-1"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-6 py-5 space-y-4">
          {loadingCreds ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
            </div>
          ) : (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(ev) => setClientId(ev.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  autoComplete="off"
                  placeholder="Введите Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Client secret</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(ev) => setClientSecret(ev.target.value)}
                  placeholder={
                    secretConfigured ? 'Оставьте пустым, если не меняете' : 'Введите Client secret'
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">ID пользователя Авито</label>
                <input
                  type="number"
                  min="1"
                  value={avitoUserId}
                  onChange={(ev) => setAvitoUserId(ev.target.value)}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent transition-all"
                  placeholder="Числовой ID, например 123456789"
                />
              </div>
              <a
                href={AVITO_DEVELOPERS_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-blue-600 hover:underline flex items-center gap-1"
              >
                Получить ключи на developers.avito.ru
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                </svg>
              </a>
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100">
          <button
            type="button"
            disabled={saving || loadingCreds || !canSave}
            onClick={() => onSave()}
            className="w-full px-6 py-3 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {saving ? 'Подключение…' : 'Подключить'}
          </button>
        </div>
      </div>
    </div>
  );
}

function formatErrorMessage(err) {
  const msg = err?.message || String(err);
  return msg;
}

/** Дата и время (часы:минуты) для подписи «Обновлено». */
function formatUpdatedAt(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return String(value);
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(d);
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
  const { user } = useSelector((s) => s.auth);
  const orgId = user?.organization_id;

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
  const [avitoDeliveryWarning, setAvitoDeliveryWarning] = useState(null);
  const [checkingDelivery, setCheckingDelivery] = useState(false);

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

  // Проверка Avito Доставки при загрузке страницы (если API подключено)
  useEffect(() => {
    if (!orgId || !avitoApiConnected) {
      setAvitoDeliveryWarning(null);
      return;
    }

    let active = true;
    setCheckingDelivery(true);
    
    apiRequest(`/organizations/${orgId}/avito/delivery/check`, { method: 'GET' })
      .then((data) => {
        if (!active) return;
        if (data && data.delivery_enabled === false && data.message) {
          setAvitoDeliveryWarning(data.message);
        } else {
          setAvitoDeliveryWarning(null);
        }
      })
      .catch((e) => {
        // Если ошибка - не показываем предупреждение, т.к. это может быть проблема с API
        console.warn('Ошибка проверки Avito доставки:', e);
        if (active) setAvitoDeliveryWarning(null);
      })
      .finally(() => {
        if (active) setCheckingDelivery(false);
      });

    return () => {
      active = false;
    };
  }, [orgId, avitoApiConnected]);


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
      const downloadUrl = `${BACKEND_BASE}/organizations/${orgId}/avito/autoload/download`;
      
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
      
      // Проверяем Avito Доставку после подключения
      try {
        const deliveryCheck = await apiRequest(`/organizations/${orgId}/avito/delivery/check`, { method: 'GET' });
        if (deliveryCheck && deliveryCheck.delivery_enabled === false && deliveryCheck.message) {
          setAvitoDeliveryWarning(deliveryCheck.message);
        }
      } catch (deliveryErr) {
        console.warn('Ошибка проверки Avito доставки:', deliveryErr);
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

  const handleCancelDisable = () => {
    setIsConfirmDisableOpen(false);
  };

  // Handle Escape key for confirmation modal
  useEffect(() => {
    if (!isConfirmDisableOpen) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape') handleCancelDisable();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isConfirmDisableOpen]);

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

  if (!orgId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
        Интеграция Авито доступна для аккаунтов с привязкой к организации.
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Интеграция с Авито</h1>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900 text-sm">
          {notice}
        </div>
      )}
      {avitoDeliveryWarning && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-3">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 mb-1">Внимание: Авито Доставка не подключена</p>
              <p className="text-sm text-amber-700">{avitoDeliveryWarning}</p>
            </div>
          </div>
        </div>
      )}
      {warnings && warnings.length > 0 && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
            </svg>
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 mb-1">Предупреждения</p>
              <ul className="text-sm text-amber-700 space-y-1">
                {warnings.map((w, idx) => (
                  <li key={idx}>• {w}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {/* API подключения */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <h2 className="text-base font-semibold text-gray-900 mb-1">API приложения</h2>
              {loadingCreds ? (
                <p className="text-sm text-gray-500">Загрузка…</p>
              ) : avitoApiConnected ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-emerald-500 rounded-full"></div>
                  <p className="text-sm text-gray-700">Подключено · User ID: <span className="font-mono text-gray-900">{avitoUserId}</span></p>
                </div>
              ) : secretConfigured ? (
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                  <p className="text-sm text-gray-700">Отключено · User ID: <span className="font-mono text-gray-900">{avitoUserId}</span></p>
                </div>
              ) : (
                <p className="text-sm text-gray-500">Не подключено</p>
              )}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              {secretConfigured && (
                <button
                  type="button"
                  onClick={integrationEnabled ? handleDisableClick : handleToggleIntegration}
                  disabled={toggling}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors shrink-0 ${
                    integrationEnabled
                      ? 'bg-red-600 text-white hover:bg-red-700'
                      : 'bg-emerald-600 text-white hover:bg-emerald-700'
                  } disabled:opacity-50 disabled:cursor-not-allowed`}
                >
                  {toggling ? 'Переключение…' : integrationEnabled ? 'Отключить' : 'Включить'}
                </button>
              )}
              <button
                type="button"
                onClick={openAvitoConnectModal}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shrink-0"
              >
                {avitoApiConnected || secretConfigured ? 'Изменить' : 'Подключить'}
              </button>
            </div>
          </div>
        </div>

        {/* Автозагрузка */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Автозагрузка объявлений</h2>
          
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-gray-50 transition-colors">
              <span className="text-sm font-medium text-gray-700">{uploading ? 'Загрузка…' : 'Загрузить XLSX'}</span>
              <input type="file" accept=".xlsx" className="hidden" disabled={uploading} onChange={handleFile} />
            </label>
            <button
              type="button"
              onClick={handlePublishAutoload}
              disabled={!savedPath || publishing}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium transition-colors"
            >
              {publishing ? 'Публикация…' : 'Опубликовать'}
            </button>
            {!loadingCreds && savedPath && (
              <Link
                to="/settings/integration/avito/nomenclature"
                className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors inline-block"
              >
                Просмотреть {items.length > 0 ? `(${items.length})` : ''}
              </Link>
            )}
          </div>

          {savedPath && (
            <div className="flex items-center gap-2 pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={handleDownloadAutoload}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors shrink-0"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                <span>Скачать файл</span>
              </button>
              <button
                type="button"
                onClick={handleCopyAutoloadLink}
                className="text-sm text-blue-600 hover:text-blue-700 hover:underline shrink-0"
              >
                Скопировать ссылку
              </button>
              <span className="text-xs text-gray-400 truncate" title={getPublicFileUrl(savedPath)}>
                {getPublicFileUrl(savedPath)}
              </span>
            </div>
          )}

          {!loadingCreds && items.length === 0 && !savedPath && (
            <div className="text-center py-8 border-2 border-dashed border-gray-200 rounded-lg">
              <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              <p className="text-sm text-gray-500">Загрузите файл XLSX для начала работы</p>
            </div>
          )}
        </div>

        {/* Результат выгрузки */}
        {uploadResult && shouldShowResultCard(uploadResult) && (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-900">Результат выгрузки</h3>
            </div>
            
            <div className="p-5">
              {uploadResult.avito_token_error ? (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-lg">
                  <svg className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-sm text-red-800 flex-1">{uploadResult.avito_token_error}</p>
                </div>
              ) : uploadResult.avito_report ? (
                <div className="space-y-3">
                  {(() => {
                    const report = uploadResult.avito_report;
                    const total = report.total || report.items_count || 0;
                    const success = report.success || report.loaded || report.ok_count || 0;
                    const errors = report.errors || report.error_count || report.failed || 0;
                    const warnings = report.warnings || report.warning_count || 0;
                    
                    const items = report.items || report.results || [];
                    const calculatedTotal = items.length > 0 ? items.length : total;
                    const calculatedSuccess = calculatedTotal > 0 && success === 0 
                      ? items.filter(i => !i.errors && !i.warnings).length 
                      : success;
                    const calculatedErrors = calculatedTotal > 0 && errors === 0
                      ? items.filter(i => i.errors && i.errors.length > 0).length
                      : errors;
                    const calculatedWarnings = calculatedTotal > 0 && warnings === 0
                      ? items.filter(i => i.warnings && i.warnings.length > 0 && (!i.errors || i.errors.length === 0)).length
                      : warnings;

                    return (
                      <div className="space-y-2.5">
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-emerald-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-emerald-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700 flex-1">Успешно</span>
                          <span className="text-sm font-semibold text-gray-900">{calculatedSuccess}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-6 h-6">
                            <svg className="w-6 h-6 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700 flex-1">Предупреждения</span>
                          <span className="text-sm font-semibold text-gray-900">{calculatedWarnings}</span>
                        </div>
                        
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 w-6 h-6 bg-red-100 rounded-full flex items-center justify-center">
                            <svg className="w-4 h-4 text-red-600" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd"/>
                            </svg>
                          </div>
                          <span className="text-sm text-gray-700 flex-1">Ошибки</span>
                          <span className="text-sm font-semibold text-gray-900">{calculatedErrors}</span>
                        </div>
                        
                        {calculatedTotal > 0 && (
                          <div className="pt-3 mt-3 border-t border-gray-100">
                            <div className="flex items-center justify-between text-sm text-gray-600">
                              <span>Всего</span>
                              <span className="font-semibold">{calculatedTotal}</span>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-4 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <svg className="w-5 h-5 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <p className="text-sm text-blue-800">Файл сохранён</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

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

      {/* Confirmation Modal for Disabling Integration */}
      {isConfirmDisableOpen && (
        <div
          className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
          onClick={handleCancelDisable}
        >
          <div
            className="bg-white w-full max-w-md rounded-2xl shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-labelledby="confirm-disable-title"
          >
            <div className="px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                  <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                </div>
                <h2 id="confirm-disable-title" className="text-lg font-bold text-gray-900">
                  Отключить интеграцию?
                </h2>
              </div>
            </div>

            <div className="px-6 py-5">
              <p className="text-sm text-gray-700 mb-4">
                Вы уверены, что хотите отключить интеграцию с Авито?
              </p>
              <ul className="text-sm text-gray-600 space-y-2">
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>Автозагрузка объявлений будет остановлена</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>Чат Авито Messenger станет недоступен</span>
                </li>
                <li className="flex items-start gap-2">
                  <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd"/>
                  </svg>
                  <span>Экспорт товаров на Авито будет заблокирован</span>
                </li>
              </ul>
              <p className="text-xs text-gray-500 mt-4">
                Вы сможете включить интеграцию обратно в любой момент.
              </p>
            </div>

            <div className="px-6 py-4 border-t border-gray-100 flex gap-3">
              <button
                type="button"
                onClick={handleCancelDisable}
                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-200 transition-all"
              >
                Отмена
              </button>
              <button
                type="button"
                onClick={handleConfirmDisable}
                disabled={toggling}
                className="flex-1 px-4 py-3 bg-red-600 text-white text-sm font-semibold rounded-xl hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                {toggling ? 'Отключение…' : 'Отключить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
