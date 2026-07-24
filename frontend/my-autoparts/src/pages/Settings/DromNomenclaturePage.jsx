import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';

function formatErrorMessage(err) {
  return err?.message || String(err);
}

function itemArticle(item) {
  return String(item?.Артикул || item?.article || '').trim();
}

function itemKey(item, idx) {
  const article = itemArticle(item);
  return article ? `a:${article}` : `i:${idx}`;
}

export default function DromNomenclaturePage() {
  const user = useSelector((state) => state.auth.user);
  const orgId = user?.organization_id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [selectedKeys, setSelectedKeys] = useState([]);

  const loadData = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/credentials`, { method: 'GET' });
      const lastAutoload = data?.last_autoload;
      if (lastAutoload && lastAutoload.items) {
        setItems(lastAutoload.items);
      } else {
        setItems([]);
      }
      setSelectedKeys([]);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const selectedArticles = useMemo(() => {
    const articles = [];
    items.forEach((item, idx) => {
      if (!selectedKeys.includes(itemKey(item, idx))) return;
      const article = itemArticle(item);
      if (article) articles.push(article);
    });
    return [...new Set(articles)];
  }, [items, selectedKeys]);

  const allSelected = items.length > 0 && selectedKeys.length === items.length;

  const toggleAll = (checked) => {
    if (checked) {
      setSelectedKeys(items.map((item, idx) => itemKey(item, idx)));
    } else {
      setSelectedKeys([]);
    }
  };

  const toggleRow = (key) => {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  const handleRemove = async () => {
    if (!orgId || selectedArticles.length === 0) return;
    const ok = window.confirm(
      `Удалить ${selectedArticles.length} поз. из прайс-листа Drom? Они пропадут из файла и из автообновления API (qty=0).`,
    );
    if (!ok) return;

    setRemoving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest(`/organizations/${orgId}/drom/autoload/remove-rows`, {
        method: 'POST',
        body: JSON.stringify({ articles: selectedArticles }),
      });
      setItems(Array.isArray(data.items) ? data.items : []);
      setSelectedKeys([]);
      const syncSkipped = data?.sync?.skipped;
      const syncOk = data?.sync?.ok;
      let msg = `Удалено из номенклатуры: ${data.removed_count ?? selectedArticles.length}.`;
      if (syncSkipped) {
        msg += ' API-синхронизация пропущена (выключена или нет ключей).';
      } else if (data?.sync && syncOk === false) {
        msg += ` API: ${data.sync.error_message || 'ошибка синхронизации'}.`;
      } else if (data?.sync) {
        msg += ' Обновление прайс-листа в API Drom отправлено.';
      }
      setNotice(msg);
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setRemoving(false);
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="mb-6">
        <Link
          to="/settings/integration/drom"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Назад к интеграции
        </Link>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Номенклатура Drom XLSX</h1>
        <p className="text-sm text-gray-600 mt-1">
          Товары в файле автозагрузки для Drom.ru. Удаление убирает позицию из файла и из
          автообновления прайс-листа через API.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm whitespace-pre-wrap">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-green-800 text-sm whitespace-pre-wrap">
          {notice}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        </div>
      ) : items.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900">Нет товаров</h3>
          <p className="mt-1 text-sm text-gray-500">Экспортируйте товары со страницы «Мои запчасти»</p>
          <div className="mt-6">
            <Link
              to="/my-parts"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700"
            >
              Перейти к запчастям
            </Link>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-200 bg-gray-50 px-4 py-3">
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={allSelected}
                onChange={(e) => toggleAll(e.target.checked)}
                disabled={removing}
              />
              Выбрать все ({items.length})
            </label>
            <button
              type="button"
              onClick={handleRemove}
              disabled={removing || selectedArticles.length === 0}
              className="inline-flex items-center rounded-lg border border-red-300 bg-white px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {removing ? 'Удаление…' : `Удалить из номенклатуры (${selectedArticles.length})`}
            </button>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-10" />
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Артикул
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Наименование
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Состояние
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Производитель
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Кол-во
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Цена
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Наличие
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {items.map((item, idx) => {
                  const key = itemKey(item, idx);
                  return (
                    <tr key={key} className="hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                          checked={selectedKeys.includes(key)}
                          disabled={removing || !itemArticle(item)}
                          onChange={() => toggleRow(key)}
                        />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-mono text-gray-900">
                        {item.Артикул || item.article || '-'}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {item['Наименование товара'] || item.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item['Новый/б.у.'] || item.condition || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.Производитель || item.brand || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900">
                        {item['Кол-во'] ?? item.quantity ?? 0}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-medium text-gray-900">
                        {item.Цена ?? item.price ? `${Number(item.Цена ?? item.price).toLocaleString('ru-RU')} ₽` : '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          (item.Наличие || item.availability) === 'В наличии'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.Наличие || item.availability || '-'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="md:hidden divide-y divide-gray-200">
            {items.map((item, idx) => {
              const key = itemKey(item, idx);
              return (
                <div key={key} className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                      checked={selectedKeys.includes(key)}
                      disabled={removing || !itemArticle(item)}
                      onChange={() => toggleRow(key)}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-mono font-semibold text-gray-900 truncate">
                            {item.Артикул || item.article || '-'}
                          </p>
                          <p className="text-sm text-gray-700 mt-1 line-clamp-2">
                            {item['Наименование товара'] || item.name || '-'}
                          </p>
                        </div>
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${
                          (item.Наличие || item.availability) === 'В наличии'
                            ? 'bg-green-100 text-green-800'
                            : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {item.Наличие || item.availability || '-'}
                        </span>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Производитель</p>
                          <p className="text-gray-900 truncate">{item.Производитель || item.brand || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Состояние</p>
                          <p className="text-gray-900">{item['Новый/б.у.'] || item.condition || '-'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Кол-во</p>
                          <p className="text-gray-900">{item['Кол-во'] ?? item.quantity ?? 0}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Цена</p>
                          <p className="text-gray-900 font-medium">
                            {item.Цена ?? item.price ? `${Number(item.Цена ?? item.price).toLocaleString('ru-RU')} ₽` : '-'}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Всего товаров: <span className="font-semibold text-gray-900">{items.length}</span>
              {selectedArticles.length > 0 ? (
                <>
                  {' · '}
                  Выбрано: <span className="font-semibold text-gray-900">{selectedArticles.length}</span>
                </>
              ) : null}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
