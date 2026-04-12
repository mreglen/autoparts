import { useCallback, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';

function formatErrorMessage(err) {
  return err?.message || String(err);
}

export default function DromNomenclaturePage() {
  const user = useSelector((state) => state.auth.user);
  const orgId = user?.organization_id;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

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
    } catch (e) {
      setError(formatErrorMessage(e));
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  if (!orgId) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 text-sm">
        Интеграция Drom доступна для аккаунтов с привязкой к организации.
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <Link
          to="/settings/integration/drom"
          className="text-sm text-blue-600 hover:underline mb-2 inline-block"
        >
          ← Назад к интеграции
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Номенклатура Drom</h1>
        <p className="text-sm text-gray-600 mt-1">Товары, добавленные в экспорт для Drom.ru</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-800 text-sm whitespace-pre-wrap">
          {error}
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
          <p className="mt-1 text-sm text-gray-500">Экспортируйте товары со страницы "Мои запчасти"</p>
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
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
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
                {items.map((item, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
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
                ))}
              </tbody>
            </table>
          </div>

          <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
            <p className="text-sm text-gray-600">
              Всего товаров: <span className="font-semibold text-gray-900">{items.length}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
