import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { apiRequest, normalizeImageUrl } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  Button,
  Card,
  Checkbox,
  EmptyState,
  FieldLabel,
  Input,
  Modal,
  Select,
  Skeleton,
} from '../../components/UI';
import {
  warehouseListShellClass,
  warehousePageClass,
  warehouseToolbarClass,
} from '../../utils/warehouseListUi';
import { canAccessAvitoIntegration } from './integrationAccess';
import { useAvitoAccountStatus } from '../../hooks/useAvitoAccountStatus';
import { canUseAvitoProFeatures } from '../../utils/avitoProAccess';
import AvitoProExpiredBanner from '../../components/AvitoProExpiredBanner/AvitoProExpiredBanner';

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
        <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Закрыть">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function CategoryPickerModal({ open, orgId, onClose, onPick }) {
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
    if (!open || !orgId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    apiRequest(`/organizations/${orgId}/avito/autoload/category-tree`, { method: 'GET' })
      .then((data) => {
        if (!active) return;
        setTree(Array.isArray(data?.tree) ? data.tree : []);
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
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-line bg-white text-xs text-ink-soft hover:bg-surface-muted disabled:opacity-50"
                    aria-label={isExpanded ? 'Свернуть' : 'Развернуть'}
                  >
                    {isExpanded ? '−' : '+'}
                  </button>
                ) : (
                  <span className="inline-flex h-6 w-6 items-center justify-center text-ink-faint">•</span>
                )}
                <button
                  type="button"
                  onClick={() => onPick(title)}
                  className="text-left text-sm font-medium text-brand-700 hover:text-brand-800"
                >
                  {title || '(без названия)'}
                </button>
              </div>
              {hasChildren && isExpanded ? (
                <div className="ml-8 mt-1">{renderNodes(children, key)}</div>
              ) : null}
            </li>
          );
        })}
      </ul>
    );
  };

  return (
    <Modal open={open} onClose={onClose} title="Выбор категории" size="lg">
      <div className="mb-3">
        <Input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по дереву…"
        />
      </div>
      {loading ? (
        <Skeleton className="h-40 w-full" />
      ) : error ? (
        <p className="whitespace-pre-wrap text-sm text-danger-600">{error}</p>
      ) : filteredTree.length === 0 ? (
        <p className="text-sm text-ink-muted">Ничего не найдено.</p>
      ) : (
        <div className="rounded-sg border border-line bg-surface-subtle/50 p-3">
          {renderNodes(filteredTree, 'root')}
        </div>
      )}
    </Modal>
  );
}

