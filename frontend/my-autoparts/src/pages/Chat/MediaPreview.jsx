import React, { useState, useEffect } from 'react';

const MediaPreview = ({ files, onRemove, uploading }) => {
  const [uploadProgress, setUploadProgress] = useState({});

  // Имитация прогресса загрузки (можно заменить на реальный прогресс из XMLHttpRequest)
  useEffect(() => {
    if (uploading && files.length > 0) {
      const interval = setInterval(() => {
        setUploadProgress(prev => {
          const newProgress = { ...prev };
          files.forEach((file, index) => {
            if (!newProgress[index] || newProgress[index] < 90) {
              newProgress[index] = Math.min((newProgress[index] || 0) + 10, 90);
            }
          });
          return newProgress;
        });
      }, 300);

      return () => clearInterval(interval);
    }
  }, [uploading, files]);
  // Форматируем размер файла
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // Получаем превью для файла
  const getFilePreview = (file) => {
    if (file.type.startsWith('image/')) {
      return URL.createObjectURL(file);
    }
    // Для видео возвращаем null (будет показана иконка)
    return null;
  };

  // Получаем иконку для типа файла
  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) {
      return (
        <svg className="w-12 h-12 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      );
    } else if (file.type.startsWith('video/')) {
      return (
        <svg className="w-12 h-12 text-purple-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
        </svg>
      );
    } else if (file.type.includes('pdf')) {
      return (
        <svg className="w-12 h-12 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      );
    } else if (file.type.includes('word') || file.type.includes('document')) {
      return (
        <svg className="w-12 h-12 text-blue-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      );
    } else if (file.type.includes('excel') || file.type.includes('sheet')) {
      return (
        <svg className="w-12 h-12 text-green-600" fill="currentColor" viewBox="0 0 24 24">
          <path d="M14 2H6c-1.1 0-1.99.9-1.99 2L4 20c0 1.1.89 2 1.99 2H18c1.1 0 2-.9 2-2V8l-6-6zm2 16H8v-2h8v2zm0-4H8v-2h8v2zm-3-5V3.5L18.5 9H13z"/>
        </svg>
      );
    }
    return (
      <svg className="w-12 h-12 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
      </svg>
    );
  };

  if (!files || files.length === 0) {
    return null;
  }

  return (
    <div className="border-t border-gray-200 bg-gray-50 p-3">
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-sm font-medium text-gray-700">
          Прикрепленные файлы ({files.length})
        </h4>
        <span className="text-xs text-gray-500">
          {formatFileSize(files.reduce((total, file) => total + file.size, 0))} всего
        </span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {files.map((file, index) => {
          const preview = getFilePreview(file);
          const progress = uploadProgress[index] || 0;
          
          return (
            <div
              key={index}
              className="relative group bg-white rounded-lg border border-gray-200 overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            >
              {/* Превью файла */}
              <div className="aspect-square flex items-center justify-center bg-gray-100 relative">
                {preview ? (
                  <img
                    src={preview}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center p-4">
                    {getFileIcon(file)}
                    <p className="text-xs text-gray-500 mt-2 text-center truncate w-full">
                      {file.name}
                    </p>
                  </div>
                )}
                
                {/* Индикатор загрузки */}
                {uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="relative">
                      {/* Кружок загрузки */}
                      <svg className="animate-spin h-12 w-12 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      {/* Крестик отмены внутри кружка */}
                      <button
                        onClick={() => onRemove(index)}
                        className="absolute inset-0 flex items-center justify-center"
                        title="Отменить загрузку"
                      >
                        <div className="bg-red-500 hover:bg-red-600 rounded-full p-1 transition-colors">
                          <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </div>
                      </button>
                      {/* Прогресс */}
                      <div className="absolute -bottom-6 left-1/2 transform -translate-x-1/2 text-white text-xs font-medium">
                        {progress}%
                      </div>
                    </div>
                  </div>
                )}
              </div>
              
              {/* Информация о файле */}
              <div className="p-2 border-t border-gray-100">
                <p className="text-xs text-gray-700 truncate" title={file.name}>
                  {file.name}
                </p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {formatFileSize(file.size)}
                </p>
              </div>
              
              {/* Кнопка удаления */}
              <button
                onClick={() => onRemove(index)}
                className="absolute top-1 right-1 bg-red-500 hover:bg-red-600 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity shadow-md"
                title="Удалить файл"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
              
              {/* Индикатор типа */}
              <div className="absolute top-1 left-1">
                {file.type.startsWith('image/') && (
                  <span className="bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded">
                    IMG
                  </span>
                )}
                {file.type.startsWith('video/') && (
                  <span className="bg-purple-500 text-white text-xs px-1.5 py-0.5 rounded">
                    VID
                  </span>
                )}
                {file.type.includes('pdf') && (
                  <span className="bg-red-500 text-white text-xs px-1.5 py-0.5 rounded">
                    PDF
                  </span>
                )}
                {(file.type.includes('word') || file.type.includes('document')) && (
                  <span className="bg-blue-600 text-white text-xs px-1.5 py-0.5 rounded">
                    DOC
                  </span>
                )}
                {(file.type.includes('excel') || file.type.includes('sheet')) && (
                  <span className="bg-green-600 text-white text-xs px-1.5 py-0.5 rounded">
                    XLS
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default MediaPreview;
