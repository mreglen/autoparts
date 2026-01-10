import React, { useState, useEffect } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

const PhotoThumbnail = ({ photos = [], onImageClick }) => {
  const [objectUrls, setObjectUrls] = useState(new Map());

  // Создаем и очищаем object URLs для File объектов
  useEffect(() => {
    const newUrls = new Map();

    photos.forEach((photo, index) => {
      if (photo instanceof File) {
        const url = URL.createObjectURL(photo);
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


  return (
    <div className="flex flex-wrap gap-2">
      {photos.map((photo, index) => {
        let thumbUrl;

        if (typeof photo === 'string') {
          thumbUrl = normalizeImageUrl(photo);
        } else if (photo?.full_url) {
          thumbUrl = normalizeImageUrl(photo.full_url);
        } else if (photo?.photo_url) {
          thumbUrl = normalizeImageUrl(photo.photo_url);
        } else if (photo instanceof File) {
          thumbUrl = objectUrls.get(index) || '';
        } else {
          thumbUrl = '';
        }

        return (
          <img
            key={index}
            src={thumbUrl}
            alt={`Фото товара ${index + 1}`}
            className="w-20 h-20 md:w-24 md:h-24 object-contain rounded-lg border shadow-sm cursor-pointer hover:opacity-90 transition-opacity"
            onClick={(e) => {
              e.stopPropagation(); // Предотвращаем всплытие события
              onImageClick && onImageClick(photos, index);
            }}
            onError={(e) => {
              console.warn(`Failed to load image: ${thumbUrl}`);
              e.target.style.display = 'none'; // Скрываем сломанное изображение
            }}
            loading="lazy"
          />
        );
      })}
    </div>
  );
};

export default PhotoThumbnail;