function ImportModal({ open, orgId, selectedRows, onClose, onImport }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [storageLocations, setStorageLocations] = useState([]);
  const [loadingStorageLocations, setLoadingStorageLocations] = useState(false);
  const [importParams, setImportParams] = useState({
    storage_location_id: '',
    quantity: 1,
    use_file_price: true,
    sale_price: null,
  });

  useEffect(() => {
    if (!open || !orgId) return undefined;
    let active = true;
    setLoadingStorageLocations(true);
    setError(null);
    apiRequest(`/storage-locations/?organization_id=${orgId}`, { method: 'GET' })
      .then((data) => {
        if (!active) return;
        const locations = Array.isArray(data) ? data : [];
        setStorageLocations(locations);
        if (locations.length > 0) {
          setImportParams((prev) =>
            prev.storage_location_id
              ? prev
              : { ...prev, storage_location_id: locations[0].id },
          );
        }
      })
      .catch((e) => {
        if (active) setError(e?.message || String(e));
      })
      .finally(() => {
        if (active) setLoadingStorageLocations(false);
      });
    return () => {
      active = false;
    };
  }, [open, orgId]);

  const handleSubmit = async () => {
    if (!importParams.storage_location_id) {
      setError('Выберите склад');
      return;
    }
    if (!importParams.use_file_price && !importParams.sale_price) {
      setError('Укажите цену прихода или включите цену из файла');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await onImport(importParams);
    } catch (e) {
      setError(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Импорт товаров из Авито"
      size="md"
      footer={(
        <div className="flex flex-wrap justify-end gap-2">
          <Button type="button" variant="secondary" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={loading || selectedRows.length === 0}
            loading={loading}
          >
            {loading ? 'Импорт…' : 'Импортировать'}
          </Button>
        </div>
      )}
    >
      {error ? (
        <div className="mb-4">
          <InlineNotice tone="error">{error}</InlineNotice>
        </div>
      ) : null}

      <div className="space-y-4">
        <div>
          <FieldLabel htmlFor="import-warehouse" required>
            Склад
          </FieldLabel>
          {loadingStorageLocations ? (
            <Skeleton className="h-10 w-full" />
          ) : (
            <Select
              id="import-warehouse"
              value={importParams.storage_location_id}
              onChange={(e) =>
                setImportParams((prev) => ({ ...prev, storage_location_id: e.target.value }))
              }
              required
            >
              <option value="">Выберите склад</option>
              {storageLocations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.address || `Склад #${loc.id}`}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <FieldLabel htmlFor="import-qty">Количество</FieldLabel>
          <Input
            id="import-qty"
            type="number"
            min="1"
            value={importParams.quantity}
            onChange={(e) =>
              setImportParams((prev) => ({
                ...prev,
                quantity: parseInt(e.target.value, 10) || 1,
              }))
            }
          />
        </div>

        <Checkbox
          id="use_file_price"
          checked={importParams.use_file_price}
          onChange={(e) =>
            setImportParams((prev) => ({ ...prev, use_file_price: e.target.checked }))
          }
          label="Использовать цену из файла"
        />

        {!importParams.use_file_price ? (
          <div>
            <FieldLabel htmlFor="import-price" required>
              Цена прихода
            </FieldLabel>
            <Input
              id="import-price"
              type="number"
              min="0.01"
              step="0.01"
              value={importParams.sale_price || ''}
              onChange={(e) =>
                setImportParams((prev) => ({
                  ...prev,
                  sale_price: parseFloat(e.target.value) || null,
                }))
              }
              placeholder="Введите цену"
              required
            />
          </div>
        ) : null}

        <div className="rounded-sg border border-line bg-brand-50/40 px-4 py-3">
          <p className="text-sm text-ink">
            <span className="font-semibold">Будет импортировано строк:</span> {selectedRows.length}
          </p>
          <p className="mt-1 text-xs text-ink-muted">
            Товары будут созданы или обновлены. Для каждого создастся поступление на склад.
          </p>
        </div>
      </div>
    </Modal>
  );
}

function formatErrorMessage(err) {
  return err?.message || String(err);
}

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

export default function AvitoNomenclaturePage() {
  const { isReady, user } = useAuthReady();
  const permissionCodes = useSelector((s) => s.auth.permissionCodes);
  const orgId = user?.organization_id;
  const navigate = useNavigate();
  const canAccess = canAccessAvitoIntegration(user, permissionCodes);
  const { status: avitoAccountStatus } = useAvitoAccountStatus(orgId, {
    enabled: Boolean(orgId),
  });
  const avitoProActive = canUseAvitoProFeatures(avitoAccountStatus);

  const [items, setItems] = useState([]);
  const [uploadResult, setUploadResult] = useState(null);
  const [savedPath, setSavedPath] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [selectedStatuses, setSelectedStatuses] = useState([]);
  const [selectAll, setSelectAll] = useState(false);
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [bulkAction, setBulkAction] = useState('');
  const [savingBulkAction, setSavingBulkAction] = useState(false);
  const [photoIndexes, setPhotoIndexes] = useState({});
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryTarget, setCategoryTarget] = useState(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [expandedRows, setExpandedRows] = useState({});

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
    return selectAll
      ? true
      : selectedStatuses.length > 0
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
    if (bulkAction === 'import') {
      setIsImportModalOpen(true);
      return;
    }
    
    if (!orgId || !bulkAction || selectedRows.length === 0) return;
    setSavingBulkAction(true);
    setError(null);
    setNotice(null);
    try {
      // Определяем endpoint в зависимости от действия
      const endpoint = bulkAction === 'remove' 
        ? `/organizations/${orgId}/avito/autoload/remove-rows`
        : `/organizations/${orgId}/avito/autoload/actions`;
      
      // Для remove-rows не нужно отправлять action field
      const requestBody = bulkAction === 'remove'
        ? { rows: selectedRows }
        : { action: bulkAction, rows: selectedRows };
      
      const data = await apiRequest(endpoint, {
        method: 'POST',
        body: JSON.stringify(requestBody),
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
      setNotice(bulkAction === 'remove' 
        ? 'Строки удалены из файла автозагрузки.' 
        : 'Действия сохранены и файл автозагрузки отправлен в Авито API.');
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

  const handleImport = async (importParams) => {
    if (!orgId || selectedRows.length === 0) return;
    setImporting(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/autoload/import`, {
        method: 'POST',
        body: JSON.stringify({
          rows: selectedRows,
          storage_location_id: parseInt(importParams.storage_location_id),
          quantity: importParams.quantity,
          use_file_price: importParams.use_file_price,
          sale_price: importParams.sale_price,
        }),
      });
      
      setNotice(
        `Импорт завершен. Создано товаров: ${data.created_products}, обновлено: ${data.updated_products}, поступлений: ${data.created_stock_ins}`
      );
      
      // Обновляем данные
      const credentialsData = await apiRequest(`/organizations/${orgId}/avito/credentials`, { method: 'GET' });
      const {
        items: cachedItems,
        uploadResult: cachedPreview,
        savedPath: cachedSavedPath,
      } = mapLastAutoloadToState(credentialsData.last_autoload);
      setItems(cachedItems);
      setUploadResult(cachedPreview);
      setSavedPath(cachedSavedPath);
      
      // Сбрасываем выбор
      setBulkAction('');
      setSelectAll(false);
      setSelectedRowKeys([]);
      setSelectedStatuses([]);
      setIsImportModalOpen(false);
      
      // Переходим на страницу поступлений
      navigate('/stock-in');
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setImporting(false);
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

  const toggleRowExpand = (rowKey) => {
    setExpandedRows((prev) => ({
      ...prev,
      [rowKey]: !prev[rowKey],
    }));
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
          category: 'Запчасти и аксессуары',
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
          ad_type: 'Товар приобретен на продажу',
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

  const loadCredentials = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/avito/credentials`, { method: 'GET' });
      const {
        items: cachedItems,
        uploadResult: cachedPreview,
        savedPath: cachedSavedPath,
      } = mapLastAutoloadToState(data.last_autoload);
      setItems(cachedItems);
      setUploadResult(cachedPreview);
      setSavedPath(cachedSavedPath);
      setWarnings(data.last_autoload?.warnings || []);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadCredentials();
  }, [loadCredentials]);

  // Автоматически обновляем данные при возврате на страницу (когда окно получает фокус)
  useEffect(() => {
    const handleFocus = () => {
      // Перезагружаем данные только если страница не в состоянии загрузки
      if (!loading) {
        loadCredentials();
      }
    };
    
    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [loadCredentials, loading]);

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

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageIntro
          title="Номенклатура Авито"
          description="Объявления из файла автозагрузки"
          className="mb-0"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Link
            to="/settings/integration/avito"
            className="text-sm font-medium text-brand-700 hover:text-brand-800"
          >
            ← К интеграции
          </Link>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={loadCredentials}
            disabled={loading}
            loading={loading}
            title="Обновить данные"
          >
            {loading ? 'Загрузка…' : 'Обновить'}
          </Button>
        </div>
      </div>

      <AvitoProExpiredBanner status={avitoAccountStatus} />

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

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full rounded-sg-lg" />
          <Skeleton className="h-40 w-full rounded-sg-lg" />
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          illustration="empty"
          title="Нет данных для отображения"
          description="Файл не загружен, XLSX не содержит товаров, или формат файла не распознан."
          actionLabel="К интеграции и загрузке XLSX"
          actionHref="/settings/integration/avito"
        />
      ) : (
        <>
          <div className={warehouseToolbarClass}>
            <div className="flex w-full flex-col gap-3 sm:flex-row sm:gap-6 text-sm text-ink">
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Действия
                </span>
                <div className="flex flex-col gap-1.5">
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="avito-bulk-action"
                      checked={bulkAction === 'publish'}
                      onChange={() => setBulkAction('publish')}
                      className="accent-brand-700"
                    />
                    <span>Опубликовать объявление</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="avito-bulk-action"
                      checked={bulkAction === 'unpublish'}
                      onChange={() => setBulkAction('unpublish')}
                      className="accent-brand-700"
                    />
                    <span>Снять с публикации</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="avito-bulk-action"
                      checked={bulkAction === 'remove'}
                      onChange={() => setBulkAction('remove')}
                      className="accent-brand-700"
                    />
                    <span>Удалить из таблицы</span>
                  </label>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="radio"
                      name="avito-bulk-action"
                      checked={bulkAction === 'import'}
                      onChange={() => setBulkAction('import')}
                      className="accent-brand-700"
                    />
                    <span>Импортировать</span>
                  </label>
                </div>
              </div>
              <div className="flex min-w-0 flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-ink-muted">
                  Статусы
                </span>
                <div className="flex flex-wrap gap-2">
                  {statuses.length === 0 ? (
                    <span className="text-ink-faint">нет данных</span>
                  ) : (
                    statuses.map((st) => (
                      <Checkbox
                        key={st}
                        checked={selectedStatuses.includes(st)}
                        onChange={() => handleToggleFilterStatus(st)}
                        label={st}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
            {bulkAction ? (
              <div className="mt-1 flex w-full flex-col items-start justify-between gap-2 border-t border-line/60 pt-3 sm:flex-row sm:items-center">
                <p className="text-sm text-ink-muted">
                  Выбрано строк:{' '}
                  <span className="font-semibold text-ink">{selectedRows.length}</span>
                </p>
                <Button
                  type="button"
                  size="sm"
                  disabled={savingBulkAction || selectedRows.length === 0 || !avitoProActive}
                  loading={savingBulkAction}
                  onClick={handleApplyBulkAction}
                  className="w-full sm:w-auto"
                >
                  {savingBulkAction
                    ? 'Сохранение…'
                    : bulkAction === 'import'
                      ? 'Импортировать'
                      : 'Сохранить'}
                </Button>
              </div>
            ) : null}
          </div>

          <div className={`hidden md:block ${warehouseListShellClass} overflow-x-auto`}>
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-subtle/80 text-ink-soft">
                <tr>
                  <th className="px-3 py-2.5 font-medium">
                    <input
                      type="checkbox"
                      checked={selectAll}
                      onChange={(e) => handleToggleSelectAll(e.target.checked)}
                      className="accent-brand-700"
                      aria-label="Выбрать все"
                    />
                  </th>
                  <th className="px-3 py-2.5 font-medium">Номер детали (OEM)</th>
                  <th className="px-3 py-2.5 font-medium">Производитель</th>
                  <th className="px-3 py-2.5 font-medium">Состояние</th>
                  <th className="px-3 py-2.5 font-medium">Цена</th>
                  <th
                    className="px-3 py-2.5 font-medium"
                    style={{ maxWidth: '200px', width: '200px' }}
                  >
                    Название объявления
                  </th>
                  <th className="px-3 py-2.5 font-medium">Количество</th>
                  <th className="px-3 py-2.5 font-medium">Авито статус</th>
                  <th className="px-3 py-2.5 font-medium">Фото</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((row, idx) => {
                  const key = makeRowKey(row, idx);
                  const checked = isRowChecked(row, idx);
                  const photos = Array.isArray(row.photos)
                    ? row.photos.map((p) => normalizeImageUrl(p))
                    : [];
                  const totalPhotos = photos.length;
                  const photoIdx = Math.min(
                    photoIndexes[key] || 0,
                    Math.max(totalPhotos - 1, 0),
                  );
                  const currentPhoto = totalPhotos > 0 ? photos[photoIdx] : '';
                  const isExpanded = expandedRows[key];
                  return (
                    <Fragment key={key}>
                      <tr
                        className="cursor-pointer bg-white hover:bg-surface-muted/40"
                        onClick={() => toggleRowExpand(key)}
                      >
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => handleToggleRow(row, idx)}
                            className="accent-brand-700"
                          />
                        </td>
                        <td className="px-3 py-2 text-ink">{row.part_number}</td>
                        <td className="px-3 py-2 text-ink">{row.manufacturer}</td>
                        <td className="px-3 py-2 text-ink">{row.condition}</td>
                        <td className="px-3 py-2 text-ink">{row.price}</td>
                        <td
                          className="px-3 py-2 text-ink"
                          style={{
                            maxWidth: '200px',
                            width: '200px',
                            whiteSpace: 'normal',
                            wordBreak: 'break-word',
                          }}
                        >
                          {row.title}
                        </td>
                        <td className="px-3 py-2 text-ink">
                          {(() => {
                            const q = Number(row.quantity);
                            return Number.isFinite(q) && q > 0 ? q : 1;
                          })()}
                        </td>
                        <td className="px-3 py-2 text-ink">{row.avito_status || '—'}</td>
                        <td className="px-3 py-2" onClick={(e) => e.stopPropagation()}>
                          {currentPhoto ? (
                            <div className="group relative h-20 w-20">
                              <img
                                src={currentPhoto}
                                alt="Фото объявления"
                                className="h-full w-full rounded-sg border border-line object-cover"
                              />
                              {totalPhotos > 1 ? (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handlePhotoPrev(key, totalPhotos)}
                                    className="absolute bottom-0 left-0 top-0 flex w-6 items-center justify-center bg-ink/50 text-sm text-white opacity-0 transition-opacity hover:bg-ink/70 group-hover:opacity-100"
                                    aria-label="Предыдущее фото"
                                  >
                                    {'<'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handlePhotoNext(key, totalPhotos)}
                                    className="absolute bottom-0 right-0 top-0 flex w-6 items-center justify-center bg-ink/50 text-sm text-white opacity-0 transition-opacity hover:bg-ink/70 group-hover:opacity-100"
                                    aria-label="Следующее фото"
                                  >
                                    {'>'}
                                  </button>
                                </>
                              ) : null}
                            </div>
                          ) : (
                            <span className="text-xs text-ink-faint">нет фото</span>
                          )}
                        </td>
                      </tr>
                      {isExpanded && row.description ? (
                        <tr className="bg-surface-subtle/60">
                          <td colSpan={9} className="px-6 py-4">
                            <div className="text-sm">
                              <div className="mb-2 font-medium text-ink">Описание:</div>
                              <div className="whitespace-pre-wrap rounded-sg border border-line bg-white p-3 text-ink-soft">
                                {row.description}
                              </div>
                            </div>
                          </td>
                        </tr>
                      ) : null}
                    </Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {items.map((row, idx) => {
              const key = makeRowKey(row, idx);
              const checked = isRowChecked(row, idx);
              const photos = Array.isArray(row.photos)
                ? row.photos.map((p) => normalizeImageUrl(p))
                : [];
              const totalPhotos = photos.length;
              const photoIdx = Math.min(
                photoIndexes[key] || 0,
                Math.max(totalPhotos - 1, 0),
              );
              const currentPhoto = totalPhotos > 0 ? photos[photoIdx] : '';
              const isExpanded = expandedRows[key];

              return (
                <Card key={key} padding="none" className="overflow-hidden">
                  <div
                    className="cursor-pointer p-4 hover:bg-surface-muted/30"
                    onClick={() => toggleRowExpand(key)}
                  >
                    <div className="mb-3 flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggleRow(row, idx)}
                        onClick={(e) => e.stopPropagation()}
                        className="mt-1 accent-brand-700"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">
                          {row.part_number || '—'}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs text-ink-muted">
                          {row.title || '—'}
                        </p>
                      </div>
                      {currentPhoto ? (
                        <div className="relative shrink-0">
                          <img
                            src={currentPhoto}
                            alt="Фото"
                            className="h-16 w-16 rounded-sg border border-line object-cover"
                          />
                          {totalPhotos > 1 ? (
                            <div className="absolute -bottom-1 -right-1 rounded bg-ink px-1.5 py-0.5 text-xs text-white">
                              {photoIdx + 1}/{totalPhotos}
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                    </div>

                    <div className="mb-2 grid grid-cols-2 gap-2 text-sm">
                      <div>
                        <p className="text-xs text-ink-muted">Производитель</p>
                        <p className="truncate text-ink">{row.manufacturer || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted">Состояние</p>
                        <p className="text-ink">{row.condition || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted">Цена</p>
                        <p className="font-medium text-ink">{row.price || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-ink-muted">Количество</p>
                        <p className="text-ink">
                          {(() => {
                            const q = Number(row.quantity);
                            return Number.isFinite(q) && q > 0 ? q : 1;
                          })()}
                        </p>
                      </div>
                    </div>

                    {row.avito_status ? (
                      <div className="border-t border-line pt-2">
                        <p className="text-xs text-ink-muted">Статус</p>
                        <p className="text-sm text-ink">{row.avito_status}</p>
                      </div>
                    ) : null}

                    {isExpanded ? (
                      <div className="mt-3 border-t border-line pt-3">
                        <p className="mb-2 text-xs text-ink-muted">Описание:</p>
                        <div className="whitespace-pre-wrap rounded-sg border border-line bg-surface-subtle p-3 text-sm text-ink-soft">
                          {row.description || 'Нет описания'}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
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

      <ImportModal
        open={isImportModalOpen}
        orgId={orgId}
        selectedRows={selectedRows}
        onClose={() => setIsImportModalOpen(false)}
        onImport={handleImport}
      />
    </div>
  );
}
