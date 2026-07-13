import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { buildListImageUrlFallbackChain } from '../../utils/apiClient';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';
import { buildNewPartOpenPath, buildPartDetailPath } from '../../utils/partRoutes';
import { prefetchUsedPartDetail } from '../../utils/prefetchPartDetail';
import { isRosskoFavoriteItem } from '../../utils/favoriteKeys';
import CatalogNewBadge from '../../components/CatalogNewBadge/CatalogNewBadge';
import FavoriteHeartOverlay from '../../components/FavoriteButton/FavoriteHeartOverlay';

const isVideoUrl = (value) => {
  if (!value || typeof value !== 'string') return false;
  const lower = value.toLowerCase();
  return (
    lower.endsWith('.mp4')
    || lower.endsWith('.avi')
    || lower.endsWith('.mov')
    || lower.endsWith('.wmv')
    || lower.endsWith('.flv')
    || lower.endsWith('.mkv')
    || lower.endsWith('.webm')
    || lower.endsWith('.m4v')
    || lower.endsWith('.3gp')
    || lower.endsWith('.mpeg')
    || lower.endsWith('.mpg')
    || lower.endsWith('.3gpp')
    || lower.endsWith('.3gpp2')
    || lower.includes('/uploads/videos/')
    || lower.includes('video/')
  );
};

const isVideoItem = (item) => {
  if (typeof item === 'string') return isVideoUrl(item);
  if (item instanceof File) return item.type && item.type.startsWith('video/');
  if (item?.photo_url) return isVideoUrl(item.photo_url);
  if (item?.video_url) return true;
  return false;
};

function PhotoPlaceholder() {
  return (
    <div className="text-gray-400">
      <svg className="h-16 w-16 sm:h-20 sm:w-20" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
        />
      </svg>
    </div>
  );
}

