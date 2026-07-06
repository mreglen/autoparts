import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildPartDetailPath } from '../../utils/partRoutes';
import { normalizeImageUrl } from '../../utils/apiClient';
import { extractCityFromAddress } from '../../utils/organizationCity';
import NewPartVehicleCompatibilityStrip from '../../pages/AutoParts/NewParts/NewPartVehicleCompatibilityStrip';
import { useProductPriceFormat } from '../../hooks/useProductPriceFormat';

function UsedMatchMobileCard({ item, formatPrice }) {
  const brand = item?.brand || '—';
  const article = item?.article || '—';
  const path = buildPartDetailPath({ id: item.id, brand, article });
  const photoUrl = item?.photo_url ? normalizeImageUrl(item.photo_url) : null;
  const seller = item?.organization_name || 'Продавец';
  const city = item?.city || extractCityFromAddress(item?.organization_address) || '—';

  return (
    <article className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt={`${brand} ${article}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs text-gray-400">
            б/у
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">{brand}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 font-medium text-gray-700">{article}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-gray-900">{item?.name || '—'}</p>
          <p className="mt-1 text-lg font-bold text-indigo-600">{formatPrice(item?.price)}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-gray-600">
        <p><span className="text-gray-500">Продавец:</span> {seller}</p>
        <p><span className="text-gray-500">Город:</span> {city}</p>
      </div>
      <NewPartVehicleCompatibilityStrip vehicles={item?.compatible_vehicles} className="mt-3" />
      <Link
        to={path}
        className="mt-3 inline-flex min-h-[44px] items-center font-medium text-indigo-600 hover:text-indigo-800"
      >
        Открыть карточку
      </Link>
    </article>
  );
}

function UsedMatchRow({ item, formatPrice }) {
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

export default function PartArticleMatchesBlock({
  title,
  items = [],
  loading = false,
  error = '',
  currentProductId = null,
}) {
  const { formatPrice } = useProductPriceFormat();
  const visibleItems = useMemo(
    () => (Array.isArray(items) ? items : []).filter(
      (item) => item?.id != null && Number(item.id) !== Number(currentProductId),
    ),
    [items, currentProductId],
  );

  if (loading) {
    return (
      <section className="mt-6 sm:mt-8">
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
        <p className="mt-2 text-sm text-gray-500">Загрузка предложений…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-6 sm:mt-8">
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
        <p className="mt-2 text-sm text-gray-500">{error}</p>
      </section>
    );
  }

  if (!visibleItems.length) return null;

  return (
    <section className="mt-6 sm:mt-8">
      <div className="mb-4 flex items-center justify-between gap-2">
        <h2 className="text-lg font-bold text-gray-900 sm:text-xl">{title}</h2>
        <span className="shrink-0 text-sm text-gray-500">{visibleItems.length} шт.</span>
      </div>

      <div className="space-y-3 md:hidden">
        {visibleItems.map((item) => (
          <UsedMatchMobileCard key={`used-mobile-${item.id}`} item={item} formatPrice={formatPrice} />
        ))}
      </div>

      <div className="hidden rounded-2xl border border-gray-200 bg-white shadow-sm md:block">
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[56rem] w-full text-left text-sm">
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
              {visibleItems.map((item) => (
                <UsedMatchRow key={`used-row-${item.id}`} item={item} formatPrice={formatPrice} />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
