import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addUsedPartsToCart, removeUsedFromCart, updateUsedCartItemQuantity, selectCart } from '../../redux/slices/CartSlice';
import { normalizeImageUrl } from '../../utils/apiClient';

const ProductCard = ({ part, isTestOrganization = false, hideConditionAndQuantity = false }) => {
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
  const [isAdding, setIsAdding] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [touchStartX, setTouchStartX] = useState(0);
  const [touchEndX, setTouchEndX] = useState(0);
  const [showCallModal, setShowCallModal] = useState(false);
  const [hoverSide, setHoverSide] = useState(null); // 'left' or 'right'
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  
  // Combine photos and videos into a single media array
  const allMedia = React.useMemo(() => {
    const photos = (part.photos || []).map(photo => ({
      type: 'photo',
      url: typeof photo === 'string' ? photo : (photo.full_url || photo.photo_url || photo.url || ''),
      original: photo
    }));
    
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

  // Get current cart quantity for this product
  const cartItem = cart?.used_parts_items?.find(item => item.product_id === product.id);
  const currentQuantity = cartItem ? cartItem.quantity : 0;
  
  // Check if adding to cart would exceed available stock
  const availableStock = product.quantity || product.available_count || 0;
  const isStockLimited = currentQuantity >= availableStock && availableStock > 0;

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (isAdding || isStockLimited) return;
    
    const availableStock = product.quantity || product.available_count || 0;
    if (availableStock > 0 && currentQuantity >= availableStock) {
      return; // Already at stock limit
    }
    
    setIsAdding(true);
    try {
      await dispatch(addUsedPartsToCart({ 
        product_id: product.id, 
        quantity: 1 
      })).unwrap();
    } catch (error) {
      console.error('Error adding to cart:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleRemoveFromCart = async (e) => {
    e.stopPropagation();
    setIsAdding(true);
    try {
      if (cartItem) {
        if (cartItem.quantity > 1) {
          await dispatch(updateUsedCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })).unwrap();
        } else {
          await dispatch(removeUsedFromCart(cartItem.id)).unwrap();
        }
      }
    } catch (error) {
      console.error('Error changing quantity in cart:', error);
    } finally {
      setIsAdding(false);
    }
  };

  const handleTitleClick = () => {
    const brand = encodeURIComponent(product.brand || 'unknown');
    const article = encodeURIComponent(product.article || 'unknown');
    navigate(`/part/${brand}/${article}`);
  };

  return (
    <div className="w-full">
      <div 
        className="h-full flex flex-col bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden"
      >
        {/* Product Image - Large placeholder area */}
        <div 
          className="bg-gray-200 aspect-[4/3] w-full flex items-center justify-center p-1 relative overflow-hidden cursor-pointer"
          onClick={handleTitleClick}
          onMouseEnter={() => {
            // Reset to first image on mouse enter
            if (product.photos && Array.isArray(product.photos) && product.photos.length > 0) {
              setCurrentImageIndex(0);
            }
          }}
        >
            {product.image || (allMedia && allMedia.length > 0) ? (
            (() => {
              // Determine the current media item to display
              const currentMedia = product.image || 
                (allMedia && allMedia.length > 0) ? 
                  (() => {
                    const currentIndex = Math.min(currentImageIndex, allMedia.length - 1);
                    const currentMediaItem = allMedia[currentIndex];
                    return currentMediaItem ? currentMediaItem.url : '';
                  })() : 
                product.image || 
                null;

              const normalizedMediaUrl = normalizeImageUrl(currentMedia);
              
              // Check if the current media is a video
              const currentMediaItem = allMedia && allMedia.length > 0 ? allMedia[Math.min(currentImageIndex, allMedia.length - 1)] : null;
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
                    <>
                      <video
                        src={normalizedMediaUrl}
                        className="max-h-full max-w-full object-contain"
                        controls={false}
                        muted
                        playsInline
                      />
                      <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30">
                        <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                        </svg>
                      </div>
                    </>
                  ) : (
                    <img 
                      key={`product-media-${currentImageIndex}`}
                      src={normalizedMediaUrl}
                      alt={product.title} 
                      className="max-h-full max-w-full object-contain transition-opacity duration-300"
                      onMouseMove={(e) => {
                        if (allMedia && allMedia.length > 1) {
                          const rect = e.currentTarget.getBoundingClientRect();
                          const x = e.clientX - rect.left;
                          const width = rect.width;
                          
                          // Calculate which index based on horizontal position
                          const percentage = x / width;
                          
                          // Adjust percentage to map to media indices properly
                          const calculatedIndex = Math.floor(percentage * allMedia.length);
                          
                          // Ensure index is within bounds
                          const newIndex = Math.max(0, Math.min(calculatedIndex, allMedia.length - 1));
                          
                          // Only update if the index has changed
                         if (newIndex !== currentImageIndex) {
                            setCurrentImageIndex(newIndex);
                          }
                          
                          // Set hover side based on mouse position
                         if (x < width * 0.3) {
                            setHoverSide('left');
                          } else if (x > width * 0.7) {
                            setHoverSide('right');
                          } else {
                            setHoverSide(null);
                          }
                        }
                      }}
                      onTouchStart={(e) => {
                        setTouchStartX(e.targetTouches[0].clientX);
                      }}
                      onTouchMove={(e) => {
                        setTouchEndX(e.targetTouches[0].clientX);
                      }}
                      onTouchEnd={() => {
                        if (allMedia && allMedia.length > 1) {
                          const swipeThreshold = 50; // Minimum distance to trigger swipe
                          const diffX = touchStartX - touchEndX;
                          
                          if (Math.abs(diffX) > swipeThreshold) {
                            if (diffX > 0) {
                              // Swipe left - go to next media
                              setCurrentImageIndex(prev => 
                                prev < allMedia.length - 1 ? prev + 1 : 0
                              );
                            } else {
                              // Swipe right - go to previous media
                              setCurrentImageIndex(prev => 
                                prev > 0 ? prev - 1 : allMedia.length - 1
                              );
                            }
                          }
                        }
                      }}
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
          
          {/* Thumbnail indicators for multiple media */}
          {allMedia && allMedia.length > 1 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1 bg-black bg-opacity-50 rounded-full p-1">
              {allMedia.map((media, index) => (
                <div 
                  key={index}
                  className={`relative w-2 h-2 rounded-full ${currentImageIndex === index ? 'bg-white' : 'bg-gray-400'}`}
                >
                  {/* Video icon overlay for video thumbnails */}
                  {media.type === 'video' && currentImageIndex === index && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                        <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                      </svg>
                    </div>
                  )}
                </div>
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
          </div>

          {/* Contact Buttons */}
          <div className="p-1.5 pt-0 flex space-x-1.5">
            <button 
              className="flex-1 py-3 px-1.5 rounded-xl bg-slate-500 text-white font-medium transition-all duration-200 hover:bg-slate-600"
              onClick={(e) => {
                e.stopPropagation();
                // Open modal with seller phone and organization
                setShowCallModal(true);
              }}
            >
              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </button>
            <button 
              className="flex-1 py-3 px-1.5 rounded-xl bg-blue-500 text-white font-medium transition-all duration-200 hover:bg-blue-600"
              onClick={(e) => {
                e.stopPropagation();
                // Placeholder for message functionality
                alert('Написать functionality coming soon');
              }}
            >
              <svg className="w-5 h-5 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </button>
          </div>
                  
          {/* Call Modal */}
          {showCallModal && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
              <div className="bg-white rounded-xl p-6 w-full max-w-md">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-bold text-gray-900">Контакты продавца</h3>
                  <button 
                    onClick={() => setShowCallModal(false)}
                    className="text-gray-500 hover:text-gray-700"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
                        
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-gray-600">Организация:</p>
                    <p className="text-[14px] font-medium text-gray-900">{product.sellerName || 'Не указана'}</p>
                  </div>
                          
                  <div>
                    <p className="text-sm text-gray-600">Телефон:</p>
                    <p className="text-[14px] font-medium text-gray-900">{(product.phone && !product.phone.startsWith('+')) ? '+' + product.phone : product.phone || 'Не указан'}</p>
                  </div>
                          
                  {product.phone && (
                    <div className="pt-4">
                      <a 
                        href={`tel:${product.phone.startsWith('+') ? product.phone : '+' + product.phone}`}
                        className="w-full py-3 px-4 bg-green-500 text-white font-medium rounded-lg text-center block transition-colors hover:bg-green-600"
                      >
                        Позвонить
                      </a>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
                  
          {/* Add to Cart Button - Stays at bottom */}
          <div className="p-1.5 pt-0">
            {currentQuantity > 0 ? (
              <div className="flex items-center justify-center space-x-1">
                <button
                  onClick={handleRemoveFromCart}
                  disabled={isAdding}
                  className="w-6 h-8 flex items-center justify-center text-base font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  −
                </button>
                <span className="text-[14px] font-semibold w-5 text-center">
                  {currentQuantity}
                </span>
                <button
                  onClick={handleAddToCart}
                  disabled={isAdding || isStockLimited}
                  className="w-6 h-8 flex items-center justify-center text-base font-medium rounded border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                >
                  +
                </button>
                {isStockLimited && (
                  <div className="text-[14px] text-orange-600 ml-1">Нет в наличии</div>
                )}
              </div>
            ) : (
              <button 
                className={`w-full py-3 px-1.5 rounded-xl text-[14px] font-medium text-white transition-all duration-200 flex items-center justify-center ${
                  isAdding 
                    ? 'bg-green-600 hover:bg-green-700' 
                    : 'bg-indigo-600 hover:bg-indigo-700'
                }`}
                onClick={handleAddToCart}
                disabled={isAdding || isStockLimited}
              >
                {isAdding ? (
                  <>
                    <svg className="animate-spin h-3 w-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span>...</span>
                  </>
                ) : (
                  'В корзину'
                )}
                {isStockLimited && !isAdding && currentQuantity === 0 && (
                  <div className="ml-0.5 text-[14px] text-orange-600">Нет в н</div>
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;