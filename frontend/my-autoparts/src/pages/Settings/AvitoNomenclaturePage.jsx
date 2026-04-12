import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link, useNavigate } from 'react-router-dom';
import { apiRequest, apiRequestFormData, BACKEND_BASE, normalizeImageUrl } from '../../utils/apiClient';

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

function formatErrorMessage(err) {
  const msg = err?.message || String(err);
  return msg;
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

function ImportModal({
  open,
  orgId,
  selectedRows,
  onClose,
  onImport,
}) {
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
    if (!open || !orgId) return;
    let active = true;
    setLoadingStorageLocations(true);
    setError(null);
    apiRequest(`/storage-locations/?organization_id=${orgId}`, { method: 'GET' })
      .then((data) => {
        if (!active) return;
        const locations = Array.isArray(data) ? data : [];
        setStorageLocations(locations);
        if (locations.length > 0 && !importParams.storage_location_id) {
          setImportParams(prev => ({ ...prev, storage_location_id: locations[0].id }));
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

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl max-h-[90vh] rounded-lg shadow-lg flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Импорт товаров из Авито</h3>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1 text-sm text-gray-600 hover:text-gray-900 border border-gray-300 rounded hover:bg-gray-50"
          >
            Закрыть
          </button>
        </div>
        
        <div className="p-6 overflow-auto">
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Склад <span className="text-red-500">*</span>
              </label>
              {loadingStorageLocations ? (
                <div className="text-sm text-gray-500">Загрузка складов...</div>
              ) : (
                <select
                  value={importParams.storage_location_id}
                  onChange={(e) => setImportParams(prev => ({ ...prev, storage_location_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                >
                  <option value="">Выберите склад</option>
                  {storageLocations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.address || `Склад #${loc.id}`}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Количество
              </label>
              <input
                type="number"
                min="1"
                value={importParams.quantity}
                onChange={(e) => setImportParams(prev => ({ ...prev, quantity: parseInt(e.target.value) || 1 }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="use_file_price"
                checked={importParams.use_file_price}
                onChange={(e) => setImportParams(prev => ({ ...prev, use_file_price: e.target.checked }))}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <label htmlFor="use_file_price" className="text-sm text-gray-700">
                Использовать цену из файла
              </label>
            </div>

            {!importParams.use_file_price && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Цена прихода <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={importParams.sale_price || ''}
                  onChange={(e) => setImportParams(prev => ({ ...prev, sale_price: parseFloat(e.target.value) || null }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Введите цену"
                  required
                />
              </div>
            )}

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm text-blue-800">
                <strong>Будет импортировано строк:</strong> {selectedRows.length}
              </p>
              <p className="text-xs text-blue-600 mt-2">
                Товары будут созданы или обновлены в базе данных. Для каждого товара будет создана запись о поступлении на склад.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading || selectedRows.length === 0}
            className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Импорт...' : 'Импортировать'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function AvitoNomenclaturePage() {
  const { user } = useSelector((s) => s.auth);
  const orgId = user?.organization_id;
  const navigate = useNavigate();

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

  if (!orgId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
        Интеграция Авито доступна для аккаунтов с привязкой к организации.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            to="/settings/integration/avito"
            className="text-sm text-blue-600 hover:underline mb-2 inline-block"
          >
            ← Назад к интеграции
          </Link>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Номенклатура Авито</h1>
        </div>
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

      {loading ? (
        <div className="text-center py-16 px-6">
          <div className="bg-gray-100 rounded-full w-20 h-20 mx-auto mb-6 flex items-center justify-center">
            <svg className="animate-spin h-10 w-10 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-xl font-medium text-gray-900 mb-2">Загрузка номенклатуры...</h2>
          <p className="text-gray-600 text-base">Пожалуйста, подождите</p>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm text-gray-500 mb-2">Нет данных для отображения</p>
          <p className="text-xs text-gray-400 mb-4">
            Возможные причины: файл не загружен, XLSX не содержит товаров, или формат файла не распознан
          </p>
          <Link
            to="/settings/integration/avito"
            className="inline-block text-sm text-blue-600 hover:underline"
          >
            ← Вернуться к странице интеграции и загрузить XLSX
          </Link>
        </div>
      ) : (
        <>
          {/* Filters in white block */}
          <div className="bg-white rounded-xl border border-gray-200 p-3 sm:p-4 mb-4">
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 text-xs sm:text-sm text-gray-800">
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
                      checked={bulkAction === 'remove'}
                      onChange={() => setBulkAction('remove')}
                    />
                    <span>Удалить из таблицы</span>
                  </label>
                  <label className="inline-flex items-center gap-1">
                    <input
                      type="radio"
                      name="avito-bulk-action"
                      checked={bulkAction === 'import'}
                      onChange={() => setBulkAction('import')}
                    />
                    <span>Импортировать</span>
                  </label>
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
            {bulkAction && (
              <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
                <p className="text-xs sm:text-sm text-gray-600">
                  Выбрано строк: <span className="font-medium">{selectedRows.length}</span>
                </p>
                <button
                  type="button"
                  disabled={savingBulkAction || selectedRows.length === 0}
                  onClick={handleApplyBulkAction}
                  className="w-full sm:w-auto px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 text-sm"
                >
                  {savingBulkAction 
                    ? 'Сохранение…' 
                    : bulkAction === 'import' 
                      ? 'Импортировать' 
                      : 'Сохранить'}
                </button>
              </div>
            )}
          </div>

          {/* Table separate from white block - Desktop */}
          <div className="hidden md:block overflow-x-auto border border-gray-200 rounded-lg">
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
                  <th className="px-3 py-2 font-medium" style={{ maxWidth: '200px', width: '200px' }}>Название объявления</th>
                  <th className="px-3 py-2 font-medium">Количество</th>
                  <th className="px-3 py-2 font-medium">Авито статус</th>
                  <th className="px-3 py-2 font-medium">Фото</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((row, idx) => {
                  const key = makeRowKey(row, idx);
                  const checked = isRowChecked(row, idx);
                  const photos = Array.isArray(row.photos) ? row.photos.map(p => normalizeImageUrl(p)) : [];
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
                    <td className="px-3 py-2" style={{ maxWidth: '200px', width: '200px', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                      {row.title}
                    </td>
                    <td className="px-3 py-2">
                      {(() => {
                        const q = Number(row.quantity);
                        return Number.isFinite(q) && q > 0 ? q : 1;
                      })()}
                    </td>
                    <td className="px-3 py-2">{row.avito_status || '-'}</td>
                    <td className="px-3 py-2">
                      {currentPhoto ? (
                        <div className="relative group w-20 h-20">
                          <img
                            src={currentPhoto}
                            alt="Фото объявления"
                            className="w-full h-full object-cover rounded border border-gray-200"
                          />
                          {totalPhotos > 1 && (
                            <>
                              <button
                                type="button"
                                onClick={() => handlePhotoPrev(key, totalPhotos)}
                                className="absolute left-0 top-0 bottom-0 w-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
                                aria-label="Предыдущее фото"
                              >
                                {'<'}
                              </button>
                              <button
                                type="button"
                                onClick={() => handlePhotoNext(key, totalPhotos)}
                                className="absolute right-0 top-0 bottom-0 w-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-sm"
                                aria-label="Следующее фото"
                              >
                                {'>'}
                              </button>
                            </>
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

          {/* Mobile Card View */}
          <div className="md:hidden space-y-3">
            {items.map((row, idx) => {
              const key = makeRowKey(row, idx);
              const checked = isRowChecked(row, idx);
              const photos = Array.isArray(row.photos) ? row.photos.map(p => normalizeImageUrl(p)) : [];
              const totalPhotos = photos.length;
              const photoIdx = Math.min(photoIndexes[key] || 0, Math.max(totalPhotos - 1, 0));
              const currentPhoto = totalPhotos > 0 ? photos[photoIdx] : '';
              
              return (
                <div key={key} className="bg-white border border-gray-200 rounded-lg p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => handleToggleRow(row, idx)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">
                        {row.part_number || '-'}
                      </p>
                      <p className="text-xs text-gray-600 mt-1 line-clamp-2">
                        {row.title || '-'}
                      </p>
                    </div>
                    {currentPhoto && (
                      <div className="relative flex-shrink-0">
                        <img
                          src={currentPhoto}
                          alt="Фото"
                          className="w-16 h-16 object-cover rounded border border-gray-200"
                        />
                        {totalPhotos > 1 && (
                          <div className="absolute -bottom-1 -right-1 bg-gray-800 text-white text-xs px-1.5 py-0.5 rounded">
                            {photoIdx + 1}/{totalPhotos}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2 text-sm mb-2">
                    <div>
                      <p className="text-xs text-gray-500">Производитель</p>
                      <p className="text-gray-900 truncate">{row.manufacturer || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Состояние</p>
                      <p className="text-gray-900">{row.condition || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Цена</p>
                      <p className="text-gray-900 font-medium">{row.price || '-'}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">Количество</p>
                      <p className="text-gray-900">
                        {(() => {
                          const q = Number(row.quantity);
                          return Number.isFinite(q) && q > 0 ? q : 1;
                        })()}
                      </p>
                    </div>
                  </div>
                  
                  {row.avito_status && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs text-gray-500">Статус</p>
                      <p className="text-sm text-gray-900">{row.avito_status}</p>
                    </div>
                  )}
                </div>
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