const ProductCard = ({
  part,
  isTestOrganization = false,
  hideConditionAndQuantity = false,
  hideWarehouse = false,
  listPriority = false,
  showFavorite = true,
  showNewBadge,
}) => {
  const dispatch = useDispatch();
  const product = part;
  const isRossko = isRosskoFavoriteItem(part);
  const displayTitle = formatProductDisplayTitle(
    part.brand,
    part.article,
    part.title || part.name,
  );
  const shouldShowNewBadge = showNewBadge ?? isRossko;

  const detailPath = useMemo(() => {
    if (isRossko) {
      return buildNewPartOpenPath({ brand: part.brand, article: part.article });
    }
    return buildPartDetailPath({
      id: product.id,
      brand: product.brand,
      article: product.article,
    });
  }, [isRossko, part.brand, part.article, product.id, product.brand, product.article]);

  const prefetchDetail = useCallback(() => {
    if (!isRossko && product.id) {
      prefetchUsedPartDetail(product.id, dispatch);
    }
  }, [dispatch, isRossko, product.id]);

  const listPreview = useMemo(() => {
    if (isRossko) return null;
    const photos = part.photos || [];
    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      if (!isVideoItem(photo)) {
        const chain = buildListImageUrlFallbackChain(photo);
        if (chain.length > 0) {
          return { type: 'photo', url: chain[0], photo, urlChain: chain };
        }
      }
    }
    const videos = part.videos || [];
    if (videos.length > 0) {
      return { type: 'video', url: null };
    }
    return null;
  }, [isRossko, part.photos, part.videos]);

  const [photoSrc, setPhotoSrc] = useState(listPreview?.url || '');
  const [photoFallbackIndex, setPhotoFallbackIndex] = useState(0);

  useEffect(() => {
    setPhotoSrc(listPreview?.url || '');
    setPhotoFallbackIndex(0);
  }, [listPreview?.url]);

  const priceLabel = useMemo(() => {
    const raw = product.price;
    if (raw == null || raw === '') return '—';
    if (typeof raw === 'number') {
      return `${raw.toLocaleString('ru-RU')} ₽`;
    }
    return raw;
  }, [product.price]);

  const rosskoFavorite = isRossko
    ? {
        brand: part.brand,
        partnumber: part.article,
        guid: part.rossko_guid,
        title: part.name || part.title,
        minPrice: typeof part.price === 'number' ? part.price : undefined,
      }
    : null;

  return (
    <div className="w-full">
      <div className="flex h-full flex-col overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <Link
          to={detailPath}
          className="group flex flex-1 flex-col text-inherit no-underline"
          onMouseEnter={prefetchDetail}
          onFocus={prefetchDetail}
          onTouchStart={prefetchDetail}
        >
          <div className="relative flex aspect-[4/3] w-full cursor-pointer items-center justify-center overflow-hidden bg-gray-50">
            {shouldShowNewBadge ? <CatalogNewBadge /> : null}
            {showFavorite ? (
              isRossko ? (
                <FavoriteHeartOverlay rossko={rosskoFavorite} />
              ) : (
                <FavoriteHeartOverlay productId={product.id} />
              )
            ) : null}
            {listPreview?.type === 'photo' && photoSrc ? (
              <img
                src={photoSrc}
                alt={displayTitle}
                className="h-full w-full object-contain"
                width={400}
                height={300}
                sizes="(max-width:640px) 50vw, (max-width:1280px) 33vw, 25vw"
                loading={listPriority ? 'eager' : 'lazy'}
                decoding="async"
                fetchPriority={listPriority ? 'high' : 'auto'}
                onError={() => {
                  const chain = listPreview?.urlChain || [];
                  const nextIndex = photoFallbackIndex + 1;
                  if (nextIndex < chain.length && chain[nextIndex] !== photoSrc) {
                    setPhotoFallbackIndex(nextIndex);
                    setPhotoSrc(chain[nextIndex]);
                  }
                }}
              />
            ) : listPreview?.type === 'video' ? (
              <div className="flex flex-col items-center text-gray-500" aria-label="Есть видео">
                <svg className="h-14 w-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
                <span className="mt-1 text-xs">Видео</span>
              </div>
            ) : (
              <PhotoPlaceholder />
            )}
          </div>

          <div className="flex flex-1 flex-col">
            <div className="flex-[2] space-y-0.5 p-2">
              <div className="flex items-center gap-1">
                <span className="text-[17px] font-bold text-gray-900">{priceLabel}</span>
                {product.originalPrice ? (
                  <span className="text-[16px] text-gray-400 line-through">{product.originalPrice}</span>
                ) : null}
              </div>

              <div className="flex-1 space-y-0.5">
                <p className="line-clamp-2 cursor-pointer text-[15px] font-medium text-gray-900 group-hover:text-indigo-600">
                  {displayTitle}
                </p>
              </div>

              {!hideWarehouse && !isRossko ? (
                <div className="flex items-center gap-0.5 text-[14px] text-gray-600">
                  <span>{product.location || 'Скл'}</span>
                  {product.stock ? (
                    <span
                      className={`rounded-full px-0.5 py-0.5 text-[14px] ${
                        product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {product.stock > 0 ? `В н: ${product.stock}` : 'Нет'}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {!hideConditionAndQuantity && !isRossko ? (
                <div className="flex flex-wrap gap-0.5 pt-0.5">
                  {product.isNew || product.is_new ? (
                    <span className="rounded-full bg-green-500 px-1 py-0.5 text-[14px] font-medium text-white">
                      Новое
                    </span>
                  ) : (
                    <span className="rounded-full bg-yellow-500 px-1 py-0.5 text-[14px] font-medium text-white">
                      Б/у
                    </span>
                  )}
                  {product.quantity !== undefined ? (
                    <span className="rounded-full bg-blue-500 px-1 py-0.5 text-[14px] font-medium text-white">
                      {product.quantity} шт.
                    </span>
                  ) : null}
                  {product.isDiscount ? (
                    <span className="rounded-full bg-red-500 px-1 py-0.5 text-[14px] font-medium text-white">
                      Скидка
                    </span>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default React.memo(ProductCard);
