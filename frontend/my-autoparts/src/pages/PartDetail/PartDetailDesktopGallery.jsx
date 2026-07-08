import React from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';
import { buildProductPhotoAlt } from '../../utils/productSeo';

function isVideoItem(item) {
  const url = getMediaUrl(item);
  if (!url) return false;
  const lower = url.toLowerCase();
  const videoExt = ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.mkv', '.webm', '.m4v', '.3gp', '.mpeg', '.mpg'];
  if (videoExt.some((ext) => lower.endsWith(ext))) return true;
  return lower.includes('/uploads/videos/') || lower.includes('video/');
}

function getMediaUrl(item) {
  if (typeof item === 'string') return item;
  if (item?.full_url) return item.full_url;
  if (item?.photo_url) return item.photo_url;
  return '';
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
      <div className="flex h-80 items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50">
        <p className="text-sm text-gray-400">Нет фотографий или видео</p>
      </div>
    );
  }

  const currentItem = items[currentIndex];
  const mediaUrl = normalizeImageUrl(getMediaUrl(currentItem));
  const isVideo = isVideoItem(currentItem);
  const alt = mainAlt || buildProductPhotoAlt({ brand, article, name, isMain: true });

  return (
    <div className="flex gap-3 lg:gap-4">
      {items.length > 1 ? (
        <div className="flex max-h-[min(680px,72vh)] w-[4.75rem] shrink-0 flex-col gap-2.5 overflow-y-auto pr-0.5 lg:w-20">
          {items.map((item, index) => {
            const thumbUrl = normalizeImageUrl(getMediaUrl(item));
            const thumbIsVideo = isVideoItem(item);
            const isActive = index === currentIndex;
            return (
              <button
                key={index}
                type="button"
                onClick={() => onIndexChange(index)}
                className={`relative aspect-square w-full shrink-0 overflow-hidden rounded-lg border bg-gray-50 ${
                  isActive ? 'border-indigo-500 ring-1 ring-indigo-500' : 'border-gray-200 hover:border-gray-300'
                }`}
                aria-label={`Фото ${index + 1}`}
              >
                {thumbIsVideo ? (
                  <>
                    <video
                      src={thumbUrl}
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
                  <img
                    src={thumbUrl}
                    alt={buildProductPhotoAlt({ brand, article, name, index })}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </button>
            );
          })}
        </div>
      ) : null}

      <div className="relative min-w-0 flex-1">
        <div
          className="group relative min-h-[420px] aspect-[4/5] cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-gray-50 lg:min-h-[520px] lg:aspect-[3/4]"
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
                  <svg className="ml-0.5 h-10 w-10 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                  </svg>
                </div>
              </div>
              <div className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
                Видео
              </div>
            </div>
          ) : (
            <img
              src={mediaUrl}
              alt={alt}
              className="h-full w-full object-contain"
              loading="eager"
            />
          )}
        </div>

        {items.length > 1 ? (
          <>
            <button
              type="button"
              className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:text-indigo-600"
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
              className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-gray-600 shadow-sm hover:text-indigo-600"
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
