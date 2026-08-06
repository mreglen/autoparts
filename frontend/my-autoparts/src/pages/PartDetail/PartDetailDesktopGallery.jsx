import React from 'react';
import {
  normalizeImageUrl,
  pickFullImageUrlNormalized,
} from '../../utils/apiClient';
import { buildProductPhotoAlt } from '../../utils/productSeo';
import ProgressiveProductImage from '../../components/ProductMedia/ProgressiveProductImage';

function isVideoItem(item) {
  if (!item) return false;
  if (typeof item === 'string') {
    const lower = item.toLowerCase();
    return (
      ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp', '.mpeg', '.mpg'].some((ext) =>
        lower.endsWith(ext)
      ) ||
      lower.includes('/uploads/videos/') ||
      lower.includes('video/')
    );
  }
  const url = item.full_url || item.photo_url || item.url || '';
  return isVideoItem(url);
}

function getVideoUrl(item) {
  if (typeof item === 'string') return normalizeImageUrl(item);
  return pickFullImageUrlNormalized(item) || normalizeImageUrl(item?.photo_url || '');
}

export default function PartDetailDesktopGallery({
  items = [],
  currentIndex = 0,
  onIndexChange,
  onOpenModal,
  brand = '',
  article = '',
  name = '',
  mainAlt = '',
}) {
  if (!items.length) {
    return (
      <div className="flex h-80 items-center justify-center rounded-sg-lg border border-dashed border-line bg-surface-muted">
        <p className="text-sm text-ink-faint">Нет фотографий или видео</p>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const isVideo = isVideoItem(currentItem);
  const mediaUrl = isVideo ? getVideoUrl(currentItem) : pickFullImageUrlNormalized(currentItem);
  const alt = mainAlt || buildProductPhotoAlt({ brand, article, name, isMain: true });

  return (
    <div className="flex w-full min-w-0 gap-3 lg:gap-4">
      {items.length > 1 ? (
        <div className="flex max-h-[min(560px,70vh)] w-16 shrink-0 flex-col gap-2 overflow-y-auto pr-0.5 lg:w-[4.5rem]">
          {items.map((item, index) => {
            const thumbIsVideo = isVideoItem(item);
            const isActive = index === currentIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onIndexChange(index)}
                className={`relative aspect-square w-full shrink-0 overflow-hidden rounded-sg border bg-surface-muted ${
                  isActive ? 'border-brand-500 ring-1 ring-brand-500' : 'border-line hover:border-line-strong'
                }`}
                aria-label={`Фото ${index + 1}`}
              >
                {thumbIsVideo ? (
                  <>
                    <video
                      src={getVideoUrl(item)}
                      className="h-full w-full object-cover"
                      muted
                      playsInline
                      preload="metadata"
                    />
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/35">
                      <svg className="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                  </>
                ) : (
                  <ProgressiveProductImage
                    photo={item}
                    alt={buildProductPhotoAlt({ brand, article, name, index })}
                    className="h-full w-full object-cover"
                    upgradeToFull={false}
                    width={80}
                    height={80}
                    sizes="80px"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="relative min-w-0 flex-1 overflow-hidden">
        <div
          className="group relative aspect-square max-h-[min(560px,70vh)] w-full cursor-pointer overflow-hidden rounded-sg-lg border border-line bg-surface-muted shadow-sg"
          onClick={() => onOpenModal(currentIndex)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') onOpenModal(currentIndex);
          }}
        >
          {isVideo ? (
            <div className="relative h-full w-full">
              <video
                src={mediaUrl}
                className="h-full w-full object-contain"
                muted
                playsInline
                preload="metadata"
              />
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                <div className="rounded-full bg-white/90 p-4">
                  <svg className="ml-0.5 h-10 w-10 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </div>
              <div className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
                Видео
              </div>
            </div>
          ) : (
            <ProgressiveProductImage
              key={currentIndex}
              photo={currentItem}
              alt={alt}
              className="h-full w-full object-contain"
              priority
              upgradeToFull
              sizes="(max-width:1024px) 90vw, 480px"
            />
          )}
        </div>

        {items.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-line bg-surface p-2 text-ink-muted shadow-sg-sm hover:text-brand-600"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(currentIndex > 0 ? currentIndex - 1 : items.length - 1);
              }}
              aria-label="Предыдущее фото"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <button
              type="button"
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-line bg-surface p-2 text-ink-muted shadow-sg-sm hover:text-brand-600"
              onClick={(e) => {
                e.stopPropagation();
                onIndexChange(currentIndex < items.length - 1 ? currentIndex + 1 : 0);
              }}
              aria-label="Следующее фото"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
              </svg>
            </button>
            <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
              {currentIndex + 1} / {items.length}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
