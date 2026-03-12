import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { fetchProduct, searchAllProducts } from '../../redux/slices/ProductSlice';
import { addUsedPartsToCart, removeUsedFromCart, updateUsedCartItemQuantity, selectCart } from '../../redux/slices/CartSlice';
import { normalizeImageUrl } from '../../utils/apiClient';
import MediaModal from '../../components/MediaModal/MediaModal';

const PartDetail = () => {
  const { id, brand, article } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { currentProduct, loading, error } = useSelector((state) => state.products);
  const user = useSelector((state) => state.auth.user);
  const { organization } = useSelector((state) => state.organization);
  const cart = useSelector(selectCart);

  const [addingToCartId, setAddingToCartId] = useState(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [initialMediaIndex, setInitialMediaIndex] = useState(0);

  useEffect(() => {
    if (id) {
      dispatch(fetchProduct(id));
    } else if (brand && article) {
      const fetchByBrandAndArticle = async () => {
        try {
          const searchResponse = await dispatch(searchAllProducts(article));
          const data = searchResponse.payload || [];
          
          const matchedProduct = data.find(p => 
            p.brand?.toLowerCase() === brand.toLowerCase() && 
            p.article?.toLowerCase() === article.toLowerCase()
          );
          
          if (matchedProduct) {
            dispatch(fetchProduct(matchedProduct.id));
          } else {
            const articleMatch = data.find(p => 
              p.article?.toLowerCase() === article.toLowerCase()
            );
            if (articleMatch) {
              dispatch(fetchProduct(articleMatch.id));
            }
          }
        } catch (err) {
          console.error('Error searching for product by brand and article:', err);
        }
      };
      
      fetchByBrandAndArticle();
    }
  }, [dispatch, id, brand, article]);

  const getCartQuantity = (partId) => {
    if (!cart?.used_parts_items) return 0;
    const cartItem = cart.used_parts_items.find(item => item.product_id === partId);
    return cartItem ? cartItem.quantity : 0;
  };

  const getStockAvailability = (part) => {
    const availableOnCurrent = part.quantity || 0;
    const currentCartQuantity = getCartQuantity(part.id);

    return {
      availableOnCurrent,
      currentCartQuantity,
      isLimited: currentCartQuantity >= availableOnCurrent,
      noStock: availableOnCurrent <= currentCartQuantity
    };
  };

  const handleAddToCart = async (part) => {
    if (!user) {
      return;
    }
    setAddingToCartId(part.id);
    try {
      const currentCartQuantity = getCartQuantity(part.id);
      const availableStock = part.quantity || 0;

      if (availableStock <= currentCartQuantity) {
        setAddingToCartId(null);
        return;
      }

      await dispatch(addUsedPartsToCart({ product_id: part.id, quantity: 1 })).unwrap();
    } catch (error) {
      console.error('Ошибка добавления в корзину:', error);
    } finally {
      setAddingToCartId(null);
    }
  };

  const handleRemoveFromCart = async (part) => {
    setAddingToCartId(part.id);
    try {
      const cartItem = cart?.used_parts_items?.find(item => item.product_id === part.id);

      if (cartItem) {
        if (cartItem.quantity > 1) {
          await dispatch(updateUsedCartItemQuantity({ itemId: cartItem.id, quantity: cartItem.quantity - 1 })).unwrap();
        } else {
          await dispatch(removeUsedFromCart(cartItem.id)).unwrap();
        }
      }
    } catch (error) {
      console.error('Ошибка изменения количества в корзине:', error);
    } finally {
      setAddingToCartId(null);
    }
  };

  const formatPhoneNumber = (phone) => {
    if (!phone) return '';
    let digits = phone.replace(/\D/g, '');
    if (digits.startsWith('7') || digits.startsWith('8')) {
      digits = '7' + digits.slice(1);
    }
    let formatted = '+7 ';
    if (digits.length > 1) {
      formatted += '(' + digits.slice(1, 4);
    }
    if (digits.length > 4) {
      formatted += ') ' + digits.slice(4, 7);
    }
    if (digits.length > 7) {
      formatted += '-' + digits.slice(7, 9);
    }
    if (digits.length > 9) {
      formatted += '-' + digits.slice(9, 11);
    }
    return formatted;
  };

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
             item.photo_url.includes('/uploads/videos/') ||
             item.photo_url.includes('video/');
    }
    if (item?.full_url) {
      return item.full_url.toLowerCase().endsWith('.mp4') ||
             item.full_url.toLowerCase().endsWith('.avi') ||
             item.full_url.toLowerCase().endsWith('.mov') ||
             item.full_url.toLowerCase().endsWith('.wmv') ||
             item.full_url.toLowerCase().endsWith('.flv') ||
             item.full_url.toLowerCase().endsWith('.mkv') ||
             item.full_url.toLowerCase().endsWith('.webm') ||
             item.full_url.toLowerCase().endsWith('.m4v') ||
             item.full_url.toLowerCase().endsWith('.3gp') ||
             item.full_url.toLowerCase().endsWith('.mpeg') ||
             item.full_url.toLowerCase().endsWith('.mpg') ||
             item.full_url.includes('/uploads/videos/') ||
             item.full_url.includes('video/');
    }
    return false;
  };

  const getMediaUrl = (item) => {
    if (typeof item === 'string') {
      return item;
    } else if (item?.full_url) {
      return item.full_url;
    } else if (item?.photo_url) {
      return item.photo_url;
    }
    return '';
  };

  const handleOpenMediaModal = (startIndex = 0) => {
    const allMedia = (currentProduct.photos || []).map((photo) => ({
      type: isVideo(photo) ? 'video' : 'image',
      src: normalizeImageUrl(getMediaUrl(photo))
    }));
    
    setMediaItems(allMedia);
    setInitialMediaIndex(startIndex);
    setIsMediaModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Загрузка информации о запчасти...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-red-600">Ошибка загрузки информации о запчасти</p>
          <p className="text-sm text-gray-500 mt-2">{error}</p>
          <button 
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (!currentProduct) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-lg text-gray-600">Запчасть не найдена</p>
          <button 
            onClick={() => navigate(-1)}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  const sellerOrg = currentProduct.organization || organization;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50">
      {/* Back Button */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-blue-600 transition-colors font-medium"
        >
          <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          Назад к списку
        </button>
      </div>

      {/* Main Product Card */}
      <div className="max-w-7xl mx-auto px-4 pb-8">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          {/* Header with Product Info */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white p-6">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-3xl font-bold mb-3">{currentProduct.name || '—'}</h1>
                <div className="flex flex-wrap gap-3">
                  <div className="flex items-center bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <svg className="w-5 h-5 mr-2 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    <span className="font-semibold">{currentProduct.brand || '—'}</span>
                  </div>
                  <div className="flex items-center bg-white/20 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <svg className="w-5 h-5 mr-2 text-blue-200" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    <span className="font-semibold">Арт. {currentProduct.article || '—'}</span>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-4xl font-bold text-white">
                  {currentProduct.price ? `${currentProduct.price.toLocaleString()} ₽` : '—'}
                </div>
                {currentProduct.is_new ? (
                  <div className="inline-flex items-center mt-2 px-4 py-2 bg-green-500/20 backdrop-blur-sm rounded-lg text-sm font-medium text-green-100 border border-green-400/30">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    Новая
                  </div>
                ) : (
                  <div className="inline-flex items-center mt-2 px-4 py-2 bg-yellow-500/20 backdrop-blur-sm rounded-lg text-sm font-medium text-yellow-100 border border-yellow-400/30">
                    <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                    Б/у
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-0">
            {/* Left - Media Gallery */}
            <div className="p-6 border-r border-gray-100">
              {currentProduct.photos && currentProduct.photos.length > 0 ? (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-bold text-gray-900 flex items-center">
                      <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      Фото и видео
                    </h3>
                    {currentProduct.photos.length > 1 && (
                      <span className="text-sm bg-blue-50 text-blue-700 px-3 py-1 rounded-full font-medium border border-blue-100">
                        {currentProduct.photos.length} шт.
                      </span>
                    )}
                  </div>
                
                {/* Main Media */}
                <div 
                  className="relative aspect-square bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden cursor-pointer group mb-4 border-2 border-gray-200 hover:border-blue-400 transition-all duration-300"
                  onClick={() => handleOpenMediaModal(0)}
                >
                  {(() => {
                    const firstPhoto = currentProduct.photos[0];
                    const mediaUrl = normalizeImageUrl(getMediaUrl(firstPhoto));
                    const isVideoItem = isVideo(firstPhoto);
                    
                    return (
                      <>
                        {isVideoItem ? (
                          <div className="relative w-full h-full">
                            <video
                              src={mediaUrl}
                              className="w-full h-full object-contain"
                              muted
                              playsInline
                              controls
                            />
                          </div>
                        ) : (
                          <img
                            src={mediaUrl}
                            alt="Основное фото"
                            className="w-full h-full object-contain"
                            loading="eager"
                          />
                        )}
                        {/* Overlay - Only show for images, not videos */}
                        {!isVideoItem && (
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
                            <div className="bg-white/90 backdrop-blur-sm rounded-full p-4 transform scale-90 group-hover:scale-110 transition-transform duration-300 shadow-xl">
                              <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                              </svg>
                            </div>
                          </div>
                        )}
                      </>
                    );
                  })()}
                </div>

                {/* Thumbnails */}
                {currentProduct.photos.length > 1 && (
                  <div className="grid grid-cols-4 gap-2">
                    {currentProduct.photos.slice(1).map((item, index) => {
                      const mediaUrl = normalizeImageUrl(getMediaUrl(item));
                      const isVideoItem = isVideo(item);
                      
                      return (
                        <div 
                          key={index}
                          className="relative aspect-square bg-gray-50 rounded-lg overflow-hidden cursor-pointer hover:border-2 hover:border-blue-400 transition-all duration-200 group"
                          onClick={() => handleOpenMediaModal(index + 1)}
                        >
                          {isVideoItem ? (
                            <>
                              <video
                                src={mediaUrl}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                controls={false}
                              />
                              <div className="absolute inset-0 bg-black/30 flex items-center justify-center pointer-events-none">
                                <svg className="w-8 h-8 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                              </div>
                            </>
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={`Фото ${index + 2}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-center h-96 bg-gray-50 rounded-xl">
                <div className="text-center text-gray-400">
                  <svg className="w-20 h-20 mx-auto mb-4 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p>Нет фотографий</p>
                </div>
              </div>
            )}
          </div>

          {/* Right - Info & Actions */}
          <div className="p-6 space-y-6">
            {/* Stock & Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 mr-2 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600">В наличии</span>
                </div>
                <div className="text-3xl font-bold text-emerald-700">{currentProduct.quantity || 0} шт.</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <div className="flex items-center mb-2">
                  <svg className="w-5 h-5 mr-2 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-sm font-medium text-gray-600">Склад</span>
                </div>
                <div className="text-sm font-semibold text-blue-900 line-clamp-2">
                  {currentProduct.storage_location?.address || 
                   currentProduct.storage_location?.name || 
                   '—'}
                </div>
              </div>
            </div>

            {/* Description */}
            {currentProduct.description && (
              <div className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Описание
                </h3>
                <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                  {currentProduct.description}
                </div>
              </div>
            )}

            {/* Add to Cart */}
            <div className="bg-gradient-to-br from-slate-50 to-gray-50 rounded-xl p-5 border border-gray-200">
              <h3 className="text-sm font-bold text-gray-900 mb-4">Добавить в корзину</h3>
              {(() => {
                const cartQuantity = getCartQuantity(currentProduct.id);
                const stockInfo = getStockAvailability(currentProduct);
                const isAdding = addingToCartId === currentProduct.id;

                return (
                  <>
                    {cartQuantity > 0 ? (
                      <div className="flex items-center justify-between">
                        <div className="flex items-center space-x-3">
                          <button
                            onClick={() => handleRemoveFromCart(currentProduct)}
                            disabled={isAdding}
                            className="w-11 h-11 flex items-center justify-center text-2xl font-bold rounded-xl border-2 border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-sm"
                          >
                            −
                          </button>
                          <span className="text-2xl font-bold w-16 text-center text-indigo-900">
                            {cartQuantity}
                          </span>
                          <button
                            onClick={() => handleAddToCart(currentProduct)}
                            disabled={isAdding || stockInfo.noStock}
                            className="w-11 h-11 flex items-center justify-center text-2xl font-bold rounded-xl border-2 border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50 transition-all shadow-sm"
                          >
                            +
                          </button>
                        </div>
                        {stockInfo.noStock && (
                          <div className="text-xs text-orange-600 font-medium bg-orange-50 px-3 py-1 rounded-lg">
                            Нет в наличии
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(currentProduct)}
                        disabled={isAdding || stockInfo.noStock}
                        className="w-full py-4 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-size-200 bg-pos-0 hover:bg-pos-100 text-white text-lg font-bold rounded-xl transition-all duration-500 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl transform hover:-translate-y-0.5"
                      >
                        {isAdding ? (
                          <svg className="animate-spin h-6 w-6 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <span className="flex items-center justify-center">
                            <svg className="w-6 h-6 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 11-4 0 2 2 0 014 0z" />
                            </svg>
                            В корзину
                          </span>
                        )}
                      </button>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Seller */}
            {(sellerOrg?.phone || sellerOrg?.contact_person) && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-5 border border-amber-100">
                <h3 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Продавец
                </h3>
                
                {sellerOrg?.name && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Организация</div>
                    <div className="font-semibold text-gray-900">{sellerOrg.name}</div>
                  </div>
                )}
                
                {sellerOrg?.contact_person && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Контактное лицо</div>
                    <div className="font-semibold text-gray-900">{sellerOrg.contact_person}</div>
                  </div>
                )}
                
                {sellerOrg?.phone && (
                  <a
                    href={`tel:${sellerOrg.phone.replace(/\D/g, '')}`}
                    className="flex items-center justify-center w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold rounded-lg hover:from-amber-600 hover:to-orange-600 transition-all shadow-md"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {formatPhoneNumber(sellerOrg.phone)}
                  </a>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compatible Vehicles */}
      {currentProduct.compatible_vehicles && currentProduct.compatible_vehicles.length > 0 && (
        <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6 flex items-center">
            <svg className="w-6 h-6 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            Совместимые автомобили
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {currentProduct.compatible_vehicles.map((vehicle) => (
              <div key={vehicle.id} className="bg-gradient-to-br from-gray-50 to-slate-50 rounded-xl p-5 border border-gray-200 hover:border-indigo-300 hover:shadow-md transition-all">
                <div className="flex items-center mb-3 pb-3 border-b border-gray-200">
                  <svg className="w-5 h-5 mr-2 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-bold text-gray-900">{vehicle.brand} {vehicle.model}</span>
                </div>
                <div className="space-y-2 text-sm">
                  {vehicle.generation && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Поколение:</span>
                      <span className="font-semibold text-gray-900">{vehicle.generation}</span>
                    </div>
                  )}
                  {vehicle.engine && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Двигатель:</span>
                      <span className="font-semibold text-gray-900">{vehicle.engine}</span>
                    </div>
                  )}
                  {vehicle.transmission && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">КПП:</span>
                      <span className="font-semibold text-gray-900">{vehicle.transmission}</span>
                    </div>
                  )}
                  {vehicle.vin && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">VIN:</span>
                      <span className="font-semibold text-gray-900 truncate max-w-[200px]">{vehicle.vin}</span>
                    </div>
                  )}
                  {vehicle.mileage && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Пробег:</span>
                      <span className="font-semibold text-gray-900">{vehicle.mileage.toLocaleString()} км</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Media Modal */}
      <MediaModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        mediaItems={mediaItems}
        initialIndex={initialMediaIndex}
      />
    </div>
    </div>
  );
};

export default PartDetail;