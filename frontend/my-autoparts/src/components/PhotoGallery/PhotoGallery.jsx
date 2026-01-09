import React, { useState, useEffect } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

const PhotoGallery = ({ photos = [], onImageClick, selectedPhotos = [], onPhotoSelect, onDeletePhoto }) => {
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
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

  const currentPhoto = photos[currentPhotoIndex];
  let photoUrl;

  if (typeof currentPhoto === 'string') {
    photoUrl = normalizeImageUrl(currentPhoto);
  } else if (currentPhoto?.full_url) {
    photoUrl = normalizeImageUrl(currentPhoto.full_url);
  } else if (currentPhoto?.photo_url) {
    photoUrl = normalizeImageUrl(currentPhoto.photo_url);
  } else if (currentPhoto instanceof File) {
    photoUrl = objectUrls.get(currentPhotoIndex) || '';
  } else {
    photoUrl = '';
  }

  return (
    <div className="space-y-3">
      {/* Основная большая фотография */}
      <div className="relative">
        <img
          src={photoUrl}
          alt={`Фото ${currentPhotoIndex + 1}`}
          className="w-full max-w-md h-56 object-contain rounded-lg border shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => onImageClick && onImageClick(photoUrl, `Фото ${currentPhotoIndex + 1}`)}
        />

        {/* Кнопка удаления для одиночного фото */}
        {onDeletePhoto && photos.length === 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              const photoId = photos[0]?.id || 0;
              onDeletePhoto(photoId);
            }}
            className="absolute top-2 right-2 bg-red-500 text-white rounded-full w-8 h-8 flex items-center justify-center shadow-lg hover:bg-red-600 transition-colors"
            title="Удалить фото"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </button>
        )}

        {/* Индикаторы для переключения (если фото > 1) */}
        {photos.length > 1 && (
          <>
            {/* Кнопки навигации */}
            <button
              type="button"
              onClick={() => setCurrentPhotoIndex(prev =>
                prev === 0 ? photos.length - 1 : prev - 1
              )}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75 transition"
            >
              ‹
            </button>
            <button
              type="button"
              onClick={() => setCurrentPhotoIndex(prev =>
                prev === photos.length - 1 ? 0 : prev + 1
              )}
              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75 transition"
            >
              ›
            </button>

            {/* Индикатор текущего фото */}
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 bg-black bg-opacity-50 text-white px-2 py-1 rounded text-xs">
              {currentPhotoIndex + 1} / {photos.length}
            </div>
          </>
        )}
      </div>

      {/* Миниатюры (если фото > 1) */}
      {photos.length > 1 && (
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
              <div key={index} className="relative">
                <button
                  type="button"
                  onClick={() => setCurrentPhotoIndex(index)}
                  className={`relative rounded border-2 transition ${
                    index === currentPhotoIndex
                      ? 'border-blue-500 shadow-md'
                      : 'border-gray-300 hover:border-gray-400'
                  }`}
                >
                  <img
                    src={thumbUrl}
                    alt={`Миниатюра ${index + 1}`}
                    className="w-12 h-12 object-contain rounded"
                  />
                </button>
                {onPhotoSelect && (
                  <div className="absolute -top-1 -right-1">
                    <input
                      type="checkbox"
                      checked={selectedPhotos.includes(photos[index]?.id || index)}
                      onChange={(e) => {
                        e.stopPropagation();
                        // Если фото - объект с ID, передаем ID, иначе индекс
                        const photoId = photos[index]?.id || index;
                        onPhotoSelect(photoId);
                      }}
                      className="w-4 h-4 text-red-600 bg-gray-100 border-gray-300 rounded focus:ring-red-500 focus:ring-2"
                      title="Выбрать для удаления"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
