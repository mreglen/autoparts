import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { fetchProduct, searchAllProducts } from '../../redux/slices/ProductSlice';
import { addUsedPartsToCart, removeUsedFromCart, updateUsedCartItemQuantity, selectCart } from '../../redux/slices/CartSlice';
import PhotoThumbnail from '../../components/PhotoGallery/PhotoThumbnail';
import ImageModal from '../../components/ImageModal/ImageModal';

const PartDetail = () => {
  const { id, brand, article } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { currentProduct, loading, error } = useSelector((state) => state.products);
  const user = useSelector((state) => state.auth.user);
  const { organization } = useSelector((state) => state.organization);
  const cart = useSelector(selectCart);

  const [imageModalOpen, setImageModalOpen] = useState(false);
  const [selectedImages, setSelectedImages] = useState({ photos: [], initialIndex: 0 });
  const [addingToCartId, setAddingToCartId] = useState(null);

  useEffect(() => {
    // If we have an ID, use it directly
    if (id) {
      dispatch(fetchProduct(id));
    } 
    // If we have brand and article, we need to search for the product
    else if (brand && article) {
      // We need to implement a search by brand and article
      // For now, we'll try to find the product by searching
      // We need to create a new action to search by brand and article
      // Since there's no direct API for this, we'll need to search and find the product
      const fetchByBrandAndArticle = async () => {
        try {
          // Using the existing search functionality to find the product
          // Dispatch an action to search for products
          const searchResponse = await dispatch(searchAllProducts(article));
          const data = searchResponse.payload || [];
          
          // Find the product that matches both brand and article
          const matchedProduct = data.find(p => 
            p.brand?.toLowerCase() === brand.toLowerCase() && 
            p.article?.toLowerCase() === article.toLowerCase()
          );
          
          if (matchedProduct) {
            dispatch(fetchProduct(matchedProduct.id));
          } else {
            // If not found by exact match, try to find by article only
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

  const handleImageClick = (photos, initialIndex) => {
    setSelectedImages({ photos, initialIndex });
    setImageModalOpen(true);
  };

  // Получаем количество товара в корзине
  const getCartQuantity = (partId) => {
    if (!cart?.used_parts_items) return 0;
    const cartItem = cart.used_parts_items.find(item => item.product_id === partId);
    return cartItem ? cartItem.quantity : 0;
  };

  // Получаем информацию о наличии товара
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

  // Функция добавления в корзину
  const handleAddToCart = async (part) => {
    if (!user) {
      // Можно добавить редирект на логин или уведомление
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

  // Функция уменьшения количества в корзине
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

  // Функция форматирования телефона
  const formatPhoneNumber = (phone) => {
    if (!phone) return '';

    // Удаляем все нецифровые символы
    let digits = phone.replace(/\D/g, '');

    // Если начинается с 7 или 8, заменяем на 7
    if (digits.startsWith('7') || digits.startsWith('8')) {
      digits = '7' + digits.slice(1);
    }

    // Форматируем как +7 (XXX) XXX-XX-XX
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
    <div className="max-w-6xl mx-auto px-4 py-8">
      {currentProduct && (
        <Helmet>
          <title>{currentProduct.name ? `${currentProduct.name} - ${currentProduct.brand || ''} ${currentProduct.article || ''} | Автозапчасти` : 'Детали запчасти | Автозапчасти'}</title>
          <meta name="description" content={currentProduct.description ? `${currentProduct.description.substring(0, 160)}...` : `Информация о запчасти ${currentProduct.brand || ''} ${currentProduct.article || ''}. Условия покупки, цена, наличие.`} />
          <meta name="keywords" content={`${currentProduct.brand || ''}, ${currentProduct.article || ''}, ${currentProduct.name || ''}, автозапчасти, б/у запчасти, автомобиль`} />
          <meta property="og:title" content={currentProduct.name ? `${currentProduct.name} - ${currentProduct.brand || ''} ${currentProduct.article || ''}` : 'Детали запчасти'} />
          <meta property="og:description" content={currentProduct.description ? `${currentProduct.description.substring(0, 200)}...` : `Информация о запчасти ${currentProduct.brand || ''} ${currentProduct.article || ''}`} />
          <meta property="og:type" content="product" />
          <meta property="og:url" content={typeof window !== 'undefined' && window.location ? window.location.href : ''} />
          {currentProduct.photos && currentProduct.photos.length > 0 && (
            <meta property="og:image" content={typeof currentProduct.photos[0] === 'object' ? currentProduct.photos[0].photo_url : currentProduct.photos[0]} />
          )}
          <link rel="canonical" href={currentProduct ? `/part/${encodeURIComponent(currentProduct.brand || 'unknown')}/${encodeURIComponent(currentProduct.article || 'unknown')}` : (typeof window !== 'undefined' && window.location ? window.location.href : '')} />
        </Helmet>
      )}
      <button
        onClick={() => navigate(-1)}
        className="mb-6 flex items-center text-indigo-600 hover:text-indigo-800 font-medium"
      >
        <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
        </svg>
        Назад
      </button>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">{currentProduct.name || '—'}</h1>
          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
            <div><span className="font-medium">Бренд:</span> {currentProduct.brand || '—'}</div>
            <div><span className="font-medium">Артикул:</span> {currentProduct.article || '—'}</div>
            <div><span className="font-medium">Внутренний код:</span> {currentProduct.internal_code || '—'}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 p-6">
          {/* Left column - Photos and Seller Info */}
          <div className="space-y-6">
            {/* Photos */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Фото запчасти</h2>
              <PhotoThumbnail 
                photos={currentProduct.photos || []} 
                onImageClick={handleImageClick} 
              />
            </div>

            {/* Seller Info */}
            {(sellerOrg?.phone || sellerOrg?.contact_person) && (
              <div className="bg-indigo-50 p-4 rounded-lg border-l-4 border-indigo-500">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Информация о продавце</h3>
                
                {sellerOrg?.name && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Организация:</span>
                    <div className="font-medium">{sellerOrg.name}</div>
                  </div>
                )}
                
                {sellerOrg?.contact_person && (
                  <div className="mb-2">
                    <span className="text-sm text-gray-600">Контактное лицо:</span>
                    <div className="font-medium">{sellerOrg.contact_person}</div>
                  </div>
                )}
                
                {sellerOrg?.phone && (
                  <div className="flex items-center justify-between mt-3">
                    <div>
                      <span className="text-sm text-gray-600">Телефон:</span>
                      <div className="font-medium">{formatPhoneNumber(sellerOrg.phone)}</div>
                    </div>
                    <a
                      href={`tel:${sellerOrg.phone.replace(/\D/g, '')}`}
                      className="px-3 py-1 bg-indigo-600 text-white text-sm rounded hover:bg-indigo-700 transition-colors"
                    >
                      Позвонить
                    </a>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right column - Details */}
          <div className="space-y-6">
            {/* Status and Condition */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="text-sm text-gray-600">Состояние</span>
                <div className="mt-1">
                  {currentProduct.is_new ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                      Новая
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                      Б/у
                    </span>
                  )}
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="text-sm text-gray-600">Остаток</span>
                <div className="mt-1 font-medium">{currentProduct.quantity || 0} шт.</div>
              </div>
            </div>

            {/* Price */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <span className="text-sm text-gray-600">Цена</span>
              <div className="mt-1 text-2xl font-bold text-gray-900">
                {currentProduct.price ? `${currentProduct.price} ₽` : '—'}
              </div>
            </div>

            {/* Location */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <span className="text-sm text-gray-600">Склад</span>
              <div className="mt-1 font-medium">
                {currentProduct.storage_location?.address || 
                 currentProduct.storage_location?.name || 
                 '—'}
              </div>
            </div>

            {/* Description */}
            {currentProduct.description && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="text-sm text-gray-600">Описание</span>
                <div className="mt-2 text-gray-700 whitespace-pre-line">
                  {currentProduct.description}
                </div>
              </div>
            )}

            {/* Compatible Vehicles */}
            {currentProduct.compatible_vehicles && currentProduct.compatible_vehicles.length > 0 && (
              <div className="bg-gray-50 p-4 rounded-lg">
                <span className="text-sm text-gray-600">Совместимые автомобили</span>
                <div className="mt-3 space-y-3">
                  {currentProduct.compatible_vehicles.map((vehicle) => (
                    <div key={vehicle.id} className="border border-gray-200 rounded p-3">
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-gray-500">Марка:</span>
                          <div className="font-medium">{vehicle.brand}</div>
                        </div>
                        <div>
                          <span className="text-gray-500">Модель:</span>
                          <div className="font-medium">{vehicle.model}</div>
                        </div>
                        {vehicle.generation && (
                          <div>
                            <span className="text-gray-500">Поколение:</span>
                            <div className="font-medium">{vehicle.generation}</div>
                          </div>
                        )}
                        {vehicle.engine && (
                          <div>
                            <span className="text-gray-500">Двигатель:</span>
                            <div className="font-medium">{vehicle.engine}</div>
                          </div>
                        )}
                        {vehicle.transmission && (
                          <div>
                            <span className="text-gray-500">КПП:</span>
                            <div className="font-medium">{vehicle.transmission}</div>
                          </div>
                        )}
                        {vehicle.vin && (
                          <div>
                            <span className="text-gray-500">VIN:</span>
                            <div className="font-medium">{vehicle.vin}</div>
                          </div>
                        )}
                        {vehicle.mileage && (
                          <div>
                            <span className="text-gray-500">Пробег:</span>
                            <div className="font-medium">{vehicle.mileage.toLocaleString()} км</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add to Cart Section */}
            <div className="bg-gray-50 p-4 rounded-lg">
              <span className="text-sm text-gray-600">Добавить в корзину</span>
              <div className="mt-3 flex items-center space-x-3">
                {(() => {
                  const cartQuantity = getCartQuantity(currentProduct.id);
                  const stockInfo = getStockAvailability(currentProduct);
                  const isAdding = addingToCartId === currentProduct.id;

                  return cartQuantity > 0 ? (
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => handleRemoveFromCart(currentProduct)}
                        disabled={isAdding}
                        className="w-10 h-10 flex items-center justify-center text-xl font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        −
                      </button>
                      <span className="text-base font-semibold w-10 text-center">
                        {cartQuantity}
                      </span>
                      <button
                        onClick={() => handleAddToCart(currentProduct)}
                        disabled={isAdding || stockInfo.noStock}
                        className="w-10 h-10 flex items-center justify-center text-xl font-medium rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                      >
                        +
                      </button>
                      {stockInfo.noStock && (
                        <div className="text-xs text-orange-600">Нет в наличии</div>
                      )}
                    </div>
                  ) : (
                    <button
                      onClick={() => handleAddToCart(currentProduct)}
                      disabled={isAdding || stockInfo.noStock}
                      className="px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed min-w-[120px] flex items-center justify-center"
                    >
                      {isAdding ? (
                        <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      ) : 'В корзину'}
                    </button>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      </div>

      <ImageModal
        isOpen={imageModalOpen}
        onClose={() => setImageModalOpen(false)}
        photos={selectedImages.photos}
        initialIndex={selectedImages.initialIndex}
        alt="Фото товара"
      />
    </div>
  );
};

export default PartDetail;