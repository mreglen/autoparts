import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Z_MODAL } from '../../constants/mobileTokens';
import { useChatMediaBlobUrl, downloadChatMedia } from '../../utils/chatMediaAuth';

function LightboxMediaContent({ media, imageLoaded, setImageLoaded, chatInfo, onImageClick, onVideoClick }) {
  const needsAuth = Boolean(media?.id != null && !media?.url);
  const { url: blobUrl, loading, error } = useChatMediaBlobUrl(media?.id, { enabled: needsAuth });
  const src = media?.url || blobUrl;
  const isImage = media?.media_type === 'image';
  const isVideo = media?.media_type === 'video';

  if (needsAuth && loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <svg className="h-12 w-12 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
      </div>
    );
  }

  if (!src || error) {
    return <p className="text-white text-center">Не удалось загрузить медиа</p>;
  }

  if (isImage) {
    return (
      <div className="relative">
        {!imageLoaded && (
          <div className="flex items-center justify-center">
            <svg className="animate-spin h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        )}
        <img
          src={src}
          alt={media.original_filename || 'Изображение'}
          className={`max-w-full max-h-[90vh] object-contain transition-opacity duration-300 ${
            chatInfo?.isAvito && (chatInfo?.linkedProductId || chatInfo?.contextUrl) ? 'cursor-pointer hover:opacity-90' : ''
          } ${imageLoaded ? 'opacity-100' : 'opacity-0 absolute inset-0'}`}
          onLoad={() => setImageLoaded(true)}
          onClick={onImageClick}
        />
      </div>
    );
  }

  if (isVideo) {
    return (
      <video
        controls
        src={src}
        className={`max-w-full max-h-[90vh] object-contain ${
          chatInfo?.isAvito && (chatInfo?.linkedProductId || chatInfo?.contextUrl) ? 'cursor-pointer hover:opacity-90' : ''
        }`}
        autoPlay
        onClick={onVideoClick}
      >
        Ваш браузер не поддерживает воспроизведение видео.
      </video>
    );
  }

  return (
    <div className="text-white text-center">
      <svg className="w-20 h-20 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
      <p className="text-lg mb-2">Этот тип медиа не поддерживается</p>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          if (needsAuth && media?.id) {
            downloadChatMedia(media.id, media.original_filename);
          } else if (src) {
            window.open(src, '_blank', 'noopener,noreferrer');
          }
        }}
        className="inline-block px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        Скачать файл
      </button>
    </div>
  );
}

/**
 * Универсальный компонент для просмотра медиа из чата в модальном окне
 * Поддерживает навигацию между всеми медиа сообщениями чата
 */
