import React, { useState, useEffect } from 'react';

const PhotoGallery = ({ photos = [], onImageClick }) => {
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
    photoUrl = currentPhoto;
  } else if (currentPhoto?.full_url) {
    photoUrl = currentPhoto.full_url;
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
          className="w-full max-w-md h-56 object-cover rounded-lg border shadow-sm cursor-pointer hover:opacity-95 transition-opacity"
          onClick={() => onImageClick && onImageClick(photoUrl, `Фото ${currentPhotoIndex + 1}`)}
        />

        {/* Индикаторы для переключения (если фото > 1) */}
        {photos.length > 1 && (
          <>
            {/* Кнопки навигации */}
            <button
              onClick={() => setCurrentPhotoIndex(prev =>
                prev === 0 ? photos.length - 1 : prev - 1
              )}
              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black bg-opacity-50 text-white rounded-full w-8 h-8 flex items-center justify-center hover:bg-opacity-75 transition"
            >
              ‹
            </button>
            <button
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
              thumbUrl = photo;
            } else if (photo?.full_url) {
              thumbUrl = photo.full_url;
            } else if (photo instanceof File) {
              thumbUrl = objectUrls.get(index) || '';
            } else {
              thumbUrl = '';
            }

            return (
              <button
                key={index}
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
                  className="w-12 h-12 object-cover rounded"
                />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PhotoGallery;
