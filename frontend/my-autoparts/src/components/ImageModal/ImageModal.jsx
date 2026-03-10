import React, { useState, useEffect, useCallback } from 'react';
import { normalizeImageUrl } from '../../utils/apiClient';

const ImageModal = ({ isOpen, onClose, photos = [], videos = [], initialIndex = 0, alt = 'Изображение' }) => {
  // Combine photos and videos into a single media array
 const allMedia = React.useMemo(() => {
   const photoItems = (photos || []).map(photo => ({
      type: 'photo',
     item: photo,
      url: typeof photo === 'string' ? photo : (photo.full_url || photo.photo_url || '')
    }));
    
   const videoItems = (videos || []).map(video => ({
      type: 'video',
     item: video,
      url: typeof video === 'string' ? video : (video.full_url || video.video_url || '')
    }));
    
    return [...photoItems, ...videoItems];
  }, [photos, videos]);

  // Function to check if the file is a video
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
           item.toLowerCase().endsWith('.3gpp') ||
           item.toLowerCase().endsWith('.3gpp2') ||
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
           item.photo_url.toLowerCase().endsWith('.3gpp') ||
           item.photo_url.toLowerCase().endsWith('.3gpp2') ||
           item.photo_url.includes('/uploads/videos/') ||
           item.photo_url.includes('video/');
    }
   if (item?.video_url) {
      return item.video_url.toLowerCase().endsWith('.mp4') ||
           item.video_url.toLowerCase().endsWith('.avi') ||
           item.video_url.toLowerCase().endsWith('.mov') ||
           item.video_url.toLowerCase().endsWith('.wmv') ||
           item.video_url.toLowerCase().endsWith('.flv') ||
           item.video_url.toLowerCase().endsWith('.mkv') ||
           item.video_url.toLowerCase().endsWith('.webm') ||
           item.video_url.toLowerCase().endsWith('.m4v') ||
           item.video_url.toLowerCase().endsWith('.3gp') ||
           item.video_url.toLowerCase().endsWith('.mpeg') ||
           item.video_url.toLowerCase().endsWith('.mpg') ||
           item.video_url.toLowerCase().endsWith('.3gpp') ||
           item.video_url.toLowerCase().endsWith('.3gpp2') ||
           item.video_url.includes('/uploads/videos/') ||
           item.video_url.includes('video/');
    }
    return false;
  };
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
   if (!isOpen || !allMedia.length) return;

   const newUrls = new Map();

    allMedia.forEach((media, index) => {
     if (media.item instanceof File) {
       const url = URL.createObjectURL(media.item);
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
  }, [isOpen, allMedia]);

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
    setCurrentIndex(prev => prev === 0 ? allMedia.length - 1 : prev - 1);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [allMedia.length]);

 const goToNext = useCallback(() => {
    setCurrentIndex(prev => prev === allMedia.length - 1 ? 0 : prev + 1);
    setZoom(1);
    setPosition({ x: 0, y: 0 });
  }, [allMedia.length]);

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
  }, [isOpen, onClose, allMedia.length, goToNext, goToPrevious]);

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

  // Получаем URL текущего медиа и информацию о том, видео ли это
 const getCurrentMediaData = () => {
   if (!allMedia.length) return { url: '', isVideo: false };

   const currentMedia = allMedia[currentIndex];
    let url = '';
    let isCurrentVideo = false;

   if (currentMedia.type === 'video') {
      url = normalizeImageUrl(currentMedia.url);
      isCurrentVideo = true;
    } else if (typeof currentMedia.item === 'string') {
      url = normalizeImageUrl(currentMedia.item);
      isCurrentVideo = isVideo(currentMedia.item);
    } else if (currentMedia.item?.full_url) {
      url = normalizeImageUrl(currentMedia.item.full_url);
      isCurrentVideo = isVideo(currentMedia.item.full_url);
    } else if (currentMedia.item?.photo_url) {
      url = normalizeImageUrl(currentMedia.item.photo_url);
      isCurrentVideo = isVideo(currentMedia.item.photo_url);
    } else if (currentMedia.item?.video_url) {
      url = normalizeImageUrl(currentMedia.item.video_url);
      isCurrentVideo = isVideo(currentMedia.item.video_url);
    } else if (currentMedia.item instanceof File) {
      url = objectUrls.get(currentIndex) || '';
      isCurrentVideo = currentMedia.item.type && currentMedia.item.type.startsWith('video/');
    }
    
    return { url, isVideo: isCurrentVideo };
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
   if (zoom > 1 || allMedia.length <= 1) return; // Disable swipe when zoomed or single item

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

 const handleImageClick= (e) => {
   e.stopPropagation();
    // При клике на изображение увеличиваем/уменьшаем зум
   if (zoom === 1) {
      handleZoomIn();
    } else {
      handleResetZoom();
    }
  };

  if (!isOpen) return null;

 const currentMediaData = getCurrentMediaData();

  if (!allMedia.length || !currentMediaData.url) return null;

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
      {allMedia.length > 1 && (
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
          {currentMediaData.isVideo ? (
            <div className="relative">
              <video
                src={currentMediaData.url}
                className={`max-w-full max-h-full md:max-w-[90vw] md:max-h-[90vh] object-contain transition-transform duration-200 ${
                  isDragging ? 'cursor-grabbing' : 'cursor-grab'
                }`}
                style={{
                  transform: `scale(${zoom}) translate(${position.x}px, ${position.y}px)`,
                  transformOrigin: 'center center'
                }}
               onClick={handleImageClick}
               controls={true}
                muted
                playsInline
              />
            </div>
          ) : (
            <img
              src={currentMediaData.url}
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
          )}
        </div>
      </div>

      {/* Индикатор текущего изображения */}
      {allMedia.length > 1 && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-60 bg-black bg-opacity-50 text-white px-3 py-1 rounded text-sm">
          {currentIndex + 1} / {allMedia.length}
        </div>
      )}

      {/* Миниатюры */}
      {allMedia.length > 1 && (
        <div className="absolute bottom-20 md:bottom-16 left-1/2 transform -translate-x-1/2 z-60 flex gap-2 max-w-full overflow-x-auto px-4">
          {allMedia.map((media, index) => {
            let thumbUrl;
           const isThumbVideo = media.type === 'video' || isVideo(media.item);

           if (media.type === 'video') {
              thumbUrl = normalizeImageUrl(media.url);
            } else if (typeof media.item === 'string') {
              thumbUrl = normalizeImageUrl(media.item);
            } else if (media.item?.full_url) {
              thumbUrl = normalizeImageUrl(media.item.full_url);
            } else if (media.item?.photo_url) {
              thumbUrl = normalizeImageUrl(media.item.photo_url);
            } else if (media.item instanceof File) {
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
                {isThumbVideo ? (
                  <div className="relative">
                    <video
                      src={thumbUrl}
                      className="w-12 h-12 object-contain rounded"
                     controls={false}
                      muted
                      playsInline
                    />
                    <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                      <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                  </div>
                ) : (
                  <img
                    src={thumbUrl}
                    alt={`Миниатюра ${index + 1}`}
                    className="w-12 h-12 object-contain rounded"
                  />
                )}
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
        {allMedia.length > 1 && (
          <div className="hidden md:block">
            Стрелки ← → для навигации • Escape для выхода
          </div>
        )}
        {allMedia.length > 1 && (
          <div className="md:hidden">
            Свайп влево/вправо для перелистывания • Нажмите вне изображения для выхода
          </div>
        )}
        {allMedia.length === 1 && <div className="hidden md:block">Escape для выхода</div>}
        {allMedia.length === 1 && <div className="md:hidden">Нажмите вне изображения для выхода</div>}
      </div>
    </div>
  );
};

export default ImageModal;
