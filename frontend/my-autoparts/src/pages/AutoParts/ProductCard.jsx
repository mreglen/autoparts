import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { buildListImageUrlFallbackChain } from '../../utils/apiClient';
import { extractProductDescription, formatProductDisplayTitle } from '../../utils/productDisplayName';
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
  /** Без native lazy (виртуализатор уже ограничивает DOM). */
  eagerImage = false,
  showFavorite = true,
  showNewBadge,
  compactMarketplace = false,
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
  const compactTitle = extractProductDescription(
    part.title || part.name,
    part.brand,
    part.article,
  ) || displayTitle;

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

  const listPreviews = useMemo(() => {
    if (isRossko) return null;
    const photos = part.photos || [];
    const previews = [];
    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      if (!isVideoItem(photo)) {
        const chain = buildListImageUrlFallbackChain(photo);
        if (chain.length > 0) {
          previews.push({ type: 'photo', url: chain[0], photo, urlChain: chain });
        }
      }
    }
    if (previews.length > 0) return previews;
    const videos = part.videos || [];
    if (videos.length > 0) {
      return [{ type: 'video', url: null }];
    }
    return [];
  }, [isRossko, part.photos, part.videos]);

  const [currentPreviewIndex, setCurrentPreviewIndex] = useState(0);
  const listPreview = listPreviews?.[currentPreviewIndex] || listPreviews?.[0] || null;
  const [photoSrc, setPhotoSrc] = useState(listPreview?.url || '');
  const [photoFallbackIndex, setPhotoFallbackIndex] = useState(0);
  const touchStartXRef = useRef(null);
  const didSwipeRef = useRef(false);
  const swipeResetTimerRef = useRef(null);

  useEffect(() => {
    setPhotoSrc(listPreview?.url || '');
    setPhotoFallbackIndex(0);
  }, [listPreview?.url]);

  useEffect(() => {
    setCurrentPreviewIndex(0);
  }, [product.id]);

  useEffect(() => () => {
    if (swipeResetTimerRef.current) {
      window.clearTimeout(swipeResetTimerRef.current);
    }
  }, []);

  const previewCount = listPreviews?.length || 0;

  const handlePreviewMouseMove = useCallback((event) => {
    if (!compactMarketplace || previewCount <= 1) return;
    const rect = event.currentTarget.getBoundingClientRect();
    if (!rect.width) return;
    const relativeX = Math.max(0, Math.min(rect.width - 1, event.clientX - rect.left));
    const nextIndex = Math.min(previewCount - 1, Math.floor((relativeX / rect.width) * previewCount));
    setCurrentPreviewIndex(nextIndex);
  }, [compactMarketplace, previewCount]);

  const handlePreviewTouchStart = useCallback((event) => {
    if (!compactMarketplace || previewCount <= 1) return;
    touchStartXRef.current = event.touches[0]?.clientX ?? null;
    didSwipeRef.current = false;
  }, [compactMarketplace, previewCount]);

  const handlePreviewTouchEnd = useCallback((event) => {
    const startX = touchStartXRef.current;
    const endX = event.changedTouches[0]?.clientX;
    touchStartXRef.current = null;
    if (startX == null || endX == null || previewCount <= 1) return;
    const deltaX = endX - startX;
    if (Math.abs(deltaX) < 35) return;
    didSwipeRef.current = true;
    if (swipeResetTimerRef.current) {
      window.clearTimeout(swipeResetTimerRef.current);
    }
    swipeResetTimerRef.current = window.setTimeout(() => {
      didSwipeRef.current = false;
    }, 400);
    setCurrentPreviewIndex((current) => (
      deltaX < 0
        ? Math.min(previewCount - 1, current + 1)
        : Math.max(0, current - 1)
    ));
  }, [previewCount]);

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
      <div className={compactMarketplace
        ? 'flex h-full flex-col bg-surface'
        : 'flex h-full flex-col overflow-hidden rounded-sg-lg border border-line bg-surface shadow-sg'}
      >
        <Link
          to={detailPath}
          className="group flex flex-1 flex-col text-inherit no-underline"
          onMouseEnter={prefetchDetail}
          onFocus={prefetchDetail}
          onTouchStart={prefetchDetail}
          onClick={(event) => {
            if (didSwipeRef.current) {
              event.preventDefault();
              didSwipeRef.current = false;
              if (swipeResetTimerRef.current) {
                window.clearTimeout(swipeResetTimerRef.current);
              }
            }
          }}
        >
          <div className={`relative flex w-full cursor-pointer items-center justify-center overflow-hidden bg-surface-muted ${
            compactMarketplace ? 'aspect-square touch-pan-y rounded-sg-lg' : 'aspect-[4/3]'
          }`}
            onMouseMove={handlePreviewMouseMove}
            onMouseLeave={() => {
              if (compactMarketplace && previewCount > 1) setCurrentPreviewIndex(0);
            }}
            onTouchStart={handlePreviewTouchStart}
            onTouchEnd={handlePreviewTouchEnd}
          >
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
                className={`h-full w-full ${compactMarketplace ? 'object-cover' : 'object-contain'}`}
                width={400}
                height={300}
                sizes="(max-width:640px) 50vw, (max-width:1280px) 33vw, 25vw"
                loading={(listPriority || eagerImage) ? 'eager' : 'lazy'}
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
            {compactMarketplace && previewCount > 1 ? (
              <div className="pointer-events-none absolute inset-x-2 bottom-2 flex gap-1">
                {listPreviews.map((_, index) => (
                  <span
                    key={index}
                    className={`h-1 flex-1 rounded-full shadow-sm ${
                      index === currentPreviewIndex ? 'bg-white' : 'bg-white/45'
                    }`}
                  />
                ))}
              </div>
            ) : null}
          </div>

          <div className="flex flex-1 flex-col">
            <div className={compactMarketplace ? 'flex-[2] space-y-0 px-0.5 pt-1.5' : 'flex-[2] space-y-0.5 p-2'}>
              {compactMarketplace ? (
                <>
                  <p className="line-clamp-2 cursor-pointer text-sm font-medium leading-[1.25rem] text-ink group-hover:text-brand-600 sm:text-[15px]">
                    {compactTitle}
                  </p>
                  <p className="truncate text-xs leading-[1.15rem] text-ink-muted sm:text-sm">
                    {[product.brand, product.article].filter(Boolean).join(' · ') || 'Без бренда и артикула'}
                  </p>
                  <div className="flex items-center gap-1">
                    <span className="text-base font-bold leading-5 text-ink sm:text-[17px]">{priceLabel}</span>
                    {product.originalPrice ? (
                      <span className="text-sm text-ink-faint line-through">{product.originalPrice}</span>
                    ) : null}
                  </div>
                </>
              ) : (
                <>
                  <div className="flex items-center gap-1">
                    <span className="text-[17px] font-bold text-ink">{priceLabel}</span>
                    {product.originalPrice ? (
                      <span className="text-[16px] text-ink-faint line-through">{product.originalPrice}</span>
                    ) : null}
                  </div>

                  <div className="flex-1 space-y-0.5">
                    <p className="line-clamp-2 cursor-pointer text-[15px] font-medium text-ink group-hover:text-brand-600">
                      {displayTitle}
                    </p>
                  </div>
                </>
              )}

              {!compactMarketplace && !hideWarehouse && !isRossko ? (
                <div className="flex items-center gap-0.5 text-[14px] text-ink-muted">
                  <span>{product.location || 'Скл'}</span>
                  {product.stock ? (
                    <span
                      className={`rounded-sg px-0.5 py-0.5 text-[14px] ${
                        product.stock > 0 ? 'bg-success-100 text-success-700' : 'bg-danger-100 text-danger-700'
                      }`}
                    >
                      {product.stock > 0 ? `В н: ${product.stock}` : 'Нет'}
                    </span>
                  ) : null}
                </div>
              ) : null}

              {!compactMarketplace && !hideConditionAndQuantity && !isRossko ? (
                <div className="flex flex-wrap gap-0.5 pt-0.5">
                  {product.isNew || product.is_new ? (
                    <span className="rounded-sg bg-brand-600 px-1 py-0.5 text-[14px] font-medium text-white">
                      Новое
                    </span>
                  ) : (
                    <span className="rounded-sg bg-accent-600 px-1 py-0.5 text-[14px] font-medium text-white">
                      Б/у
                    </span>
                  )}
                  {product.quantity !== undefined ? (
                    <span className="rounded-sg bg-brand-100 px-1 py-0.5 text-[14px] font-medium text-brand-700">
                      {product.quantity} шт.
                    </span>
                  ) : null}
                  {product.isDiscount ? (
                    <span className="rounded-sg bg-danger-600 px-1 py-0.5 text-[14px] font-medium text-white">
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
