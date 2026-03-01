import React, { useState, useEffect } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

const PhotoThumbnail = ({ photos = [], onImageClick }) => {
  const [objectUrls, setObjectUrls] = useState(new Map());

  // Создаем и очищаем object URLs для File объектов
  useEffect(() => {
    const newUrls = new Map();

    photos.forEach((item, index) => {
      if (item instanceof File) {
        const url = URL.createObjectURL(item);
        newUrls.set(index, url);
      }
    });

    setObjectUrls(newUrls);

    // Cleanup function
    return () => {
      newUrls.forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [photos]);

  // Cleanup при размонтировании
  useEffect(() => {
    return () => {
      objectUrls.forEach(url => {
        URL.revokeObjectURL(url);
      });
    };
  }, [objectUrls]);

  if (!photos || photos.length === 0) {
    return <div className="text-gray-500 italic">Нет фото</div>;
  }

  const isVideo = (item) => {
    if (typeof item === 'string') {
      return item.toLowerCase().endsWith('.mp4') ||
             item.toLowerCase().endsWith('.avi') ||
             item.toLowerCase().endsWith('.mov') ||
             item.toLowerCase().endsWith('.wmv') ||
             item.toLowerCase().endsWith('.flv') ||
             item.toLowerCase().endsWith('.mkv') ||
             item.toLowerCase().endsWith('.webm') ||
             item.toLowerCase().endsWith('.m4v') ||
             item.toLowerCase().endsWith('.3gp') ||
             item.toLowerCase().endsWith('.mpeg') ||
             item.toLowerCase().endsWith('.mpg') ||
             item.includes('/uploads/videos/') ||
             item.includes('video/');
    }
    if (item instanceof File) {
      return item.type && item.type.startsWith('video/');
    }
    if (item?.photo_url) {
      return item.photo_url.toLowerCase().endsWith('.mp4') ||
             item.photo_url.toLowerCase().endsWith('.avi') ||
             item.photo_url.toLowerCase().endsWith('.mov') ||
             item.photo_url.toLowerCase().endsWith('.wmv') ||
             item.photo_url.toLowerCase().endsWith('.flv') ||
             item.photo_url.toLowerCase().endsWith('.mkv') ||
             item.photo_url.toLowerCase().endsWith('.webm') ||
             item.photo_url.toLowerCase().endsWith('.m4v') ||
             item.photo_url.toLowerCase().endsWith('.3gp') ||
             item.photo_url.toLowerCase().endsWith('.mpeg') ||
             item.photo_url.toLowerCase().endsWith('.mpg') ||
             item.photo_url.includes('/uploads/videos/') ||
             item.photo_url.includes('video/');
    }
    return false;
  };

  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((item, index) => {
        let mediaUrl;

        if (typeof item === 'string') {
          mediaUrl = normalizeImageUrl(item);
        } else if (item?.full_url) {
          mediaUrl = normalizeImageUrl(item.full_url);
        } else if (item?.photo_url) {
          mediaUrl = normalizeImageUrl(item.photo_url);
        } else if (item instanceof File) {
          mediaUrl = objectUrls.get(index) || '';
        } else {
          mediaUrl = '';
        }

        if (isVideo(item)) {
          return (
            <div key={index} className="relative">
              <video
                src={mediaUrl}
                className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
                onClick={(e) => {
                  e.stopPropagation(); // Предотвращаем всплытие события
                  onImageClick && onImageClick(photos, index);
                }}
                controls={false}
                muted
                playsInline
              />
              <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg">
                <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                </svg>
              </div>
            </div>
          );
        } else {
          return (
            <img
              key={index}
              src={mediaUrl}
              alt={`Фото товара ${index + 1}`}
              className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
              onClick={(e) => {
                e.stopPropagation(); // Предотвращаем всплытие события
                onImageClick && onImageClick(photos, index);
              }}
              onError={(e) => {
                console.warn(`Failed to load media: ${mediaUrl}`);
                e.target.style.display = 'none'; // Скрываем сломанное изображение
              }}
              loading="lazy"
            />
          );
        }
      })}
    </div>
  );
};

export default PhotoThumbnail;
