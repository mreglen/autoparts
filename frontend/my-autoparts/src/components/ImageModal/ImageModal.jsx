import React, { useState, useEffect, useCallback } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

const ImageModal = ({ isOpen, onClose, photos = [], initialIndex = 0, alt = 'Изображение' }) => {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [objectUrls, setObjectUrls] = useState(new Map());

  // Swipe states
  const [swipeStart, setSwipeStart] = useState(null);
  const [swipeCurrent, setSwipeCurrent] = useState(null);
  const [isSwiping, setIsSwiping] = useState(false);

  // Создаем и очищаем object URLs для File объектов
  useEffect(() => {
    if (!isOpen || !photos.length) return;

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
  }, [isOpen, photos]);

  // Сброс состояния при закрытии
  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
      setCurrentIndex(initialIndex);
    }
  }, [isOpen, initialIndex]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex(prev => prev === 0 ? photos.length - 1 : prev - 1);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [photos.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex(prev => prev === photos.length - 1 ? 0 : prev + 1);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [photos.length]);

  // Обработчик клавиатуры для закрытия и навигации
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;

      switch (e.key) {
        case 'Escape':
          onClose();
          break;
        case 'ArrowLeft':
          e.preventDefault();
          goToPrevious();
          break;
        case 'ArrowRight':
          e.preventDefault();
          goToNext();
          break;
        default:
          break;
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      // Предотвращаем скролл body
      document.body.style.overflow = 'hidden';
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, onClose, photos.length, goToNext, goToPrevious]);

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev * 1.2, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev / 1.2, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  const goToImage = (index) => {
    setCurrentIndex(index);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  };

  // Получаем URL текущего изображения
  const getCurrentImageUrl = () => {
    if (!photos.length) return '';

    const currentPhoto = photos[currentIndex];
    if (typeof currentPhoto === 'string') {
      return normalizeImageUrl(currentPhoto);
    } else if (currentPhoto?.full_url) {
      return normalizeImageUrl(currentPhoto.full_url);
    } else if (currentPhoto?.photo_url) {
      return normalizeImageUrl(currentPhoto.photo_url);
    } else if (currentPhoto instanceof File) {
      return objectUrls.get(currentIndex) || '';
    }
    return '';
  };

  const handleMouseDown = (e) => {
    if (zoom > 1) {
      setIsDragging(true);
      setDragStart({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging && zoom > 1) {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Обработка touch событий для мобильных устройств
  const handleTouchStart = (e) => {
    if (zoom > 1 && e.touches.length === 1) {
      setIsDragging(true);
      const touch = e.touches[0];
      setDragStart({
        x: touch.clientX - position.x,
        y: touch.clientY - position.y
      });
    }
  };

  const handleTouchMove = (e) => {
    if (isDragging && zoom > 1 && e.touches.length === 1) {
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStart.x,
        y: touch.clientY - dragStart.y
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
  };

  // Swipe handling functions
  const handleSwipeStart = (e) => {
    if (zoom > 1 || photos.length <= 1) return; // Disable swipe when zoomed or single image

    const touch = e.touches[0];
    setSwipeStart({ x: touch.clientX, y: touch.clientY });
    setSwipeCurrent({ x: touch.clientX, y: touch.clientY });
    setIsSwiping(true);
  };

  const handleSwipeMove = (e) => {
    if (!isSwiping || zoom > 1) return;

    const touch = e.touches[0];
    setSwipeCurrent({ x: touch.clientX, y: touch.clientY });
  };

  const handleSwipeEnd = () => {
    if (!isSwiping || !swipeStart || !swipeCurrent) {
      setIsSwiping(false);
      setSwipeStart(null);
      setSwipeCurrent(null);
      return;
    }

    const deltaX = swipeCurrent.x - swipeStart.x;
    const deltaY = Math.abs(swipeCurrent.y - swipeStart.y);
    const minSwipeDistance = 50; // Minimum distance for swipe recognition

    // Check if horizontal swipe is significant and not too vertical
    if (Math.abs(deltaX) > minSwipeDistance && deltaY < minSwipeDistance) {
      if (deltaX > 0) {
        // Swipe right - go to previous image
        goToPrevious();
      } else {
        // Swipe left - go to next image
        goToNext();
      }
    }

    // Reset swipe states
    setIsSwiping(false);
    setSwipeStart(null);
    setSwipeCurrent(null);
  };

  const handleImageClick = (e) => {
    e.stopPropagation();
    // При клике на изображение увеличиваем/уменьшаем зум
    if (zoom === 1) {
      handleZoomIn();
    } else {
      handleResetZoom();
    }
  };

  if (!isOpen) return null;

  const currentImageUrl = getCurrentImageUrl();

  if (!photos.length || !currentImageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
      onClick={onClose}
    >
      {/* Кнопка закрытия */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-60 text-white hover:text-gray-300 transition-colors"
      >
        <img src="/img/close_md.svg" alt="Закрыть" className="w-6 h-6" />
      </button>

      {/* Кнопки управления зумом */}
      <div className="absolute top-4 left-4 z-60 flex flex-col gap-2">
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomIn(); }}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1 rounded transition-colors"
        >
          +
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleZoomOut(); }}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-3 py-1 rounded transition-colors"
        >
          −
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
          className="bg-white bg-opacity-20 hover:bg-opacity-30 text-white px-2 py-1 rounded text-xs transition-colors"
        >
          1:1
        </button>
      </div>

      {/* Кнопки навигации между изображениями (только для десктопа) */}
      {photos.length > 1 && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); goToPrevious(); }}
            className="hidden md:flex absolute left-4 top-1/2 transform -translate-y-1/2 z-60 bg-white bg-opacity-20 hover:bg-opacity-30 text-white w-12 h-12 rounded-full items-center justify-center transition-colors"
          >
            ‹
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); goToNext(); }}
            className="hidden md:flex absolute right-4 top-1/2 transform -translate-y-1/2 z-60 bg-white bg-opacity-20 hover:bg-opacity-30 text-white w-12 h-12 rounded-full items-center justify-center transition-colors"
          >
            ›
          </button>
        </>
      )}

      {/* Изображение */}
      <div className="flex items-center justify-center w-full h-full p-4">
        <div
          className="relative overflow-hidden cursor-move"
          onClick={(e) => e.stopPropagation()}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={(e) => {
            if (zoom <= 1) {
              handleSwipeStart(e);
            } else {
              handleTouchStart(e);
            }
          }}
          onTouchMove={(e) => {
            if (isSwiping) {
              handleSwipeMove(e);
            } else {
              handleTouchMove(e);
            }
          }}
          onTouchEnd={() => {
            if (isSwiping) {
              handleSwipeEnd();
            } else {
              handleTouchEnd();
            }
          }}
        >
          <img
            src={currentImageUrl}
            alt={`${alt} ${currentIndex + 1}`}
            className={`max-w-full max-h-full md:max-w-[90vw] md:max-h-[90vh] object-contain transition-transform duration-200 ${
              isDragging ? 'cursor-grabbing' : 'cursor-grab'
            }`}
            style={{
              transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
              transformOrigin: 'center center'
            }}
            onClick={handleImageClick}
            draggable={false}
          />
        </div>
      </div>

      {/* Индикатор текущего изображения */}
      {photos.length > 1 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-60 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      {/* Миниатюры */}
      {photos.length > 1 && (
        <div className="absolute bottom-20 md:bottom-16 left-1/2 transform -translate-x-1/2 z-60 flex gap-2 max-w-full overflow-x-auto px-4">
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
              <button
                key={index}
                onClick={(e) => { e.stopPropagation(); goToImage(index); }}
                className={`relative rounded border-2 transition-all flex-shrink-0 ${
                  index === currentIndex
                    ? 'border-white shadow-lg scale-110'
                    : 'border-white border-opacity-50 hover:border-opacity-75'
                }`}
              >
                <img
                  src={thumbUrl}
                  alt={`Миниатюра ${index + 1}`}
                  className="w-12 h-12 object-contain rounded"
                />
              </button>
            );
          })}
        </div>
      )}

      {/* Инструкции */}
      <div className="absolute bottom-2 md:bottom-4 left-1/2 transform -translate-x-1/2 text-white text-xs md:text-sm opacity-70 text-center px-4">
        <div className="hidden md:block">
          Кликните на изображение для зума • Используйте кнопки + и −
        </div>
        <div className="md:hidden">
          Двойное касание для зума • Используйте кнопки + и −
        </div>
        {photos.length > 1 && (
          <div className="hidden md:block">
            Стрелки ← → для навигации • Escape для выхода
          </div>
        )}
        {photos.length > 1 && (
          <div className="md:hidden">
            Свайп влево/вправо для перелистывания • Нажмите вне изображения для выхода
          </div>
        )}
        {photos.length === 1 && <div className="hidden md:block">Escape для выхода</div>}
        {photos.length === 1 && <div className="md:hidden">Нажмите вне изображения для выхода</div>}
      </div>
    </div>
  );
};

export default ImageModal;
