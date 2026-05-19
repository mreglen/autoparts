import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

const MediaModal = ({ isOpen, onClose, mediaItems, initialIndex = 0 }) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [touchStart, setTouchStart] = useState(null);
  const [touchEnd, setTouchEnd] = useState(null);

  // Sync currentIndex when initialIndex changes while modal is open
  useEffect(() => {
    setCurrentIndex(initialIndex);
  }, [initialIndex]);

  // Touch/swipe handlers
  const minSwipeDistance = 50;

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
    
    if (isLeftSwipe && mediaItems.length > 1) {
      handleNext();
    }
    
    if (isRightSwipe && mediaItems.length > 1) {
      handlePrevious();
    }
  };

  if (!isOpen) return null;

  const currentMedia = mediaItems[currentIndex];

  const handlePrevious = () => {
    setCurrentIndex((prev) => (prev === 0 ? mediaItems.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex((prev) => (prev === mediaItems.length - 1 ? 0 : prev + 1));
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 bg-black bg-opacity-90 z-[150] flex items-center justify-center"
      onClick={handleBackdropClick}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Close button */}
      <button
        onClick={onClose}
        className="absolute top-4 right-4 text-white text-4xl hover:text-gray-300 z-10"
      >
        ×
      </button>

      {/* Navigation buttons */}
      {mediaItems.length > 1 && (
        <>
          <button
            onClick={handlePrevious}
            className="absolute left-4 text-white text-4xl hover:text-gray-300 z-10"
          >
            ‹
          </button>
          <button
            onClick={handleNext}
            className="absolute right-4 text-white text-4xl hover:text-gray-300 z-10"
          >
            ›
          </button>
        </>
      )}

      {/* Media content */}
      <div 
        className="max-w-full max-h-full p-4"
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        {currentMedia?.type === 'image' ? (
          <img
            src={currentMedia.src}
            alt={`Media ${currentIndex + 1}`}
            className="max-w-full max-h-[85vh] object-contain"
            onError={(e) => {
              console.error('Failed to load image:', currentMedia.src);
              e.target.style.display = 'none';
            }}
            onLoad={() => console.log('Image loaded successfully:', currentMedia.src)}
          />
        ) : currentMedia?.type === 'video' ? (
          <video
            src={currentMedia.src}
            controls
            autoPlay
            className="max-w-full max-h-[85vh] object-contain"
            onError={(e) => {
              console.error('Failed to load video:', currentMedia.src);
            }}
            onLoadedData={() => console.log('Video loaded successfully:', currentMedia.src)}
          />
        ) : null}
        {!currentMedia && (
          <div className="text-white text-xl">No media to display</div>
        )}
      </div>

      {/* Counter */}
      {mediaItems.length > 1 && (
        <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white text-lg">
          {currentIndex + 1} / {mediaItems.length}
        </div>
      )}
    </div>,
    document.body
  );
};

export default MediaModal;
