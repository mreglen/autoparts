import React, { useState, useEffect } from 'react';

const ImageModal = ({ isOpen, onClose, imageUrl, alt = 'Изображение' }) => {
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  // Сброс состояния при закрытии
  useEffect(() => {
    if (!isOpen) {
      setZoom(1);
      setPosition({ x: 0, y: 0 });
      setIsDragging(false);
    }
  }, [isOpen]);

  // Обработчик клавиатуры для закрытия
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
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
  }, [isOpen, onClose]);

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

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90"
      onClick={onClose}
    >
      {/* Кнопка закрытия */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 z-60 text-white text-4xl hover:text-gray-300 transition-colors"
      >
        ×
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

      {/* Изображение */}
      <div
        className="relative max-w-full max-h-full overflow-hidden cursor-move"
        onClick={(e) => e.stopPropagation()}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <img
          src={imageUrl}
          alt={alt}
          className={`max-w-none transition-transform duration-200 ${
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

      {/* Инструкции */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-sm opacity-70">
        Кликните на изображение для зума • Используйте кнопки + и − • Escape для выхода
      </div>
    </div>
  );
};

export default ImageModal;
