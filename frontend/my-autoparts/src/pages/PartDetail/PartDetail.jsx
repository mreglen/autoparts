import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { Helmet } from 'react-helmet-async';
import { fetchPublicProduct, searchAllProducts } from '../../redux/slices/ProductSlice';
import { addUsedPartsToCart, removeUsedFromCart, updateUsedCartItemQuantity, selectCart, fetchCart } from '../../redux/slices/CartSlice';
import { createOrGetChat } from '../../redux/slices/ChatSlice';
import {
  normalizeImageUrl,
  apiAxiosUnauth,
  pickFullImageUrl,
  pickListImageUrlNormalized,
} from '../../utils/apiClient';
import ProgressiveProductImage from '../../components/ProductMedia/ProgressiveProductImage';
import { stripHtmlTags } from '../../utils/text';
import { buildChatsQueryUrl } from '../../utils/resolveActiveChatParams';
import { buildPartDetailPath, parsePartDetailParam, partDetailPathsMatch } from '../../utils/partRoutes';
import { extractProductDescription, formatProductDisplayTitle } from '../../utils/productDisplayName';
import { buildProductSeo, seoFromPartMetaResponse, buildProductStructuredDataBlocks, buildProductPhotoAlt, buildProductUsedCatalogPath } from '../../utils/productSeo';
import { buildProductFaqJsonLd } from '../../utils/partDetailFaq';
import { resolveProductCity } from '../../utils/productSearchSeo';
import { DEFAULT_OG_IMAGE_URL } from '../../utils/seoConstants';
import { buildBreadcrumbJsonLd, buildBreadcrumbsForPath } from '../../utils/breadcrumbs';
import MediaModal from '../../components/MediaModal/MediaModal';
import PartDetailSeoCrossLinks from './PartDetailSeoCrossLinks';
import PartDetailSpecsBlock from './PartDetailSpecsBlock';
import PartDetailDesktopGallery from './PartDetailDesktopGallery';
import PartDetailOrganizationSidebar from './PartDetailOrganizationSidebar';
import PartDetailPurchaseSidebar from './PartDetailPurchaseSidebar';
import PartDetailFitmentBlock from './PartDetailFitmentBlock';
import PartDetailLocationBlock from './PartDetailLocationBlock';
import PartDetailTrustRow from './PartDetailTrustRow';
import PartDetailReturnPolicyBlock from './PartDetailReturnPolicyBlock';
import PartArticleMatchesBlock from '../../components/PartArticleMatchesBlock/PartArticleMatchesBlock';
import ShareButton from '../../components/ShareButton/ShareButton';
import FavoriteButton from '../../components/FavoriteButton/FavoriteButton';
import Breadcrumbs from '../../components/Breadcrumbs/Breadcrumbs';
import { trackConversion, CONVERSION_EVENTS } from '../../utils/siteAnalytics';
import useHistoryBack from '../../hooks/useHistoryBack';
import useDeferredMount from '../../hooks/useDeferredMount';
import { recordProductView } from '../../redux/slices/UserEngagementSlice';
import {
  PART_DETAIL_CACHE,
  readPartDetailCache,
  writePartDetailCache,
} from '../../utils/partDetailCache';
import { useProductPriceFormat } from '../../hooks/useProductPriceFormat';
import { getUsedPurchaseActions } from '../../utils/usedPurchaseMode';
import { mapLaximoApplicableVehicles } from '../../utils/fitmentDisplay';
import { Badge, Button, EmptyState, Modal, SkeletonCard } from '../../components/UI';
import ProductDetailStickyBar from '../../components/ProductDetail/ProductDetailStickyBar';
import { MOBILE_PRODUCT_STICKY_SCROLL_PAD } from '../../constants/mobileTokens';

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
  const [fitmentMeta, setFitmentMeta] = useState(null);
  const [soldOutAlternates, setSoldOutAlternates] = useState([]);
  const [soldOutAlternatesLoading, setSoldOutAlternatesLoading] = useState(false);
  const [soldOutResolved, setSoldOutResolved] = useState(null);
  const [soldOutResolveState, setSoldOutResolveState] = useState('idle');
  const fetchedProductIdRef = useRef(null);
  const searchedBrandArticleRef = useRef(null);
  const trackedPartViewRef = useRef(null);
  const recordedEngagementViewRef = useRef(null);
  const canonicalRedirectRef = useRef(null);
  const mobileGalleryTouchStartX = useRef(null);

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
  const { enabled: secondaryEnabled } = useDeferredMount({
    mode: 'idle',
    active: showProduct,
    idleTimeoutMs: 1200,
  });

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
    if (!showProduct || !secondaryEnabled || !displayProduct?.brand || !displayProduct?.article) {
      if (!showProduct) {
        setAlternateOffers([]);
        setAlternateOffersError('');
      }
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
  }, [showProduct, secondaryEnabled, displayProduct?.id, displayProduct?.brand, displayProduct?.article]);

  useEffect(() => {
    if (!showProduct || !secondaryEnabled || !displayProduct?.brand || !displayProduct?.article) {
      if (!showProduct) {
        setReferenceFitment([]);
        setFitmentMeta(null);
      }
      return undefined;
    }

    let cancelled = false;
    const fitmentKey = `${displayProduct.brand}|${displayProduct.article}|${displayProduct.id}`;
    const cachedFitment = readPartDetailCache(PART_DETAIL_CACHE.referenceFitment, fitmentKey);
    if (cachedFitment) {
      setReferenceFitment(cachedFitment);
      setFitmentMeta({ checked: true });
      setReferenceFitmentLoading(false);
      return undefined;
    }

    const run = async () => {
      setReferenceFitmentLoading(true);
      try {
        const [refResponse, laximoResponse] = await Promise.all([
          apiAxiosUnauth.get('/public/part-reference-fitment', {
            params: {
              brand: displayProduct.brand,
              article: displayProduct.article,
              exclude_product_id: displayProduct.id,
            },
          }),
          apiAxiosUnauth
            .post('/public/laximo/oem/applicable-vehicles', {
              oem: displayProduct.article,
              brand: displayProduct.brand,
            })
            .catch(() => null),
        ]);
        const vehicles = Array.isArray(refResponse?.data?.vehicles)
          ? refResponse.data.vehicles
          : [];
        const laximoData = laximoResponse?.data;
        const laximoOk = laximoData?.ok !== false;
        const laximoRows = laximoOk
          ? mapLaximoApplicableVehicles(laximoData?.vehicles)
          : [];
        const merged = [...vehicles, ...laximoRows];
        if (!cancelled) {
          writePartDetailCache(PART_DETAIL_CACHE.referenceFitment, fitmentKey, merged);
          setReferenceFitment(merged);
          setFitmentMeta({
            checked: true,
            laximoOk,
            coverage: laximoData?.coverage || (laximoRows.length ? 'full' : 'none'),
            dataSource: laximoData?.data_source || (laximoRows.length ? 'laximo' : 'none'),
            fitmentStatus: laximoData?.fitment_status || null,
          });
        }
      } catch (_error) {
        if (!cancelled) {
          setReferenceFitment([]);
          setFitmentMeta({ checked: true, laximoOk: false, coverage: 'none' });
        }
      } finally {
        if (!cancelled) setReferenceFitmentLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [showProduct, secondaryEnabled, displayProduct?.id, displayProduct?.brand, displayProduct?.article]);

  useEffect(() => {
    if (showProduct || !error) {
      setSoldOutResolved(null);
      setSoldOutResolveState('idle');
      return undefined;
    }
    if (!resolvedProductId || (extractedBrand && extractedArticle)) {
      return undefined;
    }

    let cancelled = false;
    const run = async () => {
      setSoldOutResolveState('loading');
      try {
        const response = await apiAxiosUnauth.get(`/products/public/resolve/${resolvedProductId}`);
        const data = response?.data;
        if (!cancelled) {
          if (data && data.in_stock === false) {
            setSoldOutResolved({
              id: data.id,
              brand: data.brand,
              article: data.article,
            });
          } else {
            setSoldOutResolved(null);
          }
          setSoldOutResolveState('done');
        }
      } catch (_err) {
        if (!cancelled) {
          setSoldOutResolved(null);
          setSoldOutResolveState('done');
        }
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [showProduct, error, resolvedProductId, extractedBrand, extractedArticle]);

  useEffect(() => {
    if (showProduct || !error) {
      setSoldOutAlternates([]);
      return undefined;
    }

    const brandSource = soldOutResolved?.brand || extractedBrand;
    const articleSource = soldOutResolved?.article || extractedArticle;
    if (!brandSource || !articleSource) return undefined;

    let cancelled = false;
    const run = async () => {
      setSoldOutAlternatesLoading(true);
      try {
        const decodedBrand = decodeURIComponent(brandSource);
        const decodedArticle = decodeURIComponent(articleSource);
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
  }, [showProduct, error, extractedBrand, extractedArticle, soldOutResolved?.brand, soldOutResolved?.article]);

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

  // Preload first photo thumb for faster LCP on /part/
  useEffect(() => {
    if (!showProduct || !currentProduct?.photos?.length) return undefined;
    const first = currentProduct.photos[0];
    if (isVideo(first)) return undefined;
    const href = pickListImageUrlNormalized(first);
    if (!href) return undefined;
    const link = document.createElement('link');
    link.rel = 'preload';
    link.as = 'image';
    link.href = href;
    document.head.appendChild(link);
    return () => {
      if (link.parentNode) link.parentNode.removeChild(link);
    };
  }, [showProduct, currentProduct?.id, currentProduct?.photos]);

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
      navigate(buildChatsQueryUrl({ chatId: result.id, source: 'garage' }));
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
    }
    return pickFullImageUrl(item) || item?.photo_url || '';
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
    const soldOutBrand = soldOutResolved?.brand
      || (extractedBrand ? decodeURIComponent(extractedBrand) : '');
    const soldOutArticle = soldOutResolved?.article
      || (extractedArticle ? decodeURIComponent(extractedArticle) : '');
    const soldOutLabel = [soldOutBrand, soldOutArticle].filter(Boolean).join(' ');
    const catalogPath = buildProductUsedCatalogPath({ brand: soldOutBrand, article: soldOutArticle });

    if (!soldOutLabel && soldOutResolveState === 'loading') {
      return (
        <div className="px-4 py-10 md:px-0">
          <SkeletonCard lines={4} className="shadow-none" />
        </div>
      );
    }

    if (soldOutLabel) {
      return (
        <div className="px-4 py-6 md:px-0">
          <Helmet>
            <title>{soldOutLabel} — продано | Свой Гараж</title>
            <meta name="robots" content="noindex, follow" />
          </Helmet>
          <Breadcrumbs
            items={[
              { label: 'Главная', href: '/' },
              { label: 'Б/у запчасти', href: '/autoparts/used' },
              { label: soldOutLabel },
            ]}
            includeJsonLd={false}
          />
          <section className="mt-4">
            <p className="text-sm font-semibold text-warning-700">Продано</p>
            <h1 className="mt-1 text-2xl font-bold text-ink">{soldOutLabel}</h1>
            <p className="mt-2 text-sm text-ink-muted">
              Это предложение уже недоступно. Посмотрите другие варианты с тем же артикулом.
            </p>
            <Button className="mt-4" onClick={() => navigate(catalogPath)}>
              Каталог по артикулу
            </Button>
          </section>
          <div className="mt-6">
            <PartArticleMatchesBlock
              title={`Другие предложения ${soldOutLabel}`}
              items={soldOutAlternates}
              loading={soldOutAlternatesLoading}
              error={soldOutAlternates.length ? '' : 'Других предложений не найдено'}
            />
          </div>
        </div>
      );
    }

    return (
      <div className="px-4 py-10 md:px-0">
        <Helmet>
          <title>Запчасть не найдена | Свой Гараж</title>
          <meta name="robots" content="noindex, nofollow" />
        </Helmet>
        <EmptyState
          illustration="error"
          title="Запчасть не найдена"
          description={formatErrorText(error)}
          actionLabel="Назад"
          onAction={handleBackToList}
          className="border-solid"
        />
      </div>
    );
  }

  if (!showProduct) {
    return (
      <div className="px-4 py-10 md:px-0">
        {apiSeo ? <PartProductSeoHelmet seo={apiSeo} structuredDataBlocks={null} product={null} /> : null}
        <SkeletonCard lines={5} className="shadow-none" />
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
  const inStock = (currentProduct.quantity || 0) > 0;
  const h1Primary = apiSeo?.h1
    || [partBrand, partArticle].filter(Boolean).join(' ')
    || formatProductDisplayTitle(partBrand, partArticle, currentProduct.name);
  const h1Subtitle = extractProductDescription(
    currentProduct.name,
    partBrand,
    partArticle,
  );
  const faqJsonLd = seo.faqJsonLd || buildProductFaqJsonLd({
    canonicalUrl: seo.canonicalUrl,
    brand: partBrand,
    article: partArticle,
    partTypeName: seo.partTypeName || h1Subtitle || currentProduct.part_type?.name,
    isNew: Boolean(currentProduct.is_new),
    city: resolveProductCity(currentProduct.organization),
    fitmentText: seo.fitmentText,
    inStock,
    quantity: currentProduct.quantity,
    price: currentProduct.price,
  });
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
  const mobileHeroItem = allMediaItems[currentMainMediaIndex];
  const mobileHeroIsVideo = Boolean(mobileHeroItem && isVideo(mobileHeroItem));
  const sellerPhoneDigits = sellerOrg?.phone ? sellerOrg.phone.replace(/\D/g, '') : '';

  const goToPreviousMedia = () => {
    setCurrentMainMediaIndex((prev) => (prev > 0 ? prev - 1 : allMediaItems.length - 1));
  };

  const goToNextMedia = () => {
    setCurrentMainMediaIndex((prev) => (prev < allMediaItems.length - 1 ? prev + 1 : 0));
  };

  const handleMobileGalleryTouchStart = (event) => {
    mobileGalleryTouchStartX.current = event.touches?.[0]?.clientX ?? null;
  };

  const handleMobileGalleryTouchEnd = (event) => {
    const startX = mobileGalleryTouchStartX.current;
    mobileGalleryTouchStartX.current = null;
    if (startX == null || allMediaItems.length <= 1) return;
    const endX = event.changedTouches?.[0]?.clientX;
    if (endX == null) return;
    const delta = endX - startX;
    if (Math.abs(delta) < 40) return;
    if (delta > 0) {
      goToPreviousMedia();
    } else {
      goToNextMedia();
    }
  };

  const renderMediaThumbnails = (className = '') => {
    if (allMediaItems.length <= 1) return null;
    return (
      <div className={`grid grid-cols-4 gap-2 sm:grid-cols-5 md:grid-cols-4 lg:grid-cols-5 ${className}`}>
        {allMediaItems.map((item, index) => {
          const isVideoItem = isVideo(item);

          return (
            <div
              key={index}
              className={`relative aspect-square cursor-pointer overflow-hidden rounded-md border bg-surface-muted ${
                currentMainMediaIndex === index
                  ? 'border-brand-500'
                  : 'border-line hover:border-line-strong'
              }`}
              onClick={() => setCurrentMainMediaIndex(index)}
            >
              {isVideoItem ? (
                <>
                  <video
                    src={normalizeImageUrl(getMediaUrl(item))}
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
                <ProgressiveProductImage
                  photo={item}
                  alt={buildProductPhotoAlt({
                    brand: partBrand,
                    article: partArticle,
                    name: currentProduct.name,
                    index,
                  })}
                  className="h-full w-full object-cover"
                  upgradeToFull={false}
                  width={96}
                  height={96}
                  sizes="96px"
                />
              )}
            </div>
          );
        })}
      </div>
    );
  };

  const renderProductBadges = () => (
    <div className="flex flex-wrap items-center gap-2">
      <Badge>{currentProduct.brand || '—'}</Badge>
      <Badge>Арт. {currentProduct.article || '—'}</Badge>
      <Badge tone={currentProduct.is_new ? 'success' : 'accent'}>
        {currentProduct.is_new ? 'Новая' : 'Б/у'}
      </Badge>
      {inStock ? <Badge tone="success">В наличии</Badge> : null}
    </div>
  );

  const renderProductTitle = () => (
    <>
      <h1 className="text-xl font-bold leading-snug text-ink md:text-[1.65rem]">{h1Primary}</h1>
      {h1Subtitle ? (
        <p className="mt-1 text-base font-medium text-ink-muted">{h1Subtitle}</p>
      ) : null}
    </>
  );

  const renderSeoCrossLinks = () => (
    <PartDetailSeoCrossLinks
      brand={partBrand}
      article={partArticle}
      isNew={Boolean(currentProduct.is_new)}
      organizationId={sellerOrg?.id}
      organizationName={sellerOrg?.name}
      usedCatalogPath={seo.usedCatalogPath}
      deferEnabled={secondaryEnabled}
    />
  );

  const renderSellerDescription = () => (
    currentProduct.description ? (
      <section>
        <h2 className="text-base font-semibold text-ink">Описание от продавца</h2>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft whitespace-pre-line">
          {stripHtmlTags(currentProduct.description)}
        </p>
      </section>
    ) : null
  );

  const renderPurchaseSidebar = () => (
    <PartDetailPurchaseSidebar
      product={currentProduct}
      inStock={inStock}
      formatPrice={formatProductPriceDisplay}
      showCart={showCart}
      cartQuantity={getCartQuantity(currentProduct.id)}
      stockNoStock={stockInfo.noStock}
      isAdding={addingToCartId === currentProduct.id}
      buyingNow={buyingNow}
      canShowBuyNow={canShowBuyNow}
      onAddToCart={() => handleAddToCart(currentProduct)}
      onRemoveFromCart={() => handleRemoveFromCart(currentProduct)}
      onBuyNow={handleBuyNow}
    />
  );

  const renderOrganizationSidebar = () => (
    <PartDetailOrganizationSidebar
      organization={sellerOrg}
      logoUrl={sellerLogoUrl}
      showSellerContact={showSellerContact}
      onPhoneClick={handleOpenPhoneModal}
      onWriteClick={handleWriteToSeller}
      creatingChat={creatingChat}
    />
  );

  return (
    <div className={showMobileStickyCta ? MOBILE_PRODUCT_STICKY_SCROLL_PAD : undefined}>
      <PartProductSeoHelmet seo={seo} structuredDataBlocks={structuredDataBlocks} product={currentProduct} />

      <div className="relative bg-surface-subtle md:hidden">
        {allMediaItems.length > 0 ? (
          <div
            className="relative min-h-[52dvh] max-h-[62dvh] cursor-pointer"
            onClick={() => handleOpenMediaModal(currentMainMediaIndex)}
            onTouchStart={handleMobileGalleryTouchStart}
            onTouchEnd={handleMobileGalleryTouchEnd}
          >
            {mobileHeroIsVideo ? (
              <div className="relative min-h-[52dvh] max-h-[62dvh]">
                <video
                  src={normalizeImageUrl(getMediaUrl(mobileHeroItem))}
                  className="h-full min-h-[52dvh] max-h-[62dvh] w-full object-contain"
                  muted
                  playsInline
                  preload="metadata"
                />
                <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/20">
                  <div className="rounded-full bg-surface/90 p-3">
                    <svg className="ml-0.5 h-8 w-8 text-brand-600" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
                    </svg>
                  </div>
                </div>
              </div>
            ) : (
              <ProgressiveProductImage
                key={currentMainMediaIndex}
                photo={mobileHeroItem}
                alt={photoAltMain}
                className="h-full min-h-[52dvh] max-h-[62dvh] w-full object-contain"
                priority
                upgradeToFull
                sizes="100vw"
              />
            )}

            {allMediaItems.length > 1 ? (
              <>
                <button
                  type="button"
                  className="absolute left-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-ink-soft shadow-sg-sm backdrop-blur"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToPreviousMedia();
                  }}
                  aria-label="Предыдущее фото"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                </button>
                <button
                  type="button"
                  className="absolute right-2 top-1/2 z-10 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-surface/80 text-ink-soft shadow-sg-sm backdrop-blur"
                  onClick={(e) => {
                    e.stopPropagation();
                    goToNextMedia();
                  }}
                  aria-label="Следующее фото"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                  </svg>
                </button>
                <div
                  className="absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white"
                  aria-live="polite"
                >
                  {currentMainMediaIndex + 1}/{allMediaItems.length}
                </div>
              </>
            ) : null}
          </div>
        ) : (
          <div className="flex min-h-[52dvh] items-center justify-center">
            <p className="text-sm text-ink-faint">Нет фотографий</p>
          </div>
        )}

        <div className="pointer-events-none absolute inset-x-0 top-0 z-20 flex items-start justify-between px-3 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={handleBackToList}
            className="pointer-events-auto flex h-11 w-11 items-center justify-center rounded-full bg-surface/80 text-ink-soft shadow-sg-sm backdrop-blur"
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
              className="h-11 w-11 min-h-11 rounded-full border-0 bg-surface/80 p-0 shadow-sg-sm backdrop-blur"
            />
            <ShareButton
              url={seo.canonicalUrl}
              title={h1Primary}
              text={shareText}
              showLabel={false}
              size="sm"
              className="h-11 w-11 min-h-11 rounded-full border-0 bg-surface/80 p-0 shadow-sg-sm backdrop-blur"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pb-8 pt-3 md:px-0">
        <Breadcrumbs items={breadcrumbItems} includeJsonLd={false} />
        <div className="mt-2 hidden flex-wrap items-center gap-2 md:flex">
          <Button variant="ghost" size="sm" onClick={handleBackToList} className="-ml-2">
            ← К списку
          </Button>
          <FavoriteButton
            productId={currentProduct.id}
            size="sm"
            showLabel={false}
            className="h-9 w-9 min-h-0 gap-0 rounded-sg border border-line p-0"
          />
          <ShareButton
            url={seo.canonicalUrl}
            title={h1Primary}
            text={shareText}
            showLabel={false}
            size="sm"
            className="h-9 w-9 min-h-0 gap-0 rounded-sg border border-line p-0"
          />
        </div>

        <div className="mt-4 grid grid-cols-1 items-start gap-6 lg:grid-cols-12 lg:gap-8 xl:gap-10">
          <div className="hidden min-w-0 overflow-hidden md:block lg:col-span-5">
            <PartDetailDesktopGallery
              items={allMediaItems}
              currentIndex={currentMainMediaIndex}
              onIndexChange={setCurrentMainMediaIndex}
              onOpenModal={handleOpenMediaModal}
              brand={partBrand}
              article={partArticle}
              name={currentProduct.name}
              mainAlt={photoAltMain}
            />
          </div>

          <div className="min-w-0 lg:col-span-4">
            {renderProductTitle()}
            <div className="mt-3">{renderProductBadges()}</div>
            {renderSeoCrossLinks()}
            <div className="mt-4 md:hidden">{renderMediaThumbnails()}</div>
            <div className="mt-4 lg:hidden">{renderPurchaseSidebar()}</div>
            <PartDetailSpecsBlock product={currentProduct} variant="inline" />
            {currentProduct.description ? <div className="mt-5">{renderSellerDescription()}</div> : null}
            <div className="mt-5 lg:hidden">{renderOrganizationSidebar()}</div>
          </div>

          <aside className="hidden min-w-0 space-y-5 lg:sticky lg:top-4 lg:col-span-3 lg:block">
            {renderPurchaseSidebar()}
            {renderOrganizationSidebar()}
          </aside>
        </div>

        <div className="mt-8 border-t border-line pt-6">
          <PartDetailTrustRow />
        </div>

        <div className="mt-8 space-y-6 md:mt-10">
          <PartDetailLocationBlock storageLocation={currentProduct.storage_location} />
          <PartDetailFitmentBlock
            sellerVehicles={currentProduct.compatible_vehicles}
            referenceVehicles={referenceFitment}
            loading={secondaryEnabled ? referenceFitmentLoading : true}
            fitmentMeta={fitmentMeta}
          />
          <PartArticleMatchesBlock
            title={alternateOffersTitle}
            items={alternateOffers}
            loading={secondaryEnabled ? alternateOffersLoading : true}
            error={alternateOffersError}
            currentProductId={currentProduct.id}
          />
          {secondaryEnabled ? (
            <PartDetailReturnPolicyBlock isNew={Boolean(currentProduct.is_new)} />
          ) : null}
        </div>
      </div>

      <MediaModal
        isOpen={isMediaModalOpen}
        onClose={() => setIsMediaModalOpen(false)}
        mediaItems={mediaItems}
        initialIndex={initialMediaIndex}
      />

      {sellerOrg?.phone ? (
        <Modal
          open={isPhoneModalOpen}
          onClose={handleClosePhoneModal}
          title="Позвонить продавцу"
          size="sm"
          footer={(
            <div className="flex flex-col gap-2">
              <Button as="a" href={`tel:${sellerPhoneDigits}`} className="w-full">
                Позвонить
              </Button>
              <Button variant="ghost" onClick={handleClosePhoneModal} className="w-full">
                Отмена
              </Button>
            </div>
          )}
        >
          {sellerOrg.name ? (
            <p className="text-sm text-ink-muted">{sellerOrg.name}</p>
          ) : null}
          <p className="mt-1 text-2xl font-bold tracking-wide text-ink">
            {formatPhoneNumber(sellerOrg.phone)}
          </p>
        </Modal>
      ) : null}

      {showMobileStickyCta ? (
        <ProductDetailStickyBar>
          <div className="flex gap-2">
            {canShowBuyNow ? (
              <Button
                variant="soft"
                size="lg"
                className="min-h-11 flex-1"
                onClick={handleBuyNow}
                disabled={buyingNow}
                loading={buyingNow}
              >
                Купить сейчас
              </Button>
            ) : null}
            {canShowWrite ? (
              <Button
                size="lg"
                className="min-h-11 flex-1"
                onClick={handleWriteToSeller}
                disabled={creatingChat}
                loading={creatingChat}
              >
                Написать
              </Button>
            ) : null}
          </div>
        </ProductDetailStickyBar>
      ) : null}
    </div>
  );
};

export default PartDetail;