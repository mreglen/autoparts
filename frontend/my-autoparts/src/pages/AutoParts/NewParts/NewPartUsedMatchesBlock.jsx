import React from 'react';
import { Link } from 'react-router-dom';
import { buildPartDetailPath } from '../../../utils/partRoutes';
import { normalizeImageUrl } from '../../../utils/apiClient';
import { extractCityFromAddress } from '../../../utils/organizationCity';

function formatPrice(price) {
  const amount = Number(price);
  if (!Number.isFinite(amount) || amount <= 0) return '—';
  return `${amount.toLocaleString('ru-RU')} ₽`;
}

function UsedMatchRow({ item }) {
  const brand = item?.brand || '—';
  const article = item?.article || '—';
  const path = buildPartDetailPath({ id: item.id, brand, article });
  const photoUrl = item?.photo_url ? normalizeImageUrl(item.photo_url) : null;
  const seller = item?.organization_name || 'Продавец';
  const city = item?.city || extractCityFromAddress(item?.organization_address) || '—';

  return (
    <tr className="border-b border-gray-100 last:border-0">
      <td className="px-3 py-2">
        {photoUrl ? (
          <img src={photoUrl} alt={`${brand} ${article}`} className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">б/у</div>
        )}
      </td>
      <td className="px-3 py-2 text-gray-800">{brand}</td>
      <td className="px-3 py-2 text-gray-800">{article}</td>
      <td className="px-3 py-2 text-gray-700">{item?.name || '—'}</td>
      <td className="px-3 py-2 font-medium text-gray-900">{formatPrice(item?.price)}</td>
      <td className="px-3 py-2 text-gray-600">{seller}</td>
      <td className="px-3 py-2 text-gray-600">{city}</td>
      <td className="px-3 py-2">
        <Link to={path} className="font-medium text-indigo-600 hover:text-indigo-800">
          Открыть
        </Link>
      </td>
    </tr>
  );
}

export default function NewPartUsedMatchesBlock({ brand, article, items, loading, error }) {
  if (loading) {
    return (
      <section className="mt-8">
        <h2 className="text-xl font-bold text-gray-900">
          Б/у {brand} {article} — дешевле?
        </h2>
        <p className="mt-2 text-sm text-gray-500">Загрузка б/у вариантов…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-8">
        <h2 className="text-xl font-bold text-gray-900">
          Б/у {brand} {article} — дешевле?
        </h2>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
      </section>
    );
  }

  if (!items.length) return null;

  return (
    <section className="mt-8">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-xl font-bold text-gray-900">
          Б/у {brand} {article} — дешевле?
        </h2>
        <span className="text-sm text-gray-500">{items.length} шт.</span>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
              <th className="px-3 py-2 font-medium">Фото</th>
              <th className="px-3 py-2 font-medium">Бренд</th>
              <th className="px-3 py-2 font-medium">Артикул</th>
              <th className="px-3 py-2 font-medium">Название</th>
              <th className="px-3 py-2 font-medium">Цена</th>
              <th className="px-3 py-2 font-medium">Продавец</th>
              <th className="px-3 py-2 font-medium">Город</th>
              <th className="px-3 py-2 font-medium">Ссылка</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <UsedMatchRow key={`used-row-${item.id}`} item={item} />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
