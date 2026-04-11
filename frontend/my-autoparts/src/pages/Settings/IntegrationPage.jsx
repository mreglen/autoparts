import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest, apiRequestFormData, BACKEND_BASE } from '../../utils/apiClient';

const AD_TYPE_NOT_SPECIFIED = '__NOT_SPECIFIED__';
const AD_TYPE_OPTIONS = [
  { value: AD_TYPE_NOT_SPECIFIED, label: 'Не указано' },
  { value: 'Товар приобретен на продажу', label: 'Товар приобретен на продажу' },
  { value: 'Товар от производителя', label: 'Товар от производителя' },
];

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

const CONNECT_STEP_COUNT = 4;

function AvitoConnectWizardModal({
  open,
  onClose,
  step,
  setStep,
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

  const canGoNext = step < CONNECT_STEP_COUNT - 1;
  const canGoBack = step > 0;
  const isLastStep = step === CONNECT_STEP_COUNT - 1;

  const uidNum = parseInt(avitoUserId, 10);
  const canSave =
    clientId.trim().length > 0 &&
    (secretConfigured || clientSecret.trim().length > 0) &&
    uidNum > 0;

  const handleNext = () => {
    if (canGoNext) setStep((s) => Math.min(s + 1, CONNECT_STEP_COUNT - 1));
  };
  const handleBack = () => {
    if (canGoBack) setStep((s) => Math.max(s - 1, 0));
  };

  return (
    <div
      className="fixed inset-0 z-[70] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="bg-white w-full max-w-lg max-h-[90vh] rounded-xl shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-labelledby="avito-connect-title"
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 id="avito-connect-title" className="text-lg font-semibold text-gray-900">
            Подключение API Авито
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800 px-2 py-1"
          >
            Закрыть
          </button>
        </div>

        <div className="px-5 pt-4 pb-2">
          <div className="flex gap-1 mb-1">
            {Array.from({ length: CONNECT_STEP_COUNT }, (_, i) => (
              <div
                key={i}
                className={`h-1 flex-1 rounded-full ${i <= step ? 'bg-blue-600' : 'bg-gray-200'}`}
              />
            ))}
          </div>
          <p className="text-xs text-gray-500">
            Шаг {step + 1} из {CONNECT_STEP_COUNT}
          </p>
        </div>

        <div className="px-5 py-3 overflow-y-auto flex-1 text-sm text-gray-700 space-y-3">
          {step === 0 && (
            <>
              <p className="font-medium text-gray-900">Зачем подключать API</p>
              <p>
                После сохранения ключей ваш сайт сможет обращаться к API Авито от имени организации: выгрузка и
                обновление объявлений через файл автозагрузки (XLSX), а также переписка с покупателями во вкладке
                «Чат Авито».
              </p>
              <p className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg p-3">
                Ключи хранятся на сервере в зашифрованном виде. Client secret на экране не показывается повторно —
                при смене ключа введите новый secret целиком.
              </p>
            </>
          )}

          {step === 1 && (
            <>
              <p className="font-medium text-gray-900">Создайте приложение в Авито</p>
              <ol className="list-decimal pl-5 space-y-2">
                <li>
                  Откройте портал разработчика:{' '}
                  <a
                    href={AVITO_DEVELOPERS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    developers.avito.ru
                  </a>
                  .
                </li>
                <li>Войдите под аккаунтом, с которым работаете на Авито как продавец.</li>
                <li>Создайте приложение и получите <strong>Client ID</strong> и <strong>Client secret</strong>.</li>
                <li>
                  В настройках приложения подключите нужные API: как минимум методы для{' '}
                  <strong>автозагрузки</strong> и при необходимости <strong>Messenger</strong> (чаты), в соответствии с
                  документацией Авито.
                </li>
              </ol>
            </>
          )}

          {step === 2 && (
            <>
              <p className="font-medium text-gray-900">ID пользователя Авито (user_id)</p>
              <p>
                Это <strong>числовой идентификатор</strong> вашего профиля на Авито. Он используется в запросах к API,
                например:{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">
                  /messenger/v2/accounts/&#123;user_id&#125;/chats
                </code>
                .
              </p>
              <p className="text-xs text-gray-600 bg-amber-50 border border-amber-100 rounded-lg p-3">
                Где посмотреть: в личном кабинете Авито (профиль / настройки / раздел для разработчиков) или в
                документации портала — число обычно указано рядом с аккаунтом. Если не уверены, уточните в поддержке
                Авито по API.
              </p>
            </>
          )}

          {step === 3 && (
            <>
              <p className="font-medium text-gray-900">Введите данные приложения</p>
              {loadingCreds ? (
                <p className="text-gray-500">Загрузка…</p>
              ) : (
                <div className="space-y-3 pt-1">
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Client ID</label>
                    <input
                      type="text"
                      value={clientId}
                      onChange={(ev) => setClientId(ev.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoComplete="off"
                      placeholder="Из кабинета разработчика Авито"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">Client secret</label>
                    <input
                      type="password"
                      value={clientSecret}
                      onChange={(ev) => setClientSecret(ev.target.value)}
                      placeholder={
                        secretConfigured ? 'Оставьте пустым, если не меняете' : 'Обязательно при первом подключении'
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoComplete="new-password"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-700 mb-1">ID пользователя Авито</label>
                    <input
                      type="number"
                      min="1"
                      value={avitoUserId}
                      onChange={(ev) => setAvitoUserId(ev.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="Число, например 123456789"
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-gray-200 flex flex-wrap items-center justify-between gap-2">
          <div className="flex gap-2">
            {canGoBack && (
              <button
                type="button"
                onClick={handleBack}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md bg-white hover:bg-gray-50"
              >
                Назад
              </button>
            )}
          </div>
          <div className="flex gap-2">
            {!isLastStep && (
              <button
                type="button"
                onClick={handleNext}
                className="px-4 py-2 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
              >
                Далее
              </button>
            )}
            {isLastStep && (
              <button
                type="button"
                disabled={saving || loadingCreds || !canSave}
                onClick={() => onSave()}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50"
              >
                {saving ? 'Сохранение…' : 'Сохранить и подключить'}
              </button>
            )}
          </div>
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

export default function IntegrationPage() {
  const { user } = useSelector((s) => s.auth);
  const orgId = user?.organization_id;

  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [avitoUserId, setAvitoUserId] = useState('');
  const [secretConfigured, setSecretConfigured] = useState(false);
  const [loadingCreds, setLoadingCreds] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const [items, setItems] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [savedPath, setSavedPath] = useState('');
  const [isAdsModalOpen, setIsAdsModalOpen] = useState(false);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState(null); // { sheet, row }
  const [selectedCategories, setSelectedCategories] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [savingBulkAction, setSavingBulkAction] = useState(false);
  const [photoIndexes, setPhotoIndexes] = useState({});
  const [publishing, setPublishing] = useState(false);
  const [isAvitoConnectOpen, setIsAvitoConnectOpen] = useState(false);
  const [connectStep, setConnectStep] = useState(0);
  const [webhookSubscribing, setWebhookSubscribing] = useState(false);

  const avitoApiConnected =
    Boolean(secretConfigured && (clientId || '').trim() && (avitoUserId || '').trim());

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
      const {
        items: cachedItems,
        uploadResult: cachedPreview,
        savedPath: cachedSavedPath,
      } = mapLastAutoloadToState(data.last_autoload);
      setItems(cachedItems);
      setUploadResult(cachedPreview);
      setSavedPath(cachedSavedPath);
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
    if (!isAdsModalOpen) return undefined;
    const onEsc = (e) => {
      if (e.key === 'Escape') setIsAdsModalOpen(false);
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [isAdsModalOpen]);

  const categories = useMemo(() => {
    const set = new Set();
    items.forEach((row) => {
      if (row.category) set.add(row.category);
    });
    return Array.from(set).sort();
  }, [items]);

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
    const matchesCategory =
      selectedCategories.length === 0 ||
      selectedCategories.includes(row.category || '');
    const matchesStatus =
      selectedStatuses.length === 0 ||
      selectedStatuses.includes(row.avito_status || '');
    const anyFilters =
      selectedCategories.length > 0 ||
      selectedStatuses.length > 0;
    return selectAll
      ? true
      : anyFilters
        ? (matchesCategory && matchesStatus)
        : selectedRowKeys.includes(key);
  }, [selectAll, selectedCategories, selectedStatuses, selectedRowKeys]);

  const selectedRows = useMemo(
    () =>
      items
        .filter((row, idx) => isRowChecked(row, idx))
        .map((row) => ({ sheet: row.sheet, row: row.row }))
        .filter((r) => r.sheet && r.row != null),
    [items, isRowChecked],
  );

  const handleToggleFilterCategory = (cat) => {
    setSelectAll(false);
    setSelectedRowKeys([]);
    setSelectedCategories((prev) =>
      prev.includes(cat) ? prev.filter((c) => c !== cat) : [...prev, cat],
    );
  };

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
    // По требованию: при любом клике по общему чекбоксу сбрасываем фильтры.
    setSelectedCategories([]);
    setSelectedStatuses([]);
  };

  const handleToggleRow = (row, idx) => {
    const key = makeRowKey(row, idx);
    setSelectAll(false);
    // По требованию: при ручном выборе строки сбрасываем фильтры.
    setSelectedCategories([]);
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
      setSelectedCategories([]);
      setSelectedStatuses([]);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setSavingBulkAction(false);
    }
  };

  const handlePhotoPrev = (rowKey, total) => {
    if (total <= 1) return;
    setPhotoIndexes((prev) => {
      const cur = prev[rowKey] || 0;
      return { ...prev, [rowKey]: (cur - 1 + total) % total };
    });
  };

  const handlePhotoNext = (rowKey, total) => {
    if (total <= 1) return;
    setPhotoIndexes((prev) => {
      const cur = prev[rowKey] || 0;
      return { ...prev, [rowKey]: (cur + 1) % total };
    });
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

  const openCategoryPicker = (row) => {
    if (!row?.sheet || row?.row == null) return;
    setCategoryTarget({ sheet: row.sheet, row: row.row });
    setIsCategoryModalOpen(true);
  };

  const handlePickCategory = async (category) => {
    if (!orgId || !categoryTarget) return;
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/autoload/set-category`, {
        method: 'POST',
        body: JSON.stringify({
          sheet: categoryTarget.sheet,
          row: categoryTarget.row,
          category,
        }),
      });
      setItems(data.items || []);
      setSavedPath(data.saved_path || '');
      const summary = {
        local_validation_ok: data.local_validation_ok,
        local_errors: data.local_errors || [],
        avito_report: data.avito_report,
        avito_token_error: data.avito_token_error,
        updated_at: new Date().toISOString(),
      };
      setUploadResult(shouldShowResultCard(summary) ? summary : null);
      setNotice('Категория сохранена в XLSX.');
      setIsCategoryModalOpen(false);
      setCategoryTarget(null);
    } catch (e) {
      setError(formatErrorMessage(e));
    }
  };

  const handleSetAdType = async (row, adTypeValue) => {
    if (!orgId || !row?.sheet || row?.row == null) return;
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/autoload/set-ad-type`, {
        method: 'POST',
        body: JSON.stringify({
          sheet: row.sheet,
          row: row.row,
          ad_type: adTypeValue === AD_TYPE_NOT_SPECIFIED ? '' : adTypeValue,
        }),
      });
      setItems(data.items || []);
      setSavedPath(data.saved_path || '');
      const summary = {
        local_validation_ok: data.local_validation_ok,
        local_errors: data.local_errors || [],
        avito_report: data.avito_report,
        avito_token_error: data.avito_token_error,
        updated_at: new Date().toISOString(),
      };
      setUploadResult(shouldShowResultCard(summary) ? summary : null);
      setNotice('Вид объявления сохранен в XLSX.');
    } catch (e) {
      setError(formatErrorMessage(e));
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
      setNotice('API Авито подключён, ключи сохранены.');
      setClientSecret('');
      setSecretConfigured(true);
      await loadCredentials();
      setIsAvitoConnectOpen(false);
      setConnectStep(0);
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
    setConnectStep(0);
    setIsAvitoConnectOpen(true);
  };

  const closeAvitoConnectModal = () => {
    setIsAvitoConnectOpen(false);
    setConnectStep(0);
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
    <div className="space-y-8 max-w-3xl">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Интеграция Авито</h1>
        <p className="mt-1 text-sm text-gray-600">
          Подключение API, чат на сайте и автозагрузка объявлений (XLSX).
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-900 text-sm">
          {notice}
        </div>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">1. API приложения</h2>
            <p className="mt-1 text-sm text-gray-600">
              Ключи в{' '}
              <a href={AVITO_DEVELOPERS_URL} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                developers.avito.ru
              </a>
              .
            </p>
            {loadingCreds ? (
              <p className="mt-2 text-xs text-gray-500">Загрузка…</p>
            ) : avitoApiConnected ? (
              <p className="mt-2 text-sm text-emerald-800">
                Подключено. User ID: <span className="font-mono">{avitoUserId || '—'}</span>
              </p>
            ) : (
              <p className="mt-2 text-sm text-amber-800">Нужны Client ID, secret и числовой user_id.</p>
            )}
          </div>
          <button
            type="button"
            onClick={openAvitoConnectModal}
            className="px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 shadow-sm shrink-0"
          >
            {avitoApiConnected ? 'Изменить ключи' : 'Подключить Авито'}
          </button>
        </div>
      </section>

      {avitoApiConnected && (
        <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
          <h2 className="text-lg font-semibold text-gray-900">2. Чат на сайте</h2>
          <p className="text-sm text-gray-600">
            Раздел «Чат Авито». Для быстрых уведомлений о новых сообщениях зарегистрируйте вебхук (на проде — HTTPS, на
            бэкенде задайте <code className="text-xs bg-gray-100 px-1 rounded">PUBLIC_BASE_URL</code>). При{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">AVITO_WEBHOOK_SECRET</code> кнопка добавит{' '}
            <code className="text-xs bg-gray-100 px-1 rounded">?secret=</code> к URL.
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/chats?tab=avito"
              className="inline-flex px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              Открыть чаты
            </Link>
            <button
              type="button"
              onClick={subscribeAvitoMessengerWebhook}
              disabled={webhookSubscribing}
              className="px-4 py-2 bg-slate-800 text-white text-sm font-medium rounded-lg hover:bg-slate-900 disabled:opacity-50"
            >
              {webhookSubscribing ? 'Регистрация…' : 'Подписать вебхук в Avito'}
            </button>
          </div>
          {messengerWebhookUrl ? (
            <p className="font-mono text-xs break-all bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 text-gray-800">
              {messengerWebhookUrl}
            </p>
          ) : (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              Для отображения URL задайте <code className="text-[11px]">REACT_APP_BACKEND_BASE_URL</code> без{' '}
              <code className="text-[11px]">/api</code> в .env фронтенда.
            </p>
          )}
        </section>
      )}

      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">3. Автозагрузка (.xlsx)</h2>
        <p className="text-sm text-gray-600">
          Файл сохраняется на сервере; кнопка «Выложить» отправляет его в API Avito (нужны ключи из шага 1).
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <label className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg cursor-pointer bg-white hover:bg-gray-50">
            <span className="text-sm font-medium text-gray-700">{uploading ? 'Загрузка…' : 'Выбрать XLSX'}</span>
            <input type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" disabled={uploading} onChange={handleFile} />
          </label>
          <button
            type="button"
            onClick={handlePublishAutoload}
            disabled={!savedPath || publishing}
            className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 text-sm font-medium"
          >
            {publishing ? 'Публикация…' : 'Выложить на Avito'}
          </button>
          {!loadingCreds && items.length > 0 && (
            <button
              type="button"
              onClick={() => setIsAdsModalOpen(true)}
              className="px-4 py-2 text-sm font-medium text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-50"
            >
              Просмотреть объявления ({items.length})
            </button>
          )}
        </div>
        {savedPath && (
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1">
            <button
              type="button"
              onClick={handleCopyAutoloadLink}
              className="px-4 py-2 border border-gray-300 rounded-lg bg-white hover:bg-gray-50 text-sm w-fit"
            >
              Скопировать ссылку на файл
            </button>
            <span className="text-xs text-gray-500 truncate" title={getPublicFileUrl(savedPath)}>
              {getPublicFileUrl(savedPath)}
            </span>
          </div>
        )}
        {!loadingCreds && items.length === 0 && (
          <p className="text-sm text-gray-500 border border-dashed border-gray-200 rounded-lg px-4 py-6 text-center">
            Строк пока нет — загрузите XLSX выше; список сохранится и откроется в «Просмотреть объявления».
          </p>
        )}
      </section>

      {uploadResult && shouldShowResultCard(uploadResult) && (
        <div className="space-y-2 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="font-semibold text-gray-900">Отчёт после выгрузки</h3>
          {uploadResult.updated_at && (
            <p className="text-xs text-gray-500">Обновлено: {formatUpdatedAt(uploadResult.updated_at)}</p>
          )}
          {uploadResult.avito_token_error && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded p-2">
              API Авито: {uploadResult.avito_token_error}
            </div>
          )}
          {uploadResult.avito_report != null && (
            <>
              <p className="text-sm font-medium text-gray-800 mt-2">Отчёт Авито</p>
              <pre className="text-xs bg-gray-50 border rounded p-3 overflow-x-auto max-h-64 overflow-y-auto">
                {JSON.stringify(uploadResult.avito_report, null, 2)}
              </pre>
            </>
          )}
          {(uploadResult.local_errors || []).length > 0 && (
            <>
              <p className="text-sm font-medium text-red-800">Замечания</p>
              <ul className="text-sm text-red-900 list-disc pl-5 space-y-1">
                {uploadResult.local_errors.map((le, i) => (
                  <li key={i}>
                    {le.sheet && `${le.sheet}`}
                    {le.row != null && `, строка ${le.row}`}
                    {le.field && ` — ${le.field}`}: {le.message}
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}

      {isAdsModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"
          onClick={() => setIsAdsModalOpen(false)}
        >
          <div
            className="bg-white w-full max-w-6xl max-h-[85vh] rounded-lg shadow-lg flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 gap-4">
              <h3 className="text-lg font-semibold text-gray-900">
                Объявления из файла автозагрузки
              </h3>
              <button
                type="button"
                onClick={() => setIsAdsModalOpen(false)}
                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-900"
              >
                Закрыть
              </button>
            </div>
            <div className="overflow-auto p-4">
              <div className="mb-3 flex flex-wrap gap-4 text-xs text-gray-800">
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Действия</span>
                  <div className="flex flex-col gap-1">
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="avito-bulk-action"
                        checked={bulkAction === 'publish'}
                        onChange={() => setBulkAction('publish')}
                      />
                      <span>Опубликовать объявление</span>
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="avito-bulk-action"
                        checked={bulkAction === 'unpublish'}
                        onChange={() => setBulkAction('unpublish')}
                      />
                      <span>Снять с публикации</span>
                    </label>
                    <label className="inline-flex items-center gap-1">
                      <input
                        type="radio"
                        name="avito-bulk-action"
                        checked={bulkAction === 'delete'}
                        onChange={() => setBulkAction('delete')}
                      />
                      <span>Удалить объявление</span>
                    </label>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Категории</span>
                  <div className="flex flex-wrap gap-2">
                    {categories.length === 0 ? (
                      <span className="text-gray-400">нет данных</span>
                    ) : (
                      categories.map((cat) => (
                        <label key={cat} className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={selectedCategories.includes(cat)}
                            onChange={() => handleToggleFilterCategory(cat)}
                          />
                          <span>{cat}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="font-medium">Статусы</span>
                  <div className="flex flex-wrap gap-2">
                    {statuses.length === 0 ? (
                      <span className="text-gray-400">нет данных</span>
                    ) : (
                      statuses.map((st) => (
                        <label key={st} className="inline-flex items-center gap-1">
                          <input
                            type="checkbox"
                            checked={selectedStatuses.includes(st)}
                            onChange={() => handleToggleFilterStatus(st)}
                          />
                          <span>{st}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              </div>
              <div className="overflow-x-auto border border-gray-200 rounded-lg">
                <table className="min-w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-700">
                    <tr>
                      <th className="px-3 py-2 font-medium">
                        <input
                          type="checkbox"
                          checked={selectAll}
                          onChange={(e) => handleToggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className="px-3 py-2 font-medium">Номер детали (OEM)</th>
                      <th className="px-3 py-2 font-medium">Производитель</th>
                      <th className="px-3 py-2 font-medium">Состояние</th>
                      <th className="px-3 py-2 font-medium">Цена</th>
                      <th className="px-3 py-2 font-medium">Название объявления</th>
                      <th className="px-3 py-2 font-medium">Описание</th>
                      <th className="px-3 py-2 font-medium">Количество</th>
                      <th className="px-3 py-2 font-medium">Категория</th>
                      <th className="px-3 py-2 font-medium">Вид объявления</th>
                      <th className="px-3 py-2 font-medium">Авито статус</th>
                      <th className="px-3 py-2 font-medium">Фото</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((row, idx) => {
                      const key = makeRowKey(row, idx);
                      const checked = isRowChecked(row, idx);
                      const photos = Array.isArray(row.photos) ? row.photos : [];
                      const totalPhotos = photos.length;
                      const photoIdx = Math.min(photoIndexes[key] || 0, Math.max(totalPhotos - 1, 0));
                      const currentPhoto = totalPhotos > 0 ? photos[photoIdx] : '';
                      return (
                      <tr key={key} className="bg-white">
                        <td className="px-3 py-2">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleRow(row, idx)}
                          />
                        </td>
                        <td className="px-3 py-2">{row.part_number}</td>
                        <td className="px-3 py-2">{row.manufacturer}</td>
                        <td className="px-3 py-2">{row.condition}</td>
                        <td className="px-3 py-2">{row.price}</td>
                        <td className="px-3 py-2 max-w-md truncate" title={row.title}>
                          {row.title}
                        </td>
                        <td className="px-3 py-2 max-w-md truncate" title={row.description}>
                          {row.description || '-'}
                        </td>
                        <td className="px-3 py-2">
                          {(() => {
                            const q = Number(row.quantity);
                            return Number.isFinite(q) && q > 0 ? q : 1;
                          })()}
                        </td>
                        <td className="px-3 py-2">
                          <button
                            type="button"
                            onClick={() => openCategoryPicker(row)}
                            className="text-blue-700 hover:underline"
                            title="Выбрать категорию"
                          >
                            {row.category || '-'}
                          </button>
                        </td>
                        <td className="px-3 py-2 min-w-[220px]">
                          <select
                            value={row.ad_type ? row.ad_type : AD_TYPE_NOT_SPECIFIED}
                            onChange={(e) => handleSetAdType(row, e.target.value)}
                            className="w-full px-2 py-1 border border-gray-300 rounded text-sm bg-white"
                          >
                            {AD_TYPE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>
                                {opt.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="px-3 py-2">{row.avito_status || '-'}</td>
                        <td className="px-3 py-2">
                          {currentPhoto ? (
                            <div className="flex items-center gap-2">
                              {totalPhotos > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handlePhotoPrev(key, totalPhotos)}
                                  className="px-1 border border-gray-300 rounded text-xs"
                                  aria-label="Предыдущее фото"
                                >
                                  {'<'}
                                </button>
                              )}
                              <img
                                src={currentPhoto}
                                alt="Фото объявления"
                                className="w-14 h-14 object-cover rounded border border-gray-200"
                              />
                              {totalPhotos > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handlePhotoNext(key, totalPhotos)}
                                  className="px-1 border border-gray-300 rounded text-xs"
                                  aria-label="Следующее фото"
                                >
                                  {'>'}
                                </button>
                              )}
                            </div>
                          ) : (
                            <span className="text-gray-400 text-xs">нет фото</span>
                          )}
                        </td>
                      </tr>
                    )})}
                  </tbody>
                </table>
              </div>
              {bulkAction && (
                <div className="mt-4 flex items-center justify-between gap-3">
                  <p className="text-xs text-gray-600">
                    Выбрано строк: <span className="font-medium">{selectedRows.length}</span>
                  </p>
                  <button
                    type="button"
                    disabled={savingBulkAction || selectedRows.length === 0}
                    onClick={handleApplyBulkAction}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
                  >
                    {savingBulkAction ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <CategoryPickerModal
        open={isCategoryModalOpen}
        orgId={orgId}
        onClose={() => {
          setIsCategoryModalOpen(false);
          setCategoryTarget(null);
        }}
        onPick={handlePickCategory}
      />

      <AvitoConnectWizardModal
        open={isAvitoConnectOpen}
        onClose={closeAvitoConnectModal}
        step={connectStep}
        setStep={setConnectStep}
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
    </div>
  );
}