const MediaLightbox = ({ 
  mediaItems, 
  currentIndex, 
  isOpen, 
  onClose,
  onIndexChange,
  chatInfo  // { isAvito: boolean, linkedProductId: number|null, contextUrl: string|null }
}) => {
  const [currentIdx, setCurrentIdx] = useState(currentIndex || 0);
  const [imageLoaded, setImageLoaded] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);
  const containerRef = useRef(null);

  // Минимальное расстояние для свайпа
  const minSwipeDistance = 50;

  // Сбрасываем состояние при открытии
  useEffect(() => {
    if (isOpen) {
      setCurrentIdx(currentIndex || 0);
      setImageLoaded(false);
    }
  }, [isOpen, currentIndex]);

  // Закрытие по Escape
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (!isOpen) return;
      
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft') {
        goToPrevious();
      } else if (e.key === 'ArrowRight') {
        goToNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentIdx]);

  // Блокируем скролл body при открытом lightbox
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const goToPrevious = useCallback(() => {
    if (currentIdx > 0) {
      const newIdx = currentIdx - 1;
      setCurrentIdx(newIdx);
      setImageLoaded(false);
      onIndexChange?.(newIdx);
    }
  }, [currentIdx, onIndexChange]);

  const goToNext = useCallback(() => {
    if (currentIdx < mediaItems.length - 1) {
      const newIdx = currentIdx + 1;
      setCurrentIdx(newIdx);
      setImageLoaded(false);
      onIndexChange?.(newIdx);
    }
  }, [currentIdx, mediaItems.length, onIndexChange]);

  const onTouchStart = (e) => {
    setTouchEnd(null);
    setTouchStart(e.targetTouches[0].clientX);
  };

  const onTouchMove = (e) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };

  const onTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;

    if (isLeftSwipe) {
      goToNext();
    } else if (isRightSwipe) {
      goToPrevious();
    }
  };

  // Handle image click for Avito chats
  const handleImageClick = (e) => {
    e.stopPropagation();
    
    if (!chatInfo || !chatInfo.isAvito) {
      return; // Do nothing for garage chats
    }
    
    if (chatInfo.linkedProductId) {
      // Navigate to product page
      window.location.href = `/part/${chatInfo.linkedProductId}`;
    } else if (chatInfo.contextUrl) {
      // No link found - open ProductNotFound page in new tab
      const encodedUrl = encodeURIComponent(chatInfo.contextUrl);
      window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
    }
  };

  // Handle video click for Avito chats
  const handleVideoClick = (e) => {
    e.stopPropagation();
    
    if (!chatInfo || !chatInfo.isAvito) {
      return; // Do nothing for garage chats
    }
    
    if (chatInfo.linkedProductId) {
      // Navigate to product page
      window.location.href = `/part/${chatInfo.linkedProductId}`;
    } else if (chatInfo.contextUrl) {
      // No link found - open ProductNotFound page in new tab
      const encodedUrl = encodeURIComponent(chatInfo.contextUrl);
      window.open(`/product-not-found?avitoUrl=${encodedUrl}`, '_blank');
    }
  };

  if (!isOpen || !mediaItems || mediaItems.length === 0) return null;

  const currentMedia = mediaItems[currentIdx];
  const isImage = currentMedia?.media_type === 'image';
  const isVideo = currentMedia?.media_type === 'video';

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-95 flex items-center justify-center"
      style={{ zIndex: Z_MODAL }}
      onClick={handleBackdropClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      ref={containerRef}
    >
      {/* Кнопка закрытия */}
      <button
        className="absolute top-4 right-4 z-50 text-white hover:text-gray-300 transition-colors p-2"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
        aria-label="Закрыть"
      >
        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>

      {/* Счетчик */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-sm">
        {currentIdx + 1} / {mediaItems.length}
      </div>

      {/* Hint for Avito chats */}
      {chatInfo?.isAvito && (chatInfo?.linkedProductId || chatInfo?.contextUrl) && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 bg-black bg-opacity-50 text-white px-4 py-2 rounded-full text-xs">
          Нажмите на фото для перехода к {chatInfo.linkedProductId ? 'товару' : 'объявлению'}
        </div>
      )}

      {/* Кнопка Назад */}
      {currentIdx > 0 && (
        <button
          className="absolute left-4 z-50 text-white hover:text-gray-300 transition-colors p-3 bg-black bg-opacity-30 rounded-full hover:bg-opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            goToPrevious();
          }}
          aria-label="Предыдущее медиа"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}

      {/* Кнопка Вперед */}
      {currentIdx < mediaItems.length - 1 && (
        <button
          className="absolute right-4 z-50 text-white hover:text-gray-300 transition-colors p-3 bg-black bg-opacity-30 rounded-full hover:bg-opacity-50"
          onClick={(e) => {
            e.stopPropagation();
            goToNext();
          }}
          aria-label="Следующее медиа"
        >
          <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}

      {/* Контент */}
      <div className="relative max-w-full max-h-full flex items-center justify-center p-4">
        {(isImage || isVideo || currentMedia) && (
          <LightboxMediaContent
            media={currentMedia}
            imageLoaded={imageLoaded}
            setImageLoaded={setImageLoaded}
            chatInfo={chatInfo}
            onImageClick={handleImageClick}
            onVideoClick={handleVideoClick}
          />
        )}
      </div>

      {/* Миниатюры внизу */}
      {mediaItems.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 flex gap-2 max-w-[80vw] overflow-x-auto pb-2">
          {mediaItems.map((media, idx) => (
            <button
              key={media.id || idx}
              className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all ${
                idx === currentIdx 
                  ? 'border-white scale-110' 
                  : 'border-transparent opacity-60 hover:opacity-100'
              }`}
              onClick={(e) => {
                e.stopPropagation();
                setCurrentIdx(idx);
                setImageLoaded(false);
                onIndexChange?.(idx);
              }}
            >
              {media.media_type === 'image' ? (
                <img
                  src={media.url}
                  alt=""
                  className="w-full h-full object-cover"
                />
              ) : media.media_type === 'video' ? (
                <div className="relative w-full h-full bg-gray-800 flex items-center justify-center">
                  <video
                    src={media.url}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-40">
                    <svg className="w-6 h-6 text-white" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M8 5v14l11-7z"/>
                    </svg>
                  </div>
                </div>
              ) : (
                <div className="w-full h-full bg-gray-700 flex items-center justify-center">
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MediaLightbox;
