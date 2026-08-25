import React, { useState, useEffect, useRef } from 'react';
import { Z_MODAL } from '../../constants/mobileTokens';
import { downloadChatMedia, useChatMediaBlobUrl } from '../../utils/chatMediaAuth';

const MediaMessage = ({ media, isOwn, onCancelUpload, onRetryUpload }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [showFullImage, setShowFullImage] = useState(false);
  const [isCancelled, setIsCancelled] = useState(false);
  const [isFailed, setIsFailed] = useState(false);
  const abortControllerRef = useRef(null);

  // Reset state when media changes
  useEffect(() => {
    setImageLoaded(false);
    setImageError(false);
  }, [media.id]);

  // Инициализируем AbortController для временных медиа
  useEffect(() => {
    if (media.is_processing && media.id?.toString().startsWith('temp_')) {
      abortControllerRef.current = new AbortController();
    }
    
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [media.id, media.is_processing]);

  // Проверяем статус failed из media
  useEffect(() => {
    if (media.is_failed) {
      setIsFailed(true);
    }
  }, [media.is_failed]);

  // Форматируем размер файла
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Отмена загрузки медиа
  const handleCancelUpload = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsCancelled(true);
    if (onCancelUpload && media.id) {
      onCancelUpload(media.id);
    }
  };

  // Повторная отправка медиа
  const handleRetryUpload = () => {
    setIsCancelled(false);
    setIsFailed(false);
    if (onRetryUpload && media) {
      onRetryUpload(media);
    }
  };

  // Получаем URL для медиа через Authorization header (без token в query)
  const isTemp = media.id?.toString().startsWith('temp_');
  const { url: mediaUrl, error: mediaUrlError, loading: mediaUrlLoading } = useChatMediaBlobUrl(
    media.id,
    { thumbnail: false, enabled: !isTemp },
  );
  const { url: thumbUrl } = useChatMediaBlobUrl(
    media.id,
    { thumbnail: Boolean(media.thumbnail_path), enabled: !isTemp && Boolean(media.thumbnail_path) },
  );
  const thumbnailUrl = thumbUrl || mediaUrl;
  const fullUrl = mediaUrl;
  const imageLoadFailed = imageError || mediaUrlError;

  const handleDocumentDownload = async (e) => {
    e.preventDefault();
    try {
      await downloadChatMedia(media.id, media.original_filename || 'document');
    } catch (err) {
      console.error('Document download failed', err);
    }
  };

  // Отображение изображения
  const renderImage = (mediaItem) => {
    return (
      <div className="relative">
        {thumbnailUrl ? (
        <img
          src={thumbnailUrl}
          alt={mediaItem.original_filename || 'Изображение'}
          className={`max-w-full rounded-lg cursor-pointer transition-opacity duration-300 ${
            imageLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          style={{ maxHeight: '340px', objectFit: 'contain' }}
          onClick={() => setShowFullImage(true)}
          onLoad={() => {
            setImageLoaded(true);
            setImageError(false);
          }}
          onError={() => {
            setImageError(true);
            setImageLoaded(false);
          }}
        />
        ) : null}
        {imageLoadFailed && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-200 rounded-lg p-4">
            <svg className="w-12 h-12 text-red-500 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <p className="text-sm text-gray-700 font-medium text-center">Ошибка загрузки изображения</p>
            <button
              onClick={() => {
                setImageError(false);
                setImageLoaded(false);
              }}
              className="mt-2 px-3 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
            >
              Попробовать снова
            </button>
          </div>
        )}
        {!imageLoaded && !imageLoadFailed && (mediaUrlLoading || !thumbnailUrl) && (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-200 rounded-lg">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
        )}
        
        {/* Overlay for processing state - shown on top of the image */}
        {mediaItem.is_processing && !imageError && (
          <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center">
            <div className="text-center p-4 relative">
              {/* Кружок загрузки с крестиком или retry */}
              <div className="relative inline-block">
                {isFailed ? (
                  // Значок retry
                  <button
                    onClick={handleRetryUpload}
                    className="mx-auto mb-2 bg-blue-500 hover:bg-blue-600 rounded-full p-3 shadow-lg transition-colors"
                    title="Повторить отправку"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                ) : (
                  <>
                    <svg className="animate-spin h-8 w-8 text-white mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {/* Крестик отмены внутри кружка */}
                    {!isCancelled && (
                      <button
                        onClick={handleCancelUpload}
                        className="absolute inset-0 flex items-center justify-center group"
                        title="Отменить загрузку"
                      >
                        <div className="bg-red-500 hover:bg-red-600 rounded-full p-0.5 transition-colors">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-white font-medium">
                {isFailed ? 'Ошибка отправки' : isCancelled ? 'Загрузка отменена' : 'Файл обрабатывается...'}
              </p>
              {!isCancelled && !isFailed && (
                <p className="text-xs text-white mt-1">Пожалуйста, подождите</p>
              )}
            </div>
          </div>
        )}
            
        {/* Lightbox для полного изображения */}
        {showFullImage && fullUrl && (
          <div
            className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-90 p-4"
            style={{ zIndex: Z_MODAL }}
            onClick={() => setShowFullImage(false)}
          >
            <div className="relative max-w-full max-h-full">
              <button
                className="absolute top-4 right-4 text-white hover:text-gray-300 z-10"
                onClick={(e) => {
                  e.stopPropagation();
                  setShowFullImage(false);
                }}
              >
                <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              <img
                src={fullUrl}
                alt={mediaItem.original_filename || 'Изображение'}
                className="max-w-full max-h-[90vh] object-contain"
                onClick={(e) => e.stopPropagation()}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  // Отображение видео
  const renderVideo = (mediaItem) => {
    const videoUrl = mediaUrl;
    return (
      <div className="relative">
        {videoUrl ? (
        <video
          controls
          poster={thumbnailUrl || undefined}
          className="max-w-full rounded-lg"
          style={{ maxHeight: '340px' }}
          preload="metadata"
        >
          <source src={videoUrl} type={mediaItem.mime_type} />
          Ваш браузер не поддерживает воспроизведение видео.
        </video>
        ) : mediaUrlLoading ? (
          <div className="flex h-40 items-center justify-center rounded-lg bg-gray-200">
            <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
            </svg>
          </div>
        ) : null}
        
        {/* Overlay for processing state - shown on top of the video */}
        {mediaItem.is_processing && (
          <div className="absolute inset-0 bg-black bg-opacity-40 rounded-lg flex items-center justify-center">
            <div className="text-center p-4 relative">
              {/* Кружок загрузки с крестиком или retry */}
              <div className="relative inline-block">
                {isFailed ? (
                  // Значок retry
                  <button
                    onClick={handleRetryUpload}
                    className="mx-auto mb-2 bg-blue-500 hover:bg-blue-600 rounded-full p-3 shadow-lg transition-colors"
                    title="Повторить отправку"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                ) : (
                  <>
                    <svg className="animate-spin h-8 w-8 text-white mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {/* Крестик отмены внутри кружка */}
                    {!isCancelled && (
                      <button
                        onClick={handleCancelUpload}
                        className="absolute inset-0 flex items-center justify-center group"
                        title="Отменить загрузку"
                      >
                        <div className="bg-red-500 hover:bg-red-600 rounded-full p-0.5 transition-colors">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-white font-medium">
                {isFailed ? 'Ошибка отправки' : isCancelled ? 'Загрузка отменена' : 'Файл обрабатывается...'}
              </p>
              {!isCancelled && !isFailed && (
                <p className="text-xs text-white mt-1">Пожалуйста, подождите</p>
              )}
            </div>
          </div>
        )}
        
        {/* Отображение длительности видео */}
        {mediaItem.duration && !mediaItem.is_processing && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-75 text-white text-xs px-2 py-1 rounded">
            {formatDuration(mediaItem.duration)}
          </div>
        )}
      </div>
    );
  };

  // Форматируем длительность
  const formatDuration = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Отображение документа
  const renderDocument = (mediaItem) => {
    // Определяем иконку по типу файла
    const getFileIcon = () => {
      const mimeType = mediaItem.mime_type;
      
      if (mimeType.includes('pdf')) {
        return (
          <svg className="w-10 h-10 text-red-500" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
        );
      } else if (mimeType.includes('word') || mimeType.includes('document')) {
        return (
          <svg className="w-10 h-10 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
        );
      } else if (mimeType.includes('excel') || mimeType.includes('sheet')) {
        return (
          <svg className="w-10 h-10 text-green-600" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
          </svg>
        );
      }
      return (
        <svg className="w-10 h-10 text-gray-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      );
    };

    // Если файл еще обрабатывается
    if (mediaItem.is_processing) {
      return (
        <div className="relative">
          <div className="flex items-center justify-center bg-gray-100 border-2 border-dashed border-gray-300 rounded-lg" style={{ minHeight: '85px' }}>
            <div className="text-center p-4 relative">
              {/* Кружок загрузки с крестиком или retry */}
              <div className="relative inline-block">
                {isFailed ? (
                  // Значок retry
                  <button
                    onClick={handleRetryUpload}
                    className="mx-auto mb-2 bg-blue-500 hover:bg-blue-600 rounded-full p-3 shadow-lg transition-colors"
                    title="Повторить отправку"
                  >
                    <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                  </button>
                ) : (
                  <>
                    <svg className="animate-spin h-8 w-8 text-blue-600 mx-auto mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {/* Крестик отмены внутри кружка */}
                    {!isCancelled && (
                      <button
                        onClick={handleCancelUpload}
                        className="absolute inset-0 flex items-center justify-center group"
                        title="Отменить загрузку"
                      >
                        <div className="bg-red-500 hover:bg-red-600 rounded-full p-0.5 transition-colors">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </button>
                    )}
                  </>
                )}
              </div>
              <p className="text-sm text-gray-700 font-medium">
                {isFailed ? 'Ошибка отправки' : isCancelled ? 'Загрузка отменена' : 'Файл обрабатывается...'}
              </p>
              {!isCancelled && !isFailed && (
                <p className="text-xs text-gray-500 mt-1">Пожалуйста, подождите</p>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="relative">
        <button
          type="button"
          onClick={handleDocumentDownload}
          className="flex w-full items-center gap-2.5 rounded-lg border border-gray-200 bg-white p-2.5 text-left transition-colors hover:bg-gray-50"
          title="Нажмите для скачивания"
        >
          {getFileIcon()}
          <div className="flex-1 min-w-0">
            <p className="text-[13px] font-medium text-gray-900 truncate">
              {mediaItem.original_filename || 'Документ'}
            </p>
            <p className="text-xs text-gray-500 mt-0.5">
              {formatFileSize(mediaItem.file_size)}
            </p>
          </div>
          <svg className="w-4 h-4 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </button>
      </div>
    );
  };

  // Рендерим в зависимости от типа медиа
  if (media.media_type === 'image') {
    return renderImage(media);
  } else if (media.media_type === 'video') {
    return renderVideo(media);
  } else if (media.media_type === 'voice') {
    return (
      <audio controls className="max-w-[260px]" preload="metadata" src={mediaUrl || undefined} />
    );
  } else if (media.media_type === 'document') {
    return renderDocument(media);
  }

  return null;
};

export default MediaMessage;
