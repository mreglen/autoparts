import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { fetchPublicProduct, searchAllProducts } from '../../redux/slices/ProductSlice';
import { addUsedPartsToCart, removeUsedFromCart, updateUsedCartItemQuantity, selectCart, fetchCart } from '../../redux/slices/CartSlice';
import { createOrGetChat } from '../../redux/slices/ChatSlice';
import { normalizeImageUrl, apiAxiosUnauth } from '../../utils/apiClient';
import { stripHtmlTags } from '../../utils/text';
import { buildPartDetailPath, parsePartDetailParam, partDetailPathsMatch } from '../../utils/partRoutes';
import { extractProductDescription, formatProductDisplayTitle } from '../../utils/productDisplayName';
import { buildProductSeo, seoFromPartMetaResponse, buildProductStructuredDataBlocks, buildProductPhotoAlt } from '../../utils/productSeo';
import { DEFAULT_OG_IMAGE_URL } from '../../utils/seoConstants';
import { buildBreadcrumbJsonLd, buildBreadcrumbsForPath } from '../../utils/breadcrumbs';
import MediaModal from '../../components/MediaModal/MediaModal';
import PartDetailSeoCrossLinks from './PartDetailSeoCrossLinks';
import PartDetailSeoSummary from './PartDetailSeoSummary';
import PartDetailSpecsBlock from './PartDetailSpecsBlock';
import PartDetailFitmentBlock from './PartDetailFitmentBlock';
import PartDetailAboutBlock from './PartDetailAboutBlock';
import PartDetailFaqBlock from './PartDetailFaqBlock';
import PartDetailTrustRow from './PartDetailTrustRow';
import PartDetailInspectionBlock from './PartDetailInspectionBlock';
import PartDetailReturnPolicyBlock from './PartDetailReturnPolicyBlock';
import PartArticleMatchesBlock from '../../components/PartArticleMatchesBlock/PartArticleMatchesBlock';
import ShareButton from '../../components/ShareButton/ShareButton';
import FavoriteButton from '../../components/FavoriteButton/FavoriteButton';
import Breadcrumbs from '../../components/Breadcrumbs/Breadcrumbs';
import { trackConversion, CONVERSION_EVENTS } from '../../utils/siteAnalytics';
import useHistoryBack from '../../hooks/useHistoryBack';
import { recordProductView } from '../../redux/slices/UserEngagementSlice';
import { mergeProductFitment } from '../../utils/mergeProductFitment';
import { buildProductFaqJsonLd } from '../../utils/partDetailFaq';
import { resolveProductCity } from '../../utils/productSearchSeo';
import { buildProductUsedCatalogPath } from '../../utils/productSeo';
import {
  PART_DETAIL_CACHE,
  readPartDetailCache,
  writePartDetailCache,
} from '../../utils/partDetailCache';
import { useProductPriceFormat } from '../../hooks/useProductPriceFormat';
import { getUsedPurchaseActions } from '../../utils/usedPurchaseMode';

const formatErrorText = (value) => {
  if (!value) return 'Ошибка загрузки товара';
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    const text = value
      .map((item) => {
        if (typeof item === 'string') return item;
        if (item && typeof item === 'object') return item.msg || item.input || '';
        return '';
      })
      .filter(Boolean)
      .join('; ');
    return text || 'Ошибка загрузки товара';
  }
  if (typeof value === 'object') {
    return value.msg || value.input || 'Ошибка загрузки товара';
  }
  return 'Ошибка загрузки товара';
};

function PartProductSeoHelmet({ seo, structuredDataBlocks, product }) {
  if (!seo) return null;
  const ogImage = seo.imageUrl || DEFAULT_OG_IMAGE_URL;
  const ogImageAlt = seo.ogImageAlt || seo.title;
  const inStock = (product?.quantity || 0) > 0;
  return (
    <Helmet>
      <title>{seo.title}</title>
      <meta name="description" content={seo.description} />
      {seo.keywords ? <meta name="keywords" content={seo.keywords} /> : null}
      <meta name="robots" content={seo.robots || 'index, follow'} />
      <link rel="canonical" href={seo.canonicalUrl} />
      <meta property="og:type" content="product" />
      <meta property="og:site_name" content="Свой Гараж" />
      <meta property="og:title" content={seo.title} />
      <meta property="og:description" content={seo.description} />
      <meta property="og:url" content={seo.canonicalUrl} />
      <meta property="og:locale" content="ru_RU" />
      <meta property="og:image" content={ogImage} />
      <meta property="og:image:alt" content={ogImageAlt} />
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={seo.title} />
      <meta name="twitter:description" content={seo.description} />
      <meta name="twitter:image" content={ogImage} />
      <meta name="twitter:image:alt" content={ogImageAlt} />
      {product?.price ? (
        <>
          <meta property="product:price:amount" content={String(product.price)} />
          <meta property="product:price:currency" content="RUB" />
        </>
      ) : null}
      <meta
        property="product:availability"
        content={inStock ? 'in stock' : 'out of stock'}
      />
      {structuredDataBlocks?.map((block) => (
        <script key={block['@type'] || block['@id']} type="application/ld+json">
          {JSON.stringify(block)}
        </script>
      ))}
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
  
  const { currentProduct, error } = useSelector((state) => state.products);
  const { user } = useSelector((state) => state.auth);
  const cart = useSelector(selectCart);
  const purchaseMode = useSelector((state) => state.publicInfo.usedPartsPurchaseMode);
  const { formatPrice: formatProductPriceDisplay } = useProductPriceFormat();
  const [addingToCartId, setAddingToCartId] = useState(null);
  const [isMediaModalOpen, setIsMediaModalOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState([]);
  const [initialMediaIndex, setInitialMediaIndex] = useState(0);
  const [currentMainMediaIndex, setCurrentMainMediaIndex] = useState(0);
  const [creatingChat, setCreatingChat] = useState(false);
  const [buyingNow, setBuyingNow] = useState(false);
  const [isPhoneModalOpen, setIsPhoneModalOpen] = useState(false);
  const [apiSeo, setApiSeo] = useState(null);
  const [alternateOffers, setAlternateOffers] = useState([]);
  const [alternateOffersLoading, setAlternateOffersLoading] = useState(false);
  const [alternateOffersError, setAlternateOffersError] = useState('');
  const [referenceFitment, setReferenceFitment] = useState([]);
  const [referenceFitmentLoading, setReferenceFitmentLoading] = useState(false);
  const [soldOutAlternates, setSoldOutAlternates] = useState([]);
  const [soldOutAlternatesLoading, setSoldOutAlternatesLoading] = useState(false);
  const fetchedProductIdRef = useRef(null);
  const searchedBrandArticleRef = useRef(null);
  const trackedPartViewRef = useRef(null);
  const recordedEngagementViewRef = useRef(null);
  const canonicalRedirectRef = useRef(null);

  const routeIdentityKey = useMemo(() => {
    if (extractedProductId) {
      const numericId = parseInt(extractedProductId, 10);
      if (!Number.isNaN(numericId) && numericId > 0) {
        return `id:${numericId}`;
      }
    }
    if (extractedBrand && extractedArticle) {
      return `ba:${extractedBrand}|${extractedArticle}`;
    }
    return combinedParam || '';
  }, [extractedProductId, extractedBrand, extractedArticle, combinedParam]);

  const resolvedProductId = useMemo(() => {
    if (!extractedProductId) return null;
    const numericId = parseInt(extractedProductId, 10);
    return !Number.isNaN(numericId) && numericId > 0 ? numericId : null;
  }, [extractedProductId]);

  const productMatchesRoute = useMemo(() => {
    if (!currentProduct?.id) return false;

    if (resolvedProductId) {
      return currentProduct.id === resolvedProductId;
    }

    if (extractedBrand && extractedArticle) {
      const decodedBrand = decodeURIComponent(extractedBrand).toLowerCase();
      const decodedArticle = decodeURIComponent(extractedArticle).toLowerCase();
      return (
        (currentProduct.brand || '').toLowerCase() === decodedBrand &&
        (currentProduct.article || '').toLowerCase() === decodedArticle
      );
    }

    return true;
  }, [currentProduct, resolvedProductId, extractedBrand, extractedArticle]);

  const displayProduct = useMemo(() => {
    if (!currentProduct?.id) return null;
    if (productMatchesRoute) return currentProduct;
    if (resolvedProductId && currentProduct.id === resolvedProductId) return currentProduct;
    return null;
  }, [currentProduct, productMatchesRoute, resolvedProductId]);

  const showProduct = Boolean(displayProduct);

  useEffect(() => {
    fetchedProductIdRef.current = null;
    searchedBrandArticleRef.current = null;
    trackedPartViewRef.current = null;
    recordedEngagementViewRef.current = null;
  }, [routeIdentityKey]);

  useEffect(() => {
    canonicalRedirectRef.current = null;
  }, [resolvedProductId ?? routeIdentityKey]);

  useEffect(() => {
    const path = location.pathname;
    if (!path.startsWith('/part/')) {
      setApiSeo(null);
      return;
    }

    const cachedSeo = readPartDetailCache(PART_DETAIL_CACHE.partMeta, path);
    if (cachedSeo) {
      setApiSeo(cachedSeo);
      return undefined;
    }

    let cancelled = false;
    const run = async () => {
      try {
        const response = await apiAxiosUnauth.get('/public/part-meta', { params: { path } });
        const seo = seoFromPartMetaResponse(response?.data);
        if (!cancelled) {
          writePartDetailCache(PART_DETAIL_CACHE.partMeta, path, seo);
          setApiSeo(seo);
        }
      } catch (_e) {
        if (!cancelled) setApiSeo(null);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [location.pathname]);

  useEffect(() => {
    if (!showProduct || !displayProduct?.brand || !displayProduct?.article) {
      setAlternateOffers([]);
      setAlternateOffersError('');
      return undefined;
    }

    let cancelled = false;
    const cacheKey = `${displayProduct.brand}|${displayProduct.article}|${displayProduct.id}`;
    const cachedOffers = readPartDetailCache(PART_DETAIL_CACHE.alternateOffers, cacheKey);
    if (cachedOffers) {
      setAlternateOffers(cachedOffers);
      setAlternateOffersLoading(false);
      setAlternateOffersError('');
      return undefined;
    }

    const run = async () => {
      setAlternateOffersLoading(true);
      setAlternateOffersError('');
      try {
        const response = await apiAxiosUnauth.get('/products/public/find-used-match', {
          params: {
            brand: displayProduct.brand,
            article: displayProduct.article,
            limit: 20,
            exclude_product_id: displayProduct.id,
          },
        });
        const items = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) {
          writePartDetailCache(PART_DETAIL_CACHE.alternateOffers, cacheKey, items);
          setAlternateOffers(items);
        }
      } catch (_error) {
        if (!cancelled) {
          setAlternateOffers([]);
          setAlternateOffersError('Не удалось загрузить другие предложения');
        }
      } finally {
        if (!cancelled) setAlternateOffersLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [showProduct, displayProduct?.id, displayProduct?.brand, displayProduct?.article]);

  useEffect(() => {
    if (!showProduct || !displayProduct?.brand || !displayProduct?.article) {
      setReferenceFitment([]);
      return undefined;
    }

    let cancelled = false;
    const fitmentKey = `${displayProduct.brand}|${displayProduct.article}|${displayProduct.id}`;
    const cachedFitment = readPartDetailCache(PART_DETAIL_CACHE.referenceFitment, fitmentKey);
    if (cachedFitment) {
      setReferenceFitment(cachedFitment);
      setReferenceFitmentLoading(false);
      return undefined;
    }

    const run = async () => {
      setReferenceFitmentLoading(true);
      try {
        const response = await apiAxiosUnauth.get('/public/part-reference-fitment', {
          params: {
            brand: displayProduct.brand,
            article: displayProduct.article,
            exclude_product_id: displayProduct.id,
          },
        });
        const vehicles = Array.isArray(response?.data?.vehicles) ? response.data.vehicles : [];
        if (!cancelled) {
          writePartDetailCache(PART_DETAIL_CACHE.referenceFitment, fitmentKey, vehicles);
          setReferenceFitment(vehicles);
        }
      } catch (_error) {
        if (!cancelled) setReferenceFitment([]);
      } finally {
        if (!cancelled) setReferenceFitmentLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [showProduct, displayProduct?.id, displayProduct?.brand, displayProduct?.article]);

  useEffect(() => {
    if (showProduct || !error) {
      setSoldOutAlternates([]);
      return undefined;
    }
    if (!extractedBrand || !extractedArticle) return undefined;

    let cancelled = false;
    const run = async () => {
      setSoldOutAlternatesLoading(true);
      try {
        const decodedBrand = decodeURIComponent(extractedBrand);
        const decodedArticle = decodeURIComponent(extractedArticle);
        const response = await apiAxiosUnauth.get('/products/public/find-used-match', {
          params: {
            brand: decodedBrand,
            article: decodedArticle,
            limit: 12,
          },
        });
        const items = Array.isArray(response?.data) ? response.data : [];
        if (!cancelled) setSoldOutAlternates(items);
      } catch (_err) {
        if (!cancelled) setSoldOutAlternates([]);
      } finally {
        if (!cancelled) setSoldOutAlternatesLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [showProduct, error, extractedBrand, extractedArticle]);

  useEffect(() => {
    if (!showProduct || !currentProduct?.id) return;
    const canonicalPath = buildPartDetailPath(currentProduct);
    if (canonicalPath && location.pathname !== canonicalPath) return;
    if (trackedPartViewRef.current === currentProduct.id) return;
    trackedPartViewRef.current = currentProduct.id;
    trackConversion(CONVERSION_EVENTS.PART_VIEW, {
      productId: currentProduct.id,
      path: canonicalPath || location.pathname,
      section: 'used',
    });
  }, [showProduct, currentProduct?.id, location.pathname]);

  useEffect(() => {
    if (!showProduct || !currentProduct?.id || !user) return;
    const canonicalPath = buildPartDetailPath(currentProduct);
    if (canonicalPath && location.pathname !== canonicalPath) return;
    if (recordedEngagementViewRef.current === currentProduct.id) return;
    recordedEngagementViewRef.current = currentProduct.id;
    dispatch(recordProductView(currentProduct.id));
  }, [showProduct, currentProduct?.id, user, location.pathname, dispatch]);

  useEffect(() => {
    if (!displayProduct?.id) return;
    const canonicalPath = buildPartDetailPath(displayProduct);
    if (!canonicalPath || location.pathname === canonicalPath) return;
    if (partDetailPathsMatch(location.pathname, canonicalPath)) return;
    if (canonicalRedirectRef.current === displayProduct.id) return;
    canonicalRedirectRef.current = displayProduct.id;
    navigate(canonicalPath, { replace: true });
  }, [displayProduct?.id, displayProduct?.brand, displayProduct?.article, location.pathname, navigate]);

  useEffect(() => {
    if (resolvedProductId) {
      if (fetchedProductIdRef.current === resolvedProductId) {
        return;
      }
      if (currentProduct?.id === resolvedProductId) {
        fetchedProductIdRef.current = resolvedProductId;
        return;
      }
      fetchedProductIdRef.current = resolvedProductId;
      dispatch(fetchPublicProduct(resolvedProductId));
      return;
    }

    if (extractedBrand && extractedArticle) {
      const searchKey = `${extractedBrand}|${extractedArticle}`;
      if (searchedBrandArticleRef.current === searchKey) {
        return;
      }
      searchedBrandArticleRef.current = searchKey;

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
            fetchedProductIdRef.current = matchedProduct.id;
            dispatch(fetchPublicProduct(matchedProduct.id));
          } else {
            const articleMatch = data.find(p => 
              p.article?.toLowerCase() === decodedArticle.toLowerCase()
            );
            if (articleMatch) {
              fetchedProductIdRef.current = articleMatch.id;
              dispatch(fetchPublicProduct(articleMatch.id));
            }
          }
        } catch (err) {
          console.error('Error searching for product by brand and article:', err);
        }
      };
      
      fetchByBrandAndArticle();
    }
  }, [dispatch, resolvedProductId, extractedBrand, extractedArticle, currentProduct?.id]);

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
      trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
        productId: part.id,
        path: buildPartDetailPath(part) || location.pathname,
        section: 'used',
      });
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

  const buildUsedOrderItem = (cartItem, sellerFallback) => ({
    id: cartItem.id,
    type: 'used',
    seller: cartItem.seller || sellerFallback,
    brand: cartItem.brand,
    number: cartItem.partnumber,
    internalCode: cartItem.partnumber,
    name: `${cartItem.brand} ${cartItem.partnumber}`,
    deliveryDate: cartItem.delivery,
    price: cartItem.price,
    quantity: cartItem.quantity,
    maxQuantity: cartItem.max_quantity,
    product_id: cartItem.product_id,
    image: '/api/placeholder/80/80',
  });

  const handleBuyNow = async () => {
    if (!user) {
      navigate('/auth', { state: { from: window.location.pathname } });
      return;
    }
    if (!currentProduct) return;

    const stockInfo = getStockAvailability(currentProduct);
    const { showCart: canBuy } = getUsedPurchaseActions(
      purchaseMode,
      Boolean(currentProduct?.is_new),
    );
    if (!canBuy || stockInfo.noStock) return;

    setBuyingNow(true);
    try {
      const cartQuantity = getCartQuantity(currentProduct.id);
      if (cartQuantity === 0) {
        await dispatch(addUsedPartsToCart({ product_id: currentProduct.id, quantity: 1 })).unwrap();
        trackConversion(CONVERSION_EVENTS.ADD_TO_CART, {
          productId: currentProduct.id,
          path: buildPartDetailPath(currentProduct) || location.pathname,
          section: 'used',
        });
      }

      const freshCart = await dispatch(fetchCart()).unwrap();
      const cartItem = freshCart?.used_parts_items?.find(
        (item) => item.product_id === currentProduct.id,
      );
      if (!cartItem) {
        alert('Не удалось оформить заказ. Попробуйте ещё раз.');
        return;
      }

      const seller = currentProduct.organization?.name || cartItem.seller || 'Продавец';
      const orderData = {
        items: [buildUsedOrderItem(cartItem, seller)],
        seller,
        deliverInParts: false,
        checkoutType: 'used',
      };
      localStorage.setItem('orderData', JSON.stringify(orderData));
      navigate('/order-reg');
    } catch (error) {
      console.error('Ошибка быстрого заказа:', error);
      alert('Не удалось оформить заказ. Попробуйте ещё раз.');
    } finally {
      setBuyingNow(false);
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
      trackConversion(CONVERSION_EVENTS.CHAT_START, {
        productId: currentProduct.id,
        path: buildPartDetailPath(currentProduct) || location.pathname,
        section: 'used',
      });

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
    if (currentProduct?.id) {
      trackConversion(CONVERSION_EVENTS.SHOW_PHONE, {
        productId: currentProduct.id,
        path: buildPartDetailPath(currentProduct) || location.pathname,
        section: 'used',
      });
    }
    setIsPhoneModalOpen(true);
  };

  const handleClosePhoneModal = () => {
    setIsPhoneModalOpen(false);
  };

  const handleBackToList = useHistoryBack('/autoparts/used');

  useEffect(() => {
    if (!isPhoneModalOpen) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') handleClosePhoneModal();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [isPhoneModalOpen]);

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

  if (!showProduct && error) {
    const soldOutBrand = extractedBrand ? decodeURIComponent(extractedBrand) : '';
    const soldOutArticle = extractedArticle ? decodeURIComponent(extractedArticle) : '';
    const soldOutLabel = [soldOutBrand, soldOutArticle].filter(Boolean).join(' ');
    const catalogPath = buildProductUsedCatalogPath({ brand: soldOutBrand, article: soldOutArticle });

    if (soldOutLabel) {
      return (
        <div className="min-h-screen bg-gray-50">
          <Helmet>
            <title>{soldOutLabel} — продано | Свой Гараж</title>
            <meta name="robots" content="noindex, follow" />
          </Helmet>
          <div className="max-w-6xl mx-auto px-4 py-8">
            <Breadcrumbs
              items={[
                { label: 'Главная', href: '/' },
                { label: 'Б/у запчасти', href: '/autoparts/used' },
                { label: soldOutLabel },
              ]}
              includeJsonLd={false}
            />
            <div className="rounded-2xl border border-amber-200 bg-amber-50 px-6 py-8 text-center shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">Продано</p>
              <h1 className="mt-2 text-2xl font-bold text-gray-900">{soldOutLabel}</h1>
              <p className="mt-3 text-gray-600">
                Это предложение уже недоступно. Посмотрите другие варианты с тем же артикулом.
              </p>
              <button
                type="button"
                onClick={() => navigate(catalogPath)}
                className="mt-5 inline-flex rounded-md bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
              >
                Каталог по артикулу
              </button>
            </div>
            <div className="mt-6">
              <PartArticleMatchesBlock
                title={`Другие предложения ${soldOutLabel}`}
                items={soldOutAlternates}
                loading={soldOutAlternatesLoading}
                error={soldOutAlternates.length ? '' : 'Других предложений не найдено'}
              />
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="min-h-screen flex items-center justify-center">
        <Helmet>
          <title>Запчасть не найдена | Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <div className="text-center">
          <p className="text-lg text-red-600">Ошибка загрузки информации о запчасти</p>
          <p className="text-sm text-gray-500 mt-2">{formatErrorText(error)}</p>
          <button 
            type="button"
            onClick={handleBackToList}
            className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700"
          >
            Назад
          </button>
        </div>
      </div>
    );
  }

  if (!showProduct) {
    return (
      <div className="min-h-screen bg-gray-50 max-md:pb-28">
        {apiSeo ? <PartProductSeoHelmet seo={apiSeo} structuredDataBlocks={null} product={null} /> : null}
        <div className="max-w-6xl mx-auto px-4 py-16">
          <div className="rounded-2xl border border-gray-200 bg-white px-6 py-12 text-center shadow-sm">
            <p className="text-lg text-gray-600">Загрузка информации о запчасти...</p>
          </div>
        </div>
      </div>
    );
  }

  const sellerOrg = currentProduct.organization;
  const { showCart, showSellerContact } = getUsedPurchaseActions(
    purchaseMode,
    Boolean(currentProduct?.is_new),
  );
  const sellerLogoUrl = sellerOrg?.logo_organization
    ? normalizeImageUrl(sellerOrg.logo_organization)
    : null;
  const localSeo = buildProductSeo(currentProduct);
  const seo = apiSeo
    ? {
        ...localSeo,
        ...apiSeo,
        jsonLd: apiSeo.jsonLd || localSeo.jsonLd,
      }
    : localSeo;
  const breadcrumbItems = buildBreadcrumbsForPath(location.pathname, {
    product: currentProduct,
    isNew: apiSeo?.isNew ?? currentProduct.is_new,
  });
  const breadcrumbJsonLd = buildBreadcrumbJsonLd(breadcrumbItems);
  const partBrand = (currentProduct.brand || '').trim();
  const partArticle = (currentProduct.article || '').trim();
  const partTypeName = (currentProduct.part_type?.name || '').trim();
  const productCity = resolveProductCity(currentProduct.organization);
  const mergedFitment = mergeProductFitment(
    currentProduct.compatible_vehicles,
    referenceFitment,
  );
  const fitmentText = mergedFitment
    .slice(0, 8)
    .map((vehicle) => [vehicle.brand, vehicle.model, vehicle.generation].filter(Boolean).join(' '))
    .join(', ');
  const inStock = (currentProduct.quantity || 0) > 0;
  const bodyDescription = seo.bodyDescription || localSeo.bodyDescription;
  const faqJsonLd = apiSeo?.faqJsonLd || buildProductFaqJsonLd({
    canonicalUrl: seo.canonicalUrl,
    brand: partBrand,
    article: partArticle,
    partTypeName,
    isNew: Boolean(currentProduct.is_new),
    city: productCity,
    fitmentText,
    inStock,
  });
  const faqItems = apiSeo?.faqItems || null;
  const structuredDataBlocks = buildProductStructuredDataBlocks({
    productJsonLd: seo.jsonLd,
    breadcrumbJsonLd,
    faqJsonLd,
  });

  const photoAltMain = buildProductPhotoAlt({
    brand: partBrand,
    article: partArticle,
    name: currentProduct.name,
    isMain: true,
  });
  const h1Primary = apiSeo?.h1
    || [partBrand, partArticle].filter(Boolean).join(' ')
    || formatProductDisplayTitle(partBrand, partArticle, currentProduct.name);
  const h1Subtitle = extractProductDescription(
    currentProduct.name,
    partBrand,
    partArticle,
  );
  const alternateOffersTitle = partBrand && partArticle
    ? `Другие предложения ${partBrand} ${partArticle}`
    : 'Другие предложения с этим артикулом';
  const shareText = [
    h1Primary,
    currentProduct.price ? formatProductPriceDisplay(currentProduct.price) : null,
  ]
    .filter(Boolean)
    .join(' — ');

  const allMediaItems = [
    ...(currentProduct.photos || []),
    ...(currentProduct.videos || []),
  ];
  const hasSellerContact = showSellerContact && (sellerOrg?.phone || sellerOrg?.contact_person);
  const stockInfo = getStockAvailability(currentProduct);
  const canShowBuyNow = showCart && inStock && !stockInfo.noStock;
  const canShowWrite = hasSellerContact;
  const showMobileStickyCta = canShowBuyNow || canShowWrite;

  const renderMediaThumbnails = (className = '') => {
    if (allMediaItems.length <= 1) return null;
    return (
      <div className={`grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 ${className}`}>
        {allMediaItems.map((item, index) => {
          const mediaUrl = normalizeImageUrl(getMediaUrl(item));
          const isVideoItem = isVideo(item);

          return (
            <div
              key={index}
              className={`relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-gray-50 ${
                currentMainMediaIndex === index
                  ? 'border-indigo-500'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
              onClick={() => setCurrentMainMediaIndex(index)}
            >
              {isVideoItem ? (
                <>
                  <video
                    src={mediaUrl}
                    className="h-full w-full object-cover"
                    muted
                    playsInline
                    preload="metadata"
                  />
                  <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
                    <svg className="h-6 w-6 text-white drop-shadow-lg" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                </>
              ) : (
                <img
                  src={mediaUrl}
                  alt={buildProductPhotoAlt({
                    brand: partBrand,
                    article: partArticle,
                    name: currentProduct.name,
                    index,
                  })}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderMainGallery = () => {
    if (allMediaItems.length === 0) {
      return (
        <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-gray-200 bg-gray-50">
          <p className="text-sm text-gray-400">Нет фотографий или видео</p>
        </div>
      );
    }

    const firstItem = allMediaItems[currentMainMediaIndex];
    const mediaUrl = normalizeImageUrl(getMediaUrl(firstItem));
    const isVideoItem = isVideo(firstItem);

    return (
      <div>
        <div className="relative">
          <div
            className="group relative mb-3 aspect-[4/3] cursor-pointer overflow-hidden rounded-xl border border-gray-200 bg-gray-50 shadow-inner"
            onClick={() => handleOpenMediaModal(currentMainMediaIndex)}
          >
            {isVideoItem ? (
              <div className="relative h-full w-full">
                <video
                  src={mediaUrl}
                  className="h-full w-full object-contain"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/30">
                  <div className="rounded-full bg-white/90 p-4">
                    <svg className="ml-0.5 h-10 w-10 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                </div>
                <div className="absolute bottom-3 right-3 rounded bg-black/70 px-3 py-1.5 text-sm font-medium text-white">
                  Видео
                </div>
              </div>
            ) : (
              <img
                src={mediaUrl}
                alt={photoAltMain}
                className="h-full w-full object-contain"
                loading="eager"
              />
            )}
          </div>

          {allMediaItems.length > 1 && (
            <>
              <button
                type="button"
                className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMainMediaIndex((prev) => (prev > 0 ? prev - 1 : allMediaItems.length - 1));
                }}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <button
                type="button"
                className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full border border-gray-200 bg-white p-2 text-gray-600 hover:text-indigo-600"
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentMainMediaIndex((prev) => (prev < allMediaItems.length - 1 ? prev + 1 : 0));
                }}
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </button>
              <div className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 text-xs font-medium text-white">
                {currentMainMediaIndex + 1} / {allMediaItems.length}
              </div>
            </>
          )}
        </div>
        {renderMediaThumbnails()}
      </div>
    );
  };

  const renderMobileTitleBlock = () => (
    <>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          {currentProduct.brand || '—'}
        </span>
        <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
          Арт. {currentProduct.article || '—'}
        </span>
        {currentProduct.is_new ? (
          <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
            Новая
          </span>
        ) : (
          <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
            Б/у
          </span>
        )}
        {inStock ? (
          <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
            В наличии
          </span>
        ) : null}
      </div>
      <h1 className="text-xl font-bold leading-snug text-gray-900">
        <span className="block">{h1Primary}</span>
        {h1Subtitle ? (
          <span className="mt-1 block text-base font-medium text-gray-600">{h1Subtitle}</span>
        ) : null}
      </h1>
      <PartDetailSeoCrossLinks
        brand={partBrand}
        article={partArticle}
        isNew={Boolean(currentProduct.is_new)}
        organizationId={sellerOrg?.id}
        organizationName={sellerOrg?.name}
        usedCatalogPath={seo.usedCatalogPath}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 via-gray-50 to-gray-100 max-md:pb-28">
      <PartProductSeoHelmet seo={seo} structuredDataBlocks={structuredDataBlocks} product={currentProduct} />

      <div className="md:hidden">
        <div className="relative min-h-[52dvh] max-h-[62dvh] bg-gray-100">
          {allMediaItems.length > 0 ? (
            <div
              className="relative h-full min-h-[52dvh] max-h-[62dvh] cursor-pointer"
              onClick={() => handleOpenMediaModal(currentMainMediaIndex)}
            >
              {(() => {
                const firstItem = allMediaItems[currentMainMediaIndex];
                const mediaUrl = normalizeImageUrl(getMediaUrl(firstItem));
                const isVideoItem = isVideo(firstItem);
                if (isVideoItem) {
                  return (
                    <div className="relative h-full min-h-[52dvh] max-h-[62dvh]">
                      <video
                        src={mediaUrl}
                        className="h-full w-full object-contain"
                        muted
                        playsInline
                        preload="metadata"
                      />
                      <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                        <div className="rounded-full bg-white/90 p-3">
                          <svg className="ml-0.5 h-8 w-8 text-indigo-600" fill="currentColor" viewBox="0 0 20 20">
                            <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                          </svg>
                        </div>
                      </div>
                    </div>
                  );
                }
                return (
                  <img
                    src={mediaUrl}
                    alt={photoAltMain}
                    className="h-full min-h-[52dvh] max-h-[62dvh] w-full object-contain"
                    loading="eager"
                  />
                );
              })()}

              {allMediaItems.length > 1 && (
                <>
                  <button
                    type="button"
                    className="absolute left-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-700 shadow-sm backdrop-blur"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentMainMediaIndex((prev) => (prev > 0 ? prev - 1 : allMediaItems.length - 1));
                    }}
                    aria-label="Предыдущее фото"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="absolute right-2 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/80 p-2 text-gray-700 shadow-sm backdrop-blur"
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentMainMediaIndex((prev) => (prev < allMediaItems.length - 1 ? prev + 1 : 0));
                    }}
                    aria-label="Следующее фото"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                  <div className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
                    {currentMainMediaIndex + 1}/{allMediaItems.length}
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex min-h-[52dvh] items-center justify-center bg-gray-100">
              <p className="text-sm text-gray-400">Нет фотографий</p>
            </div>
          )}

          <div
            className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]"
          >
            <button
              type="button"
              onClick={handleBackToList}
              className="pointer-events-auto flex h-10 w-10 items-center justify-center rounded-full bg-white/80 text-gray-800 shadow-sm backdrop-blur"
              aria-label="Назад"
            >
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <div className="pointer-events-auto flex items-center gap-2">
              <FavoriteButton
                productId={currentProduct.id}
                size="sm"
                showLabel={false}
                className="h-10 w-10 min-h-0 rounded-full border-0 bg-white/80 p-0 shadow-sm backdrop-blur"
              />
              <ShareButton
                url={seo.canonicalUrl}
                title={h1Primary}
                text={shareText}
                showLabel={false}
                size="sm"
                className="h-10 w-10 min-h-0 rounded-full border-0 bg-white/80 p-0 shadow-sm backdrop-blur"
              />
            </div>
          </div>
        </div>

        <div className="border-b border-gray-100 bg-white px-4 py-3">
          <div className="text-2xl font-bold text-gray-900">
            {currentProduct.price ? formatProductPriceDisplay(currentProduct.price) : '—'}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-6xl px-4 pb-8 pt-3 max-md:px-0 max-md:pb-32 max-md:pt-0">
        <div className="mb-4 hidden flex-col gap-2 sm:flex-row sm:items-center sm:justify-between md:flex">
          <Breadcrumbs items={breadcrumbItems} includeJsonLd={false} />
          <button
            type="button"
            onClick={handleBackToList}
            className="inline-flex items-center self-start rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-600 shadow-sm transition-colors hover:border-indigo-200 hover:text-indigo-600 sm:self-auto"
          >
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
            </svg>
            Назад к списку
          </button>
        </div>

        <div className="mb-4 px-4 pt-3 md:hidden">
          <Breadcrumbs items={breadcrumbItems} includeJsonLd={false} />
        </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm max-md:rounded-none max-md:border-x-0 max-md:shadow-none">
          <div className="hidden border-b border-gray-100 bg-gradient-to-r from-white to-slate-50/80 px-4 py-5 sm:px-6 md:block">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    {currentProduct.brand || '—'}
                  </span>
                  <span className="rounded-md bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700">
                    Арт. {currentProduct.article || '—'}
                  </span>
                  {currentProduct.is_new ? (
                    <span className="rounded-md bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">
                      Новая
                    </span>
                  ) : (
                    <span className="rounded-md bg-amber-100 px-2.5 py-1 text-xs font-semibold text-amber-900">
                      Б/у
                    </span>
                  )}
                  {inStock ? (
                    <span className="rounded-md bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-200">
                      В наличии
                    </span>
                  ) : null}
                </div>
                <h1 className="text-xl font-bold leading-snug text-gray-900 sm:text-2xl lg:text-[1.65rem]">
                  <span className="block">{h1Primary}</span>
                  {h1Subtitle ? (
                    <span className="mt-1 block text-base font-medium text-gray-600">
                      {h1Subtitle}
                    </span>
                  ) : null}
                </h1>
                <PartDetailSeoSummary summary={seo.seoSummary} />
                <PartDetailTrustRow />
                <PartDetailSeoCrossLinks
                  brand={partBrand}
                  article={partArticle}
                  isNew={Boolean(currentProduct.is_new)}
                  organizationId={sellerOrg?.id}
                  organizationName={sellerOrg?.name}
                  usedCatalogPath={seo.usedCatalogPath}
                />
              </div>
              <div className="flex shrink-0 flex-row items-center justify-between gap-4 sm:flex-col sm:items-end lg:min-w-[180px]">
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <FavoriteButton productId={currentProduct.id} size="sm" />
                  <ShareButton
                    url={seo.canonicalUrl}
                    title={h1Primary}
                    text={shareText}
                    size="sm"
                  />
                </div>
                <div className="text-right">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Цена</div>
                  <div className="text-2xl font-bold text-indigo-700 sm:text-3xl">
                    {currentProduct.price ? formatProductPriceDisplay(currentProduct.price) : '—'}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-5">
            <div className="space-y-4 border-gray-100 p-4 sm:p-5 lg:col-span-3 lg:border-r max-md:px-4 max-md:pt-4">
              <div className="hidden md:block">{renderMainGallery()}</div>

              <div className="space-y-3 md:hidden">{renderMobileTitleBlock()}</div>
              {renderMediaThumbnails('md:hidden')}

              <PartDetailSpecsBlock product={currentProduct} />
            </div>

          {/* Right - Info & Actions */}
          <div className="flex flex-col gap-4 bg-slate-50/70 p-4 sm:p-5 lg:col-span-2 max-md:px-4">
            <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <dl className="space-y-2.5 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-gray-500">В наличии</dt>
                  <dd className={`font-semibold ${inStock ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {currentProduct.quantity || 0} шт.
                  </dd>
                </div>
                <div>
                  <dt className="text-gray-500">Адрес</dt>
                  <dd className="mt-1 font-medium leading-snug text-gray-900 break-words">
                    {currentProduct.storage_location?.address
                      || currentProduct.storage_location?.name
                      || '—'}
                  </dd>
                </div>
              </dl>
            </div>

            {/* Description */}
            {currentProduct.description && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="mb-2 text-sm font-semibold text-gray-900">Описание от продавца</h2>
                <div className="text-sm leading-relaxed text-gray-700 whitespace-pre-line">
                  {stripHtmlTags(currentProduct.description)}
                </div>
              </div>
            )}

            {/* Add to Cart */}
            {currentProduct && showCart && (
            <div className="hidden md:block">
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
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-xl font-bold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                          >
                            −
                          </button>
                          <span className="text-xl font-bold w-14 text-center text-gray-900">
                            {cartQuantity}
                          </span>
                          <button
                            onClick={() => handleAddToCart(currentProduct)}
                            disabled={isAdding || stockInfo.noStock}
                            className="flex h-10 w-10 items-center justify-center rounded-md border border-gray-300 bg-white text-xl font-bold hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
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
                        className="w-full rounded-md bg-indigo-600 py-3 text-base font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
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
            {showSellerContact && (sellerOrg?.phone || sellerOrg?.contact_person) && (
              <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-semibold text-gray-900">Продавец</h2>

                <div className="mb-3 flex items-center gap-2.5">
                  <div
                    className={`flex h-9 w-9 shrink-0 overflow-hidden rounded-full ${
                      sellerLogoUrl
                        ? 'border border-gray-200 bg-white'
                        : 'bg-indigo-600'
                    }`}
                  >
                    {sellerLogoUrl ? (
                      <img
                        src={sellerLogoUrl}
                        alt={sellerOrg?.name || 'Логотип продавца'}
                        className="h-full w-full object-contain p-0.5"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-xs font-bold text-white">
                        {(sellerOrg?.name || 'П').substring(0, 2).toUpperCase()}
                      </span>
                    )}
                  </div>
                  <div className="min-w-0">
                    {sellerOrg?.name ? (
                      <p className="truncate text-sm font-medium text-gray-900">{sellerOrg.name}</p>
                    ) : null}
                    {sellerOrg?.contact_person ? (
                      <p className="truncate text-xs text-gray-500">{sellerOrg.contact_person}</p>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-col gap-2 sm:flex-row">
                {sellerOrg?.phone && (
                    <button
                      type="button"
                      onClick={handleOpenPhoneModal}
                      className="flex flex-1 items-center justify-center gap-1.5 rounded-md border border-indigo-200 bg-indigo-50 py-2.5 text-sm font-semibold text-indigo-800 hover:bg-indigo-100"
                    >
                      <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Позвонить
                    </button>
                )}
                
                <button
                  type="button"
                  onClick={handleWriteToSeller}
                  disabled={creatingChat}
                  className="flex flex-1 items-center justify-center rounded-md bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-indigo-400"
                >
                  {creatingChat ? 'Создание чата…' : 'Написать'}
                </button>
                </div>
              </div>
            )}

            <div className="space-y-3 md:hidden">
              <PartDetailSeoSummary summary={seo.seoSummary} />
              <PartDetailTrustRow />
            </div>

            <PartDetailAboutBlock
              bodyDescription={bodyDescription}
              isNew={Boolean(currentProduct.is_new)}
            />
          </div>
        </div>
      </div>

        <div className="mt-6 space-y-4 max-md:px-4">
      <PartDetailFitmentBlock
        sellerVehicles={currentProduct.compatible_vehicles}
        referenceVehicles={referenceFitment}
        loading={referenceFitmentLoading}
      />

      <PartArticleMatchesBlock
        title={alternateOffersTitle}
        items={alternateOffers}
        loading={alternateOffersLoading}
        error={alternateOffersError}
        currentProductId={currentProduct.id}
      />

      <PartDetailInspectionBlock isNew={Boolean(currentProduct.is_new)} />

      <PartDetailReturnPolicyBlock isNew={Boolean(currentProduct.is_new)} />

      <PartDetailFaqBlock
        brand={partBrand}
        article={partArticle}
        partTypeName={partTypeName}
        isNew={Boolean(currentProduct.is_new)}
        city={productCity}
        fitmentText={fitmentText}
        inStock={inStock}
        items={faqItems}
      />
        </div>
      </div>

      {/* Media Modal */}
      <MediaModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        mediaItems={mediaItems}
        initialIndex={initialMediaIndex}
      />

      {/* Phone Modal */}
      {isPhoneModalOpen && sellerOrg?.phone && (
        <div
          className="fixed inset-0 z-[60] flex items-end justify-center bg-black/40 p-4 sm:items-center"
          onClick={handleClosePhoneModal}
          role="dialog"
          aria-modal="true"
          aria-labelledby="part-phone-modal-title"
        >
          <div
            className="w-full max-w-sm overflow-hidden rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-indigo-100 bg-indigo-50/70 px-5 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 id="part-phone-modal-title" className="text-base font-semibold text-gray-900">
                    Позвонить продавцу
                  </h3>
                  {sellerOrg?.name ? (
                    <p className="mt-0.5 truncate text-sm text-gray-600">{sellerOrg.name}</p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={handleClosePhoneModal}
                  className="shrink-0 rounded-md p-1 text-gray-400 hover:bg-white/80 hover:text-gray-600"
                  aria-label="Закрыть"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            <div className="px-5 py-5">
              <p className="text-sm text-gray-500">Номер телефона</p>
              <p className="mt-1 text-2xl font-bold tracking-wide text-gray-900">
                {formatPhoneNumber(sellerOrg.phone)}
              </p>

              <div className="mt-5 flex flex-col gap-2">
                <a
                  href={`tel:${sellerOrg.phone.replace(/\D/g, '')}`}
                  className="flex items-center justify-center gap-2 rounded-lg bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700"
                >
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  Позвонить
                </a>
                <button
                  type="button"
                  onClick={handleClosePhoneModal}
                  className="rounded-lg py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  Отмена
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showMobileStickyCta ? (
        <div
          className="md:hidden fixed inset-x-0 z-[44] border-t border-gray-200 bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/90 shadow-[0_-6px_24px_rgba(0,0,0,0.08)]"
          style={{ bottom: 'calc(3.5rem + env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="mx-auto flex max-w-6xl gap-2">
            {canShowBuyNow ? (
              <button
                type="button"
                onClick={handleBuyNow}
                disabled={buyingNow}
                className={`min-h-11 flex-1 rounded-xl bg-indigo-50 px-3 text-sm font-semibold text-indigo-800 transition-colors hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-50 ${
                  !canShowWrite ? 'w-full' : ''
                }`}
              >
                {buyingNow ? '…' : 'Купить сейчас'}
              </button>
            ) : null}
            {canShowWrite ? (
              <button
                type="button"
                onClick={handleWriteToSeller}
                disabled={creatingChat}
                className={`min-h-11 flex-1 rounded-xl bg-indigo-600 px-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 ${
                  !canShowBuyNow ? 'w-full' : ''
                }`}
              >
                {creatingChat ? '…' : 'Написать'}
              </button>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default PartDetail;