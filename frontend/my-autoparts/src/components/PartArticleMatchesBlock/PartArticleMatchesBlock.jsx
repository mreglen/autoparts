import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildPartDetailPath } from '../../utils/partRoutes';
import { normalizeImageUrl } from '../../utils/apiClient';
import { extractCityFromAddress } from '../../utils/organizationCity';
import NewPartVehicleCompatibilityStrip from '../../pages/AutoParts/NewParts/NewPartVehicleCompatibilityStrip';
import { useProductPriceFormat } from '../../hooks/useProductPriceFormat';
import { Card, SectionHeader } from '../UI';

function UsedMatchMobileCard({ item, formatPrice }) {
  const brand = item?.brand || '—';
  const article = item?.article || '—';
  const path = buildPartDetailPath({ id: item.id, brand, article });
  const photoUrl = item?.photo_url ? normalizeImageUrl(item.photo_url) : null;
  const seller = item?.organization_name || 'Продавец';
  const city = item?.city || extractCityFromAddress(item?.organization_address) || '—';

  return (
    <Card as="article" padding="sm">
      <div className="flex gap-3">
        {photoUrl ? (
          <img src={photoUrl} alt={`${brand} ${article}`} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sg bg-surface-subtle text-xs text-ink-faint">
            б/у
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="rounded bg-surface-subtle px-2 py-0.5 font-medium text-ink-soft">{brand}</span>
            <span className="rounded bg-surface-subtle px-2 py-0.5 font-medium text-ink-soft">{article}</span>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-semibold text-ink">{item?.name || '—'}</p>
          <p className="mt-1 text-lg font-bold text-accent-600">{formatPrice(item?.price)}</p>
        </div>
      </div>
      <div className="mt-3 space-y-1 text-xs text-ink-muted">
        <p><span className="text-ink-faint">Продавец:</span> {seller}</p>
        <p><span className="text-ink-faint">Город:</span> {city}</p>
      </div>
      <NewPartVehicleCompatibilityStrip vehicles={item?.compatible_vehicles} className="mt-3" />
      <Link
        to={path}
        className="mt-3 inline-flex min-h-[44px] items-center font-medium text-brand-600 hover:text-brand-800"
      >
        Открыть карточку
      </Link>
    </Card>
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
    <tr className="border-b border-line-soft last:border-0">
      <td className="px-3 py-2">
        {photoUrl ? (
          <img src={photoUrl} alt={`${brand} ${article}`} className="h-12 w-12 rounded-lg object-cover" />
        ) : (
          <div className="flex h-12 w-12 items-center justify-center rounded-sg bg-surface-subtle text-xs text-ink-faint">б/у</div>
        )}
      </td>
      <td className="px-3 py-2 text-ink-soft">{brand}</td>
      <td className="px-3 py-2 text-ink-soft">{article}</td>
      <td className="px-3 py-2 text-ink-soft">{item?.name || '—'}</td>
      <td className="px-3 py-2 font-medium text-ink">{formatPrice(item?.price)}</td>
      <td className="px-3 py-2 text-ink-muted">{seller}</td>
      <td className="px-3 py-2 text-ink-muted">{city}</td>
      <td className="px-3 py-2">
        <Link to={path} className="font-medium text-brand-600 hover:text-brand-800">
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
        <SectionHeader title={title} />
        <p className="mt-2 text-sm text-ink-muted">Загрузка предложений…</p>
      </section>
    );
  }

  if (error) {
    return (
      <section className="mt-6 sm:mt-8">
        <SectionHeader title={title} />
        <p className="mt-2 text-sm text-ink-muted">{error}</p>
      </section>
    );
  }

  if (!visibleItems.length) return null;

  return (
    <section className="mt-6 sm:mt-8">
      <SectionHeader
        title={title}
        className="mb-4"
        action={<span className="shrink-0 text-sm text-ink-muted">{visibleItems.length} шт.</span>}
      />

      <div className="space-y-3 md:hidden">
        {visibleItems.map((item) => (
          <UsedMatchMobileCard key={`used-mobile-${item.id}`} item={item} formatPrice={formatPrice} />
        ))}
      </div>

      <Card padding="none" className="hidden md:block">
        <div className="overflow-x-auto overscroll-x-contain touch-pan-x [-webkit-overflow-scrolling:touch]">
          <table className="min-w-[56rem] w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line bg-surface-muted text-xs uppercase tracking-wide text-ink-muted">
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
      </Card>
    </section>
  );
}
