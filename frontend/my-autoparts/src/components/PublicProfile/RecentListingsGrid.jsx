import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { buildListImageUrlFallbackChain } from '../../utils/apiClient';
import { buildPartDetailPath } from '../../utils/partRoutes';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';
import { useProductPriceFormat } from '../../hooks/useProductPriceFormat';

const LIST_IMAGE_SIZES = '(max-width:640px) 50vw, 33vw';

function ListingCard({ product, listPriority = false }) {
  const { formatPrice } = useProductPriceFormat();
  const href = buildPartDetailPath(product);
  const title = formatProductDisplayTitle(product.brand, product.article, product.title);

  const photoUrl = useMemo(() => {
    const photos = product.photos || [];
    for (const photo of photos) {
      const chain = buildListImageUrlFallbackChain(photo);
      if (chain.length > 0) return chain[0];
    }
    return null;
  }, [product.photos]);

  return (
    <Link
      to={href}
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:border-indigo-200 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-gray-100">
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            className="h-full w-full object-cover transition group-hover:scale-[1.02]"
            width={400}
            height={300}
            sizes={LIST_IMAGE_SIZES}
            loading={listPriority ? 'eager' : 'lazy'}
            decoding="async"
            fetchPriority={listPriority ? 'high' : 'auto'}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-3">
        <p className="text-lg font-bold tabular-nums text-gray-900">
          {product.price ? formatPrice(product.price) : 'Цена по запросу'}
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-gray-700">{title}</p>
        {product.brand ? (
          <p className="mt-1 text-xs text-gray-500">{product.brand}</p>
        ) : null}
      </div>
    </Link>
  );
}

export default function RecentListingsGrid({ organizationId, products, total }) {
  const catalogHref = `/autoparts/used?organization_id=${encodeURIComponent(organizationId)}`;
  const items = Array.isArray(products) ? products.slice(0, 6) : [];

  if (!items.length) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-gray-50 p-6 text-center">
        <p className="text-sm text-gray-600">Сейчас нет объявлений в открытом каталоге.</p>
        <Link
          to={catalogHref}
          className="mt-3 inline-flex text-sm font-semibold text-indigo-600 hover:underline"
        >
          Перейти в каталог
        </Link>
      </section>
    );
  }

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Объявления</h2>
          <p className="mt-1 text-sm text-gray-600">
            {total ? `Всего ${total} позиций` : 'Последние объявления продавца'}
          </p>
        </div>
        <Link
          to={catalogHref}
          className="inline-flex items-center gap-1 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          Все объявления
          <span aria-hidden>→</span>
        </Link>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {items.map((product, index) => (
          <ListingCard key={product.id} product={product} listPriority={index < 2} />
        ))}
      </div>
    </section>
  );
}
