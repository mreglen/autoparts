import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { normalizeImageUrl } from '../../utils/apiClient';

const ProductCard = ({ part, isTestOrganization = false, hideConditionAndQuantity = false, showAddToCart = false }) => {
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
    return false;
  };
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [hoverSide, setHoverSide] = useState(null); // 'left' or 'right'
  const navigate = useNavigate();
  
  // Combine photos and videos into a single media array
  const allMedia = React.useMemo(() => {
    const photos = (part.photos || []).map(photo => {
      const url = typeof photo === 'string' ? photo : (photo.full_url || photo.photo_url || photo.url || '');
      return {
        type: isVideo(photo) || isVideo(url) ? 'video' : 'photo',
        url: url,
        original: photo
      };
    });
    
    const videos = (part.videos || []).map(video => ({
      type: 'video',
      url: typeof video === 'string' ? video : (video.full_url || video.video_url || video.url || ''),
      original: video
    }));
    
    return [...photos, ...videos];
  }, [part.photos, part.videos]);
  
  // Update current image index when product media changes
  useEffect(() => {
    if (allMedia.length > 0 && currentImageIndex >= allMedia.length) {
      setCurrentImageIndex(Math.max(0, allMedia.length - 1));
    }
  }, [allMedia, currentImageIndex]);

  const product = part;

  const handleTitleClick = () => {
    const productId = product.id || 'unknown';
    const brand = encodeURIComponent(product.brand || 'unknown');
    const article = encodeURIComponent(product.article || 'unknown');
    navigate(`/part/${productId}-${brand}-${article}`);
  };

  return (
    <div className="w-full">
      <div 
        className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        {/* Product Image - Large placeholder area */}
        <div 
          className="bg-gray-50 aspect-[4/3] w-full flex items-center justify-center relative overflow-hidden"
          onClick={handleTitleClick}
          onMouseEnter={() => {
            // Reset to first image on mouse enter
            if (allMedia && allMedia.length > 0) {
              setCurrentImageIndex(0);
            }
          }}
        >
            {allMedia && allMedia.length > 0 ? (
            (() => {
              // Get current media item from allMedia array
              const currentIndex = Math.min(currentImageIndex, allMedia.length - 1);
              const currentMediaItem = allMedia[currentIndex];
              const currentMediaUrl = currentMediaItem ? currentMediaItem.url : '';
              const normalizedMediaUrl = normalizeImageUrl(currentMediaUrl);
              
              // Check if current media is video (use the type from allMedia)
              const currentMediaIsVideo = currentMediaItem && currentMediaItem.type === 'video';
              
              return (
                <div 
                  className="relative w-full h-full"
                  onMouseLeave={() => setHoverSide(null)}
                >
                  {/* Navigation arrows for multiple media */}
                  {allMedia && allMedia.length > 1 && (
                    <>
                      {/* Left arrow */}
                      <button
                        className={`absolute left-0 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-r-md transition-opacity duration-200 ${hoverSide === 'left' ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(prev => prev > 0 ? prev - 1 : allMedia.length - 1);
                        }}
                        onMouseEnter={() => setHoverSide('left')}
                      >
                        <svg className="w-6 h-6"fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>
                      {/* Right arrow */}
                      <button
                        className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-l-md transition-opacity duration-200 ${hoverSide === 'right' ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(prev => prev < allMedia.length - 1 ? prev + 1 : 0);
                        }}
                        onMouseEnter={() => setHoverSide('right')}
                      >
                        <svg className="w-6 h-6"fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </>
                  )}
    
                  
                  {currentMediaIsVideo ? (
                    <div className="w-full h-full flex items-center justify-center">
                      <video
                        key={`product-video-${currentImageIndex}`}
                        src={normalizedMediaUrl}
                        className="max-h-full max-w-full object-contain"
                        controls
                        muted
                        playsInline
                        preload="metadata"
                      />
                    </div>
                  ) : (
                    <img 
                      key={`product-media-${currentImageIndex}`}
                      src={normalizedMediaUrl}
                      alt={product.title} 
                      className="max-h-full max-w-full object-contain m-auto"
                      loading="lazy"
                    />
                  )}
                </div>
              );
            })()
          ) : (
            <div className="text-gray-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          {/* Simple dots indicator for multiple media */}
          {allMedia && allMedia.length > 1 && (
            <div className="absolute bottom-3 left-1/2 transform -translate-x-1/2 flex gap-2">
              {allMedia.map((media, index) => (
                <button
                  key={index}
                  className={`w-2 h-2 rounded-full transition-all ${
                    currentImageIndex === index ? 'bg-white w-4' : 'bg-white/50'
                  }`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCurrentImageIndex(index);
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1">
          {/* Product Info - Takes up available space */}
          <div className="p-2 space-y-0.5 flex-[2]">
            {/* Price */}
            <div className="flex items-center gap-1">
              <span className="text-[17px] font-bold text-gray-900">{product.price}</span>
            
              {product.originalPrice && (
                <span className="text-gray-400 line-through text-[16px]">{product.originalPrice}</span>
              )}
            </div>

            {/* Brand and Article */}
            <div className="flex flex-wrap gap-0.5 text-[14px] text-gray-700">
              <span className="font-medium truncate">{product.brand}</span>
              <span className="text-gray-400">•</span>
              <span className="truncate">{product.article}</span>
            </div>

            {/* Product Title - Clickable with hover effect */}
            <div className="space-y-0.5 flex-1">
              <p 
                className="text-[15px] text-gray-900 line-clamp-2 cursor-pointer hover:text-indigo-600 font-medium"
                onClick={handleTitleClick}
              >
                {product.title}
              </p>
            </div>

            {/* Stock/Warehouse Info */}
            <div className="flex items-center gap-0.5 text-[14px] text-gray-600">
              <span>{product.location || 'Скл'}</span>
              {product.stock && (
                <span className={`text-[14px] px-0.5 py-0.5 rounded-full ${
                  product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {product.stock > 0 ? `В н: ${product.stock}` : 'Нет'}
                </span>
              )}
            </div>

            {/* Condition Badge and Quantity - Hidden for used parts */}
            {!hideConditionAndQuantity && (
              <div className="flex gap-0.5 pt-0.5 flex-wrap">
                {product.isNew ? (
                  <span className="bg-green-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    Новое
                  </span>
                ) : (
                  <span className="bg-yellow-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    Б/у
                  </span>
                )}
                {product.quantity !== undefined && (
                  <span className="bg-blue-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    {product.quantity} шт.
                  </span>
                )}
                {product.isDiscount && (
                  <span className="bg-red-500 text-white px-1 py-0.5 rounded-full text-[14px] font-medium">
                    Скидка
                  </span>
                )}
              </div>
            )}

            {showAddToCart && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleTitleClick();
                  }}
                  className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg"
                >
                  В корзину
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;
