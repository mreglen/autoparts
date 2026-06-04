import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pickListImageUrlNormalized } from '../../utils/apiClient';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';

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

const ProductCard = ({
  part,
  isTestOrganization = false,
  hideConditionAndQuantity = false,
  listPriority = false,
}) => {
  const navigate = useNavigate();
  const displayTitle = formatProductDisplayTitle(part.brand, part.article, part.title);
  const product = part;

  const listPreview = useMemo(() => {
    const photos = part.photos || [];
    for (let i = 0; i < photos.length; i += 1) {
      const photo = photos[i];
      if (!isVideoItem(photo)) {
        const url = pickListImageUrlNormalized(photo);
        if (url) {
          return { type: 'photo', url };
        }
      }
    }
    const videos = part.videos || [];
    if (videos.length > 0) {
      return { type: 'video', url: null };
    }
    return null;
  }, [part.photos, part.videos]);

  const handleTitleClick = () => {
    const productId = product.id || 'unknown';
    const brand = encodeURIComponent(product.brand || 'unknown');
    const article = encodeURIComponent(product.article || 'unknown');
    navigate(`/part/${productId}-${brand}-${article}`);
  };

  return (
    <div className="w-full">
      <div className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div
          className="bg-gray-50 aspect-[4/3] w-full flex items-center justify-center relative overflow-hidden cursor-pointer"
          onClick={handleTitleClick}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              handleTitleClick();
            }
          }}
        >
          {listPreview?.type === 'photo' && listPreview.url ? (
            <img
              src={listPreview.url}
              alt={displayTitle}
              className="h-full w-full object-contain"
              width={400}
              height={300}
              loading={listPriority ? 'eager' : 'lazy'}
              decoding="async"
              fetchPriority={listPriority ? 'high' : 'auto'}
            />
          ) : listPreview?.type === 'video' ? (
            <div className="flex flex-col items-center text-gray-500" aria-label="Есть видео">
              <svg className="w-14 h-14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              <span className="text-xs mt-1">Видео</span>
            </div>
          ) : (
            <div className="text-gray-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                />
              </svg>
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1">
          <div className="p-2 space-y-0.5 flex-[2]">
            <div className="flex items-center gap-1">
              <span className="text-[17px] font-bold text-gray-900">{product.price}</span>
              {product.originalPrice && (
                <span className="text-gray-400 line-through text-[16px]">{product.originalPrice}</span>
              )}
            </div>

            <div className="space-y-0.5 flex-1">
              <p
                className="text-[15px] text-gray-900 line-clamp-2 cursor-pointer hover:text-indigo-600 font-medium"
                onClick={handleTitleClick}
              >
                {displayTitle}
              </p>
            </div>

            <div className="flex items-center gap-0.5 text-[14px] text-gray-600">
              <span>{product.location || 'Скл'}</span>
              {product.stock && (
                <span
                  className={`text-[14px] px-0.5 py-0.5 rounded-full ${
                    product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}
                >
                  {product.stock > 0 ? `В н: ${product.stock}` : 'Нет'}
                </span>
              )}
            </div>

            {!hideConditionAndQuantity && (
              <div className="flex gap-0.5 pt-0.5 flex-wrap">
                {product.isNew ? (
                  <span className="bg-green-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    Новое
                  </span>
                ) : (
                  <span className="bg-yellow-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    Б/у
                  </span>
                )}
                {product.quantity !== undefined && (
                  <span className="bg-blue-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    {product.quantity} шт.
                  </span>
                )}
                {product.isDiscount && (
                  <span className="bg-red-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    Скидка
                  </span>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
