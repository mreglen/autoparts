import React, { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { fetchPublicProduct, searchAllProducts } from '../../redux/slices/ProductSlice';
import { addUsedPartsToCart, removeUsedFromCart, updateUsedCartItemQuantity, selectCart } from '../../redux/slices/CartSlice';
import { createOrGetChat } from '../../redux/slices/ChatSlice';
import { normalizeImageUrl } from '../../utils/apiClient';
import { stripHtmlTags } from '../../utils/text';
import { buildPartDetailPath, parsePartDetailParam } from '../../utils/partRoutes';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';
import { buildPreliminaryPartTitle, buildPreliminaryPartDescription, buildProductSeo } from '../../utils/productSeo';
import { buildBreadcrumbJsonLd, buildBreadcrumbsForPath } from '../../utils/breadcrumbs';
import MediaModal from '../../components/MediaModal/MediaModal';

function PartProductSeoHelmet({ seo, structuredData, product }) {
  if (!seo) return null;
  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      <link rel="canonical" href={seo.canonicalUrl} />
      <meta property="og:type" content="product" />
      <meta property="og:site_name" content="Свой Гараж" />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={seo.canonicalUrl} />
      <meta property="og:locale" content="ru_RU" />
      {seo.imageUrl ? <meta property="og:image" content={seo.imageUrl} /> : null}
      {product?.price ? (
        <>
          <meta property="product:price:amount" content={String(product.price)} />
          <meta property="product:price:currency" content="RUB" />
        </>
      ) : null}
      {structuredData ? (
        <script type="application/ld+json">{JSON.stringify(structuredData)}</script>
      ) : null}
    </Helmet>
  );
}

const PartDetail = () => {
  const { productId: combinedParam } = useParams();
  const { productId: extractedProductId, brand: extractedBrand, article: extractedArticle } =
    parsePartDetailParam(combinedParam);
  
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  
  const { currentProduct, loading, error } = useSelector((state) => state.products);
  const { organization } = useSelector((state) => state.organization);
  const { user } = useSelector((state) => state.auth);
  const cart = useSelector(selectCart);
  const [addingToCartId, setAddingToCartId] = useState(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [initialMediaIndex, setInitialMediaIndex] = useState(0);
  const [currentMainMediaIndex, setCurrentMainMediaIndex] = useState(0);
  const [creatingChat, setCreatingChat] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);

  const preliminaryTitle = useMemo(
    () => buildPreliminaryPartTitle({ brand: extractedBrand, article: extractedArticle }),
    [extractedBrand, extractedArticle]
  );

  const preliminarySeo = useMemo(() => {
    if (!preliminaryTitle) return null;
    const description =
      buildPreliminaryPartDescription({
        brand: extractedBrand,
        article: extractedArticle,
        organization: organization?.address ? organization : null,
      }) ||
      'Автозапчасть на «Свой Гараж» — каталог, доставка по России.';
    return {
      title: preliminaryTitle,
      description,
      canonicalUrl: `https://svoygarage.ru${location.pathname}`,
      imageUrl: null,
    };
  }, [preliminaryTitle, extractedBrand, extractedArticle, organization, location.pathname]);

  useLayoutEffect(() => {
    if (preliminaryTitle && loading && !currentProduct) {
      document.title = preliminaryTitle;
    }
  }, [preliminaryTitle, loading, currentProduct]);

  useEffect(() => {
    if (extractedProductId) {
      // Use the extracted product ID to fetch directly
      dispatch(fetchPublicProduct(parseInt(extractedProductId, 10)));
    } else if (extractedBrand && extractedArticle) {
      const fetchByBrandAndArticle = async () => {
        try {
          // Decode brand and article in case they contain encoded characters
          const decodedBrand = decodeURIComponent(extractedBrand);
          const decodedArticle = decodeURIComponent(extractedArticle);
          
          const searchResponse = await dispatch(searchAllProducts(decodedArticle));
          const data = searchResponse.payload || [];
          
          const matchedProduct = data.find(p => 
            p.brand?.toLowerCase() === decodedBrand.toLowerCase() && 
            p.article?.toLowerCase() === decodedArticle.toLowerCase()
          );
          
          if (matchedProduct) {
            dispatch(fetchPublicProduct(matchedProduct.id));
          } else {
            const articleMatch = data.find(p => 
              p.article?.toLowerCase() === decodedArticle.toLowerCase()
            );
            if (articleMatch) {
              dispatch(fetchPublicProduct(articleMatch.id));
            }
          }
        } catch (err) {
          console.error('Error searching for product by brand and article:', err);
        }
      };
      
      fetchByBrandAndArticle();
    }
  }, [dispatch, extractedProductId, extractedBrand, extractedArticle]);

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
    if (digits.startsWith('8')) {
      digits = '7' + digits.slice(1);
    }
    if (digits.length === 11) {
      return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
    }
    return phone;
  };

  const handleWriteToSeller = async () => {
    if (!user) {
      // Если пользователь не авторизован, перенаправляем на страницу входа
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }

    // Проверяем, что пользователь не является продавцом этого товара
    if (currentProduct.organization && user.organization_id === currentProduct.organization.id) {
      alert('Вы не можете написать себе');
      return;
    }

    setCreatingChat(true);
    try {
      // Создаем или получаем существующий чат
      // seller_id определяется на backend автоматически по product_id
      const chatData = {
        buyer_id: user.id,
        seller_id: null, // Backend определит автоматически
        product_id: currentProduct.id
      };

      const result = await dispatch(createOrGetChat(chatData)).unwrap();
      
      // Переходим на страницу чата
      navigate(`/chats/${result.id}`);
    } catch (error) {
      console.error('Ошибка создания чата:', error);
      alert('Не удалось создать чат. Попробуйте позже.');
    } finally {
      setCreatingChat(false);
    }
  };

  const handleOpenPhoneModal = () => {
    setIsPhoneModalOpen(true);
  };

  const handleClosePhoneModal = () => {
    setIsPhoneModalOpen(false);
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
    // Combine both photos and videos into one array
    const allMedia = [
      ...(currentProduct.photos || []).map(photo => ({
        type: isVideo(photo) ? 'video' : 'image',
        src: normalizeImageUrl(getMediaUrl(photo))
      })),
      ...(currentProduct.videos || []).map(video => ({
        type: 'video',
        src: normalizeImageUrl(getMediaUrl(video))
      }))
    ];
    
    setMediaItems(allMedia);
    setInitialMediaIndex(startIndex);
    setIsMediaModalOpen(true);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <PartProductSeoHelmet seo={preliminarySeo} />
        <div className="text-center">
          <p className="text-lg text-gray-600">Загрузка информации о запчасти...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Helmet>
          <title>Запчасть не найдена | Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
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
        <Helmet>
          <title>Запчасть не найдена | Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
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
  const seo = buildProductSeo(currentProduct);
  const breadcrumbItems = buildBreadcrumbsForPath(location.pathname, { product: currentProduct });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);
  const structuredData = breadcrumbJsonLd
    ? { '@context': 'https://schema.org', '@graph': [seo.jsonLd, breadcrumbJsonLd] }
    : seo.jsonLd;

  return (
    <div className="min-h-screen bg-gray-50 max-md:pb-28">
      <PartProductSeoHelmet seo={seo} structuredData={structuredData} product={currentProduct} />
      {/* Back Button */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center text-gray-600 hover:text-blue-600 transition-colors"
        >
          <svg className="w-5 h-5 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Назад к списку</span>
        </button>
      </div>

      {/* Main Product Card */}
      <div className="max-w-6xl mx-auto px-4 pb-8 max-md:pb-32">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden max-md:rounded-none max-md:border-x-0 max-md:border-t-0">
          {/* Header with Product Info */}
          <div className="p-5 border-b border-gray-100">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1">
                <h1 className="mb-3 text-2xl font-bold leading-tight text-gray-900 max-md:hidden sm:text-3xl">
                  {formatProductDisplayTitle(
                    currentProduct.brand,
                    currentProduct.article,
                    currentProduct.name,
                  )}
                </h1>
                <div className="flex flex-wrap gap-2 items-center">
                  <div className="flex items-center bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                    <svg className="w-4 h-4 mr-1.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                    {currentProduct.brand || '—'}
                  </div>
                  <div className="flex items-center bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg text-sm font-medium">
                    <svg className="w-4 h-4 mr-1.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 20l4-16m2 16l4-16M6 9h14M4 15h14" />
                    </svg>
                    Арт. {currentProduct.article || '—'}
                  </div>
                  {currentProduct.is_new ? (
                    <div className="flex items-center bg-green-50 text-green-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-green-200">
                      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                      Новая
                    </div>
                  ) : (
                    <div className="flex items-center bg-yellow-50 text-yellow-700 px-3 py-1.5 rounded-lg text-sm font-medium border border-yellow-200">
                      <svg className="w-4 h-4 mr-1.5" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                      </svg>
                      Б/у
                    </div>
                  )}
                </div>
              </div>
              <div className="text-left sm:text-right">
                <div className="text-3xl sm:text-4xl font-bold text-gray-900">
                  {currentProduct.price ? `${currentProduct.price.toLocaleString()} ₽` : '—'}
                </div>
              </div>
            </div>
          </div>

          {/* Two Column Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-0">
            {/* Left - Media Gallery (2 columns) */}
            <div className="border-r border-gray-100 p-5 max-md:border-r-0 max-md:px-0 max-md:pt-0 lg:col-span-2">
              {(currentProduct.photos && currentProduct.photos.length > 0) || (currentProduct.videos && currentProduct.videos.length > 0) ? (
                <div>
                  {(() => {
                    // Combine photos and videos into one array
                    const allMediaItems = [
                      ...(currentProduct.photos || []),
                      ...(currentProduct.videos || [])
                    ];
                    
                    return (
                      <>
                        {/* Main Media - Large Display */}
                <div className="relative">
                  <div 
                    className="relative aspect-[4/3] bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl overflow-hidden cursor-pointer group mb-4 border-2 border-gray-200 hover:border-blue-400 transition-all duration-300"
                    onClick={() => handleOpenMediaModal(currentMainMediaIndex)}
                  >
                    {(() => {
                      const firstItem = allMediaItems[currentMainMediaIndex];
                      const mediaUrl = normalizeImageUrl(getMediaUrl(firstItem));
                      const isVideoItem = isVideo(firstItem);
                      
                      return (
                        <>
                          {isVideoItem ? (
                            <div className="relative w-full h-full">
                              <video
                                src={mediaUrl}
                                className="w-full h-full object-contain"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                                <div className="bg-white/90 rounded-full p-5 shadow-xl transform transition-transform duration-300 group-hover:scale-110">
                                  <svg className="w-16 h-16 text-indigo-600 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                    <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                  </svg>
                                </div>
                              </div>
                              <div className="absolute bottom-3 right-3 bg-black/70 text-white px-3 py-1.5 rounded text-sm font-medium">
                                Видео
                              </div>
                            </div>
                          ) : (
                            <img
                              src={mediaUrl}
                              alt="Основное фото"
                              className="w-full h-full object-contain"
                              loading="eager"
                            />
                          )}
                        </>
                      );
                    })()}
                  </div>

                  {/* Navigation Arrows */}
                  {allMediaItems.length > 1 && (
                    <>
                      {/* Left Arrow */}
                      <button
                        className="absolute left-3 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-50 text-gray-700 hover:text-blue-600 p-2.5 rounded-full shadow-lg transition-all duration-200 z-10 border border-gray-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentMainMediaIndex(prev => prev > 0 ? prev - 1 : allMediaItems.length - 1);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                        </svg>
                      </button>

                      {/* Right Arrow */}
                      <button
                        className="absolute right-3 top-1/2 -translate-y-1/2 bg-white hover:bg-gray-50 text-gray-700 hover:text-blue-600 p-2.5 rounded-full shadow-lg transition-all duration-200 z-10 border border-gray-200"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentMainMediaIndex(prev => prev < allMediaItems.length - 1 ? prev + 1 : 0);
                        }}
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                        </svg>
                      </button>

                      {/* Media Counter */}
                      <div className="absolute bottom-3 left-3 bg-black/70 text-white px-3 py-1.5 rounded-full text-sm font-medium">
                        {currentMainMediaIndex + 1} / {allMediaItems.length}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnails Grid */}
                {allMediaItems.length > 1 && (
                  <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 gap-2">
                    {allMediaItems.map((item, index) => {
                      const mediaUrl = normalizeImageUrl(getMediaUrl(item));
                      const isVideoItem = isVideo(item);
                      
                      return (
                        <div 
                          key={index}
                          className={`relative aspect-square bg-gray-50 rounded-lg overflow-hidden cursor-pointer transition-all duration-200 border-2 ${
                            currentMainMediaIndex === index 
                              ? 'border-blue-500 ring-2 ring-blue-200' 
                              : 'border-gray-200 hover:border-blue-400'
                          }`}
                          onClick={() => setCurrentMainMediaIndex(index)}
                        >
                          {isVideoItem ? (
                            <>
                              <video
                                src={mediaUrl}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                              <div className="absolute inset-0 bg-black/40 flex items-center justify-center pointer-events-none">
                                <svg className="w-6 h-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                                  <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                                </svg>
                              </div>
                            </>
                          ) : (
                            <img
                              src={mediaUrl}
                              alt={`Фото ${index + 1}`}
                              className="w-full h-full object-cover"
                              loading="lazy"
                            />
                          )}
                        </div>
                      );  
                    })}
                  </div>
                )}
              </>
            );
          })()}
        </div>
      ) : (
              <div className="flex items-center justify-center h-64 bg-gray-50 rounded-xl">
                <div className="text-center text-gray-400">
                  <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <p className="text-sm">Нет фотографий или видео</p>
                </div>
              </div>
            )}
          </div>

          {/* Right - Info & Actions (1 column) */}
          <div className="p-5 space-y-4">
            {/* Stock & Location */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="bg-gradient-to-br from-emerald-50 to-green-50 rounded-xl p-4 border border-emerald-100">
                <div className="text-2xl font-bold text-emerald-700">{currentProduct.quantity || 0} шт.</div>
              </div>
              <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-4 border border-blue-100">
                <div className="text-xs font-semibold text-blue-900 line-clamp-2">
                  {currentProduct.storage_location?.address || 
                   currentProduct.storage_location?.name || 
                   '—'}
                </div>
              </div>
            </div>

            {/* Description */}
            {currentProduct.description && (
              <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="text-gray-700 text-sm leading-relaxed whitespace-pre-line">
                  {stripHtmlTags(currentProduct.description)}
                </div>
              </div>
            )}

            {/* Add to Cart */}
            {currentProduct && (
            <div className="hidden rounded-xl border border-gray-200 bg-gray-50 p-4 md:block">
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
                            className="w-10 h-10 flex items-center justify-center text-xl font-bold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                          >
                            −
                          </button>
                          <span className="text-xl font-bold w-14 text-center text-gray-900">
                            {cartQuantity}
                          </span>
                          <button
                            onClick={() => handleAddToCart(currentProduct)}
                            disabled={isAdding || stockInfo.noStock}
                            className="w-10 h-10 flex items-center justify-center text-xl font-bold rounded-lg border border-gray-300 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:opacity-50 transition-all"
                          >
                            +
                          </button>
                        </div>
                        {stockInfo.noStock && (
                          <div className="text-xs text-orange-600 font-medium bg-orange-50 px-2 py-1 rounded-md">
                            Нет в наличии
                          </div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => handleAddToCart(currentProduct)}
                        disabled={isAdding || stockInfo.noStock}
                        className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white text-base font-semibold rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {isAdding ? (
                          <svg className="animate-spin h-5 w-5 text-white mx-auto" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                        ) : (
                          <span className="flex items-center justify-center">
                            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
            )}

            {/* Seller */}
            {(sellerOrg?.phone || sellerOrg?.contact_person) && (
              <div className="bg-gradient-to-br from-amber-50 to-orange-50 rounded-xl p-4 border border-amber-100">
                <h3 className="text-sm font-bold text-gray-900 mb-3 flex items-center">
                  <svg className="w-4 h-4 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Продавец
                </h3>
                
                {sellerOrg?.name && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Организация</div>
                    <div className="font-semibold text-gray-900 text-sm">{sellerOrg.name}</div>
                  </div>
                )}
                
                {sellerOrg?.contact_person && (
                  <div className="mb-3">
                    <div className="text-xs text-gray-500 mb-1">Контактное лицо</div>
                    <div className="font-semibold text-gray-900 text-sm">{sellerOrg.contact_person}</div>
                  </div>
                )}
                
                {sellerOrg?.phone && (
                  <div className="mb-2">
                    <button
                      onClick={handleOpenPhoneModal}
                      className="flex items-center justify-center w-full py-2.5 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors shadow-sm"
                    >
                      <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Позвонить
                    </button>
                  </div>
                )}
                
                {/* Кнопка "Написать" */}
                <button
                  onClick={handleWriteToSeller}
                  disabled={creatingChat}
                  className="flex items-center justify-center w-full py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white font-semibold rounded-lg transition-colors shadow-sm"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  {creatingChat ? 'Создание чата...' : 'Написать'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Compatible Vehicles */}
      {currentProduct.compatible_vehicles && currentProduct.compatible_vehicles.length > 0 && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-5 mt-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            Совместимые автомобили
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {currentProduct.compatible_vehicles.map((vehicle) => (
              <div key={vehicle.id} className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                <div className="flex items-center mb-3 pb-3 border-b border-gray-200">
                  <svg className="w-4 h-4 mr-2 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  <span className="font-bold text-gray-900 text-sm">{vehicle.brand} {vehicle.model}</span>
                </div>
                <div className="space-y-1.5 text-xs">
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
                      <span className="font-semibold text-gray-900 truncate max-w-[150px]">{vehicle.vin}</span>
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

      {/* Phone Modal */}
      {isPhoneModalOpen && sellerOrg?.phone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={handleClosePhoneModal}>
          <div 
            className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 transform transition-all"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900 flex items-center">
                <svg className="w-5 h-5 mr-2 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                Телефон продавца
              </h3>
              <button
                onClick={handleClosePhoneModal}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Phone Number */}
            <div className="bg-gray-50 rounded-xl p-4 mb-4">
              <div className="text-center">
                <div className="text-sm text-gray-500 mb-2">Номер телефона</div>
                <div className="text-2xl font-bold text-gray-900">{formatPhoneNumber(sellerOrg.phone)}</div>
              </div>
            </div>

            {/* Call Button */}
            <a
              href={`tel:${sellerOrg.phone.replace(/\D/g, '')}`}
              className="flex items-center justify-center w-full py-3 bg-amber-500 hover:bg-amber-600 text-white font-semibold rounded-lg transition-colors shadow-sm"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              Позвонить
            </a>
          </div>
        </div>
      )}
    </div>

      {currentProduct ? (
        <div
          className="md:hidden fixed inset-x-0 z-[44] border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mx-auto flex max-w-6xl items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-xs text-gray-500">Цена</div>
              <div className="truncate text-lg font-bold text-gray-900">
                {currentProduct.price ? `${currentProduct.price.toLocaleString()} ₽` : '—'}
              </div>
            </div>
            {(() => {
              const cartQuantity = getCartQuantity(currentProduct.id);
              const stockInfo = getStockAvailability(currentProduct);
              const isAdding = addingToCartId === currentProduct.id;
              if (cartQuantity > 0) {
                return (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleRemoveFromCart(currentProduct)}
                      disabled={isAdding}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-xl font-bold disabled:opacity-50"
                    >
                      −
                    </button>
                    <span className="w-10 text-center text-lg font-bold">{cartQuantity}</span>
                    <button
                      type="button"
                      onClick={() => handleAddToCart(currentProduct)}
                      disabled={isAdding || stockInfo.noStock}
                      className="flex h-11 w-11 items-center justify-center rounded-lg border border-gray-300 bg-white text-xl font-bold disabled:opacity-50"
                    >
                      +
                    </button>
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  onClick={() => handleAddToCart(currentProduct)}
                  disabled={isAdding || stockInfo.noStock}
                  className="min-h-11 shrink-0 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isAdding ? '…' : 'В корзину'}
                </button>
              );
            })()}
            {(sellerOrg?.phone || sellerOrg?.contact_person) ? (
              <button
                type="button"
                onClick={handleWriteToSeller}
                disabled={creatingChat}
                className="min-h-11 shrink-0 rounded-lg border border-blue-200 bg-blue-50 px-3 text-sm font-semibold text-blue-800 disabled:opacity-50"
              >
                {creatingChat ? '…' : 'Чат'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PartDetail;