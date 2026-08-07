import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import CatalogViewModeToggle from '../../components/CatalogViewModeToggle/CatalogViewModeToggle';
import FavoriteHeartOverlay from '../../components/FavoriteButton/FavoriteHeartOverlay';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';
import { buildNewPartOpenPath, buildPartDetailPath } from '../../utils/partRoutes';
import { engagementItemKey, isRosskoFavoriteItem } from '../../utils/favoriteKeys';
import { useProductPriceFormat } from '../../hooks/useProductPriceFormat';
import { ProfileEmptyLine, ProfileProductGrid, profileFullPageShell } from './profileUi';

function EngagementListRow({ part, formatPrice }) {
  const isRossko = isRosskoFavoriteItem(part);
  const title = formatProductDisplayTitle(part.brand, part.article, part.title || part.name);
  const detailPath = isRossko
    ? buildNewPartOpenPath({ brand: part.brand, article: part.article })
    : buildPartDetailPath(part);
  const priceLabel = part.price != null && part.price !== ''
    ? (typeof part.price === 'number' ? formatPrice(part.price) : part.price)
    : '—';

  return (
    <article className="relative overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      {isRossko ? (
        <FavoriteHeartOverlay
          rossko={{
            brand: part.brand,
            partnumber: part.article,
            guid: part.rossko_guid,
            title: part.name || part.title,
            minPrice: typeof part.price === 'number' ? part.price : undefined,
          }}
        />
      ) : (
        <FavoriteHeartOverlay productId={part.id} />
      )}
      <Link to={detailPath} className="flex gap-3 p-3 text-inherit no-underline sm:gap-4 sm:p-4">
        <div className="relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-gray-100 sm:h-24 sm:w-24">
          <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="line-clamp-2 text-sm font-semibold text-gray-900 sm:text-base">{title}</h3>
          <p className="mt-1 text-xs text-gray-500 sm:text-sm">
            {part.brand} · {part.article}
          </p>
          <p className="mt-2 text-base font-bold text-indigo-600">{priceLabel}</p>
        </div>
      </Link>
    </article>
  );
}

export default function ProfileEngagementProductsPage({
  items,
  loading,
  headerAction,
}) {
  const [viewMode, setViewMode] = useState('grid');
  const { formatPrice } = useProductPriceFormat();

  const content = useMemo(() => {
    if (viewMode === 'list') {
      if (loading) {
        return (
          <div className="space-y-3">
            {Array.from({ length: 4 }, (_, index) => (
              <div key={index} className="h-24 animate-pulse rounded-2xl bg-gray-100" />
            ))}
          </div>
        );
      }
      if (!items?.length) {
        return <ProfileEmptyLine />;
      }
      return (
        <div className="space-y-3">
          {items.map((part) => (
            <EngagementListRow key={engagementItemKey(part)} part={part} formatPrice={formatPrice} />
          ))}
        </div>
      );
    }

    return <ProfileProductGrid items={items} loading={loading} />;
  }, [items, loading, viewMode, formatPrice]);

  return (
    <div className={profileFullPageShell}>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="min-w-0">{headerAction}</div>
        <CatalogViewModeToggle value={viewMode} onChange={setViewMode} />
      </div>
      {content}
    </div>
  );
}
