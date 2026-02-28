import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { addUsedPartsToCart, selectCart } from '../../redux/slices/CartSlice';
import { normalizeImageUrl } from '../../utils/apiClient';

const ProductCard = ({ part, isTestOrganization = false }) => {
  const [isAdding, setIsAdding] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const cart = useSelector(selectCart);
  
  // Update current image index when product photos change
  useEffect(() => {
    if (part.photos && Array.isArray(part.photos) && currentImageIndex >= part.photos.length) {
      setCurrentImageIndex(Math.max(0, part.photos.length - 1));
    }
  }, [part.photos, currentImageIndex]);

  const product = part;

  // Get current cart quantity for this product
  const cartItem = cart?.used_parts_items?.find(item => item.product_id === product.id);
  const currentQuantity = cartItem ? cartItem.quantity : 0;

  const handleAddToCart = async (e) => {
    e.stopPropagation();
    if (isAdding) return;
    
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

  const handleTitleClick = () => {
    const brand = encodeURIComponent(product.brand || 'unknown');
    const article = encodeURIComponent(product.article || 'unknown');
    navigate(`/part/${brand}/${article}`);
  };

  return (
    <div className="w-full md:w-auto">
      <div 
        className="h-full flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden"
      >
        {/* Product Image - Large placeholder area */}
        <div 
          className="bg-gray-200 aspect-[4/3] w-full flex items-center justify-center p-6 relative overflow-hidden"
          onMouseEnter={() => {
            // Reset to first image on mouse enter
            if (product.photos && Array.isArray(product.photos) && product.photos.length > 0) {
              setCurrentImageIndex(0);
            }
          }}
        >
          {product.image || (product.photos && Array.isArray(product.photos) && product.photos.length > 0) ? (
            <img 
              key={`product-image-${currentImageIndex}`}
              src={normalizeImageUrl(
                // If product.image is defined and is a string, use it
                (product.image && typeof product.image === 'string') ? product.image :
                // If product.image is an object, extract the URL
                (product.image && typeof product.image === 'object') ? 
                  (product.image.full_url || product.image.photo_url || product.image.url || String(product.image)) :
                // If there are photos, use the current photo based on index
                (product.photos && Array.isArray(product.photos) && product.photos.length > 0) ? 
                  (() => {
                    const currentPhotoIndex = Math.min(currentImageIndex, product.photos.length - 1);
                    const currentPhoto = product.photos[currentPhotoIndex];
                    
                    if (typeof currentPhoto === 'string') {
                      return currentPhoto;
                    } else if (typeof currentPhoto === 'object' && currentPhoto !== null) {
                      return currentPhoto.full_url || currentPhoto.photo_url || currentPhoto.url || String(currentPhoto);
                    }
                    return '';
                  })() : 
                // Fallback to product.image if exists
                product.image || 
                // Final fallback
                null
              )}
              alt={product.title} 
              className="max-h-full max-w-full object-contain transition-opacity duration-300"
              onMouseMove={(e) => {
                if (product.photos && Array.isArray(product.photos) && product.photos.length > 1) {
                  const rect = e.currentTarget.getBoundingClientRect();
                  const x = e.clientX - rect.left;
                  const width = rect.width;
                  
                  // Calculate which image index based on horizontal position
                  const percentage = x / width;
                  
                  // Adjust percentage to map to image indices properly
                  // Adding a small buffer to prevent rapid switching at boundaries
                  const calculatedIndex = Math.floor(percentage * product.photos.length);
                  
                  // Ensure index is within bounds
                  const newIndex = Math.max(0, Math.min(calculatedIndex, product.photos.length - 1));
                  
                  // Only update if the index has changed
                  if (newIndex !== currentImageIndex) {
                    setCurrentImageIndex(newIndex);
                  }
                }
              }}
            />
          ) : (
            <div className="text-gray-400">
              <svg className="w-20 h-20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
          
          {/* Thumbnail indicators for multiple photos */}
          {product.photos && Array.isArray(product.photos) && product.photos.length > 1 && (
            <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex space-x-1 bg-black bg-opacity-50 rounded-full p-1">
              {product.photos.map((_, index) => (
                <div 
                  key={index}
                  className={`w-2 h-2 rounded-full ${currentImageIndex === index ? 'bg-white' : 'bg-gray-400'}`}
                />
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col flex-1">
          {/* Product Info - Takes up available space */}
          <div className="p-4 space-y-2 flex-1">
            {/* Price */}
            <div className="flex items-center gap-2">
              <span className="text-xl font-bold text-gray-900">{product.price}</span>
            
              {product.originalPrice && (
                <span className="text-gray-400 line-through text-sm">{product.originalPrice}</span>
              )}
            </div>

            {/* Brand and Article */}
            <div className="flex flex-wrap gap-2 text-sm text-gray-700">
              <span className="font-medium">{product.brand}</span>
              <span className="text-gray-400">•</span>
              <span>{product.article}</span>
            </div>

            {/* Product Title - Clickable with hover effect */}
            <div className="space-y-1 flex-1">
              <p 
                className="text-sm text-gray-900 line-clamp-3 cursor-pointer hover:text-indigo-600 font-medium"
                onClick={handleTitleClick}
              >
                {product.title}
              </p>
            </div>

            {/* Stock/Warehouse Info */}
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <span>{product.location || 'Склад'}</span>
              {product.stock && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${
                  product.stock > 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                }`}>
                  {product.stock > 0 ? `В наличии: ${product.stock}` : 'Нет в наличии'}
                </span>
              )}
            </div>

            {/* Condition Badge */}
            <div className="flex gap-2 pt-1">
              {product.isNew ? (
                <span className="bg-green-500 text-white px-2.5 py-1 rounded-full text-xs font-medium">
                  Новое
                </span>
              ) : (
                <span className="bg-yellow-500 text-white px-2.5 py-1 rounded-full text-xs font-medium">
                  Б/у
                </span>
              )}
              {product.isDiscount && (
                <span className="bg-red-500 text-white px-2.5 py-1 rounded-full text-xs font-medium">
                  Скидка
                </span>
              )}
            </div>
          </div>

          {/* Add to Cart Button - Stays at bottom */}
          <div className="p-4 pt-0">
            <button 
              className={`w-full py-3 px-4 rounded-xl font-medium text-white transition-all duration-200 flex items-center justify-center gap-2 ${
                isAdding || currentQuantity > 0
                  ? 'bg-green-600 hover:bg-green-700' 
                  : 'bg-indigo-600 hover:bg-indigo-700'
              }`}
              onClick={handleAddToCart}
              disabled={isAdding || currentQuantity > 0}
            >
              {isAdding ? (
                <>
                  <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <span>Добавление...</span>
                </>
              ) : currentQuantity > 0 ? (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  <span>В корзине</span>
                </>
              ) : (
                'В корзину'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProductCard;