import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useWindowVirtualizer } from '@tanstack/react-virtual';
import { useSelector, useDispatch } from 'react-redux';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { apiAxiosUnauth } from '../../../utils/apiClient';
import ProductCard from '../ProductCard';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';
import { buildPartDetailPath } from '../../../utils/partRoutes';
import UsedPartsFiltersForm from './UsedPartsFiltersForm';
import {
  fetchCatalogProducts,
  selectCatalogItems,
  selectCatalogTotal,
  selectCatalogPage,
  selectCatalogLoading,
  selectCatalogLoadingMore,
  selectCatalogHasMore,
  selectAnalogsLoading,
} from '../../../redux/slices/ProductSlice';
import { fetchStorageLocations, fetchOrganization } from '../../../redux/slices/OrganizationSlice';
import { buildListImageUrlFallbackChain } from '../../../utils/apiClient';
import {
  buildUsedCatalogParams,
  getUsedPartsUrlQuery,
  isUsedCatalogBrowseMode,
} from '../../../utils/autopartsPublic';
import { usedHasActiveFilters } from '../../../utils/autopartsFilters';

const selectUsedPartsData = (state) => state.products.usedPartsData;

const VIRTUALIZE_THRESHOLD = 48;
const GRID_ROW_ESTIMATE_PX = 380;
const LIST_ROW_ESTIMATE_PX = 220;

function getGridColumnCount(width) {
  if (width >= 1280) return 4;
  if (width >= 1024) return 3;
  return 2;
}

function chunkIntoRows(items, columns) {
  const rows = [];
  for (let i = 0; i < items.length; i += columns) {
    rows.push(items.slice(i, i + columns));
  }
  return rows;
}

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

const UsedPartsFiltersAside = React.memo(function UsedPartsFiltersAside({ updateCatalogUrl }) {
  return (
    <aside className="hidden w-full shrink-0 lg:block lg:w-64">
      <div className="rounded-lg border border-gray-200 bg-white p-4 lg:sticky lg:top-4">
        <h3 className="mb-3 font-semibold text-gray-900">Фильтры</h3>
        <UsedPartsFiltersForm updateCatalogUrl={updateCatalogUrl} deferApply showClearInPanel={false} />
      </div>
    </aside>
  );
});

const UsedPartsList = ({ viewMode = 'grid', sortBy = 'date', updateCatalogUrl }) => {
  const dispatch = useDispatch();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const catalogError = useSelector((state) => state.products.error);

  const usedPartsData = useSelector(selectUsedPartsData);
  const catalogItems = useSelector(selectCatalogItems);
  const catalogTotal = useSelector(selectCatalogTotal);
  const catalogPage = useSelector(selectCatalogPage);
  const urlQ = getUsedPartsUrlQuery(searchParams);
  const organizationFilterId = (searchParams.get('organization_id') || '').trim();
  const isCatalogMode = isUsedCatalogBrowseMode();
  const catalogLoading = useSelector(selectCatalogLoading);
  const catalogLoadingMore = useSelector(selectCatalogLoadingMore);
  const catalogHasMoreFromStore = useSelector(selectCatalogHasMore);
  const analogsLoading = useSelector(selectAnalogsLoading);
  const loadMoreSentinelRef = useRef(null);
  const catalogHasMore = isCatalogMode && catalogHasMoreFromStore;
  const { storageLocations, data: organization } = useSelector((state) => state.organization);
  const user = useSelector((state) => state.auth.user);
  const [organizationFilterName, setOrganizationFilterName] = useState('');

  useEffect(() => {
    if (!organizationFilterId) {
      setOrganizationFilterName('');
      return undefined;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxiosUnauth.get(`/public/organizations/${organizationFilterId}`);
        if (!cancelled) {
          setOrganizationFilterName((res.data?.name || '').trim());
          const name = (res.data?.name || '').trim();
          if (name) {
            sessionStorage.setItem(`org-bc-name:${organizationFilterId}`, name);
          }
        }
      } catch (_e) {
        if (!cancelled) setOrganizationFilterName('');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [organizationFilterId]);

  const availableParts = useMemo(() => catalogItems, [catalogItems]);

  const analogParts = useMemo(() => {
    if (!urlQ) return [];
    const catalogIds = new Set(catalogItems.map((p) => p.id));
    return (usedPartsData?.analog_parts || []).filter((p) => !catalogIds.has(p.id));
  }, [urlQ, usedPartsData, catalogItems]);

  const isInitialLoad = catalogLoading && catalogItems.length === 0;
  const isRefreshing = catalogLoading && catalogItems.length > 0;
  const status = isInitialLoad ? 'loading' : 'idle';

  const loadMoreCatalog = useCallback(() => {
    if (
      !isCatalogMode
      || catalogLoading
      || catalogLoadingMore
      || !catalogHasMoreFromStore
      || catalogItems.length >= catalogTotal
    ) {
      return;
    }
    dispatch(fetchCatalogProducts({
      ...buildUsedCatalogParams(searchParams, catalogPage + 1),
      append: true,
    }));
  }, [
    isCatalogMode,
    catalogLoading,
    catalogLoadingMore,
    catalogHasMoreFromStore,
    catalogItems.length,
    catalogTotal,
    dispatch,
    searchParams,
    catalogPage,
  ]);

  useEffect(() => {
    if (!isCatalogMode || !catalogHasMore || catalogLoading || catalogLoadingMore) {
      return undefined;
    }
    const sentinel = loadMoreSentinelRef.current;
    if (!sentinel) return undefined;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMoreCatalog();
        }
      },
      { root: null, rootMargin: '120px', threshold: 0 }
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isCatalogMode, catalogHasMore, catalogLoading, catalogLoadingMore, loadMoreCatalog]);

  const activeFilters = useMemo(() => ({
    partTypes: searchParams.getAll('part_type'),
    brands: searchParams.getAll('brand'),
    priceMin: searchParams.get('vmin') || '',
    priceMax: searchParams.get('vmax') || '',
    vehicleBrands: searchParams.getAll('vb'),
    vehicleModels: searchParams.getAll('vm'),
    hasPhotos: searchParams.get('has_photos') === '1',
  }), [searchParams]);

  const matchesActiveFilters = useCallback((part) => {
    if (
      activeFilters.partTypes.length > 0
      && !activeFilters.partTypes.includes(String(part.part_type_id || part.part_type?.id || ''))
    ) {
      return false;
    }
    if (activeFilters.brands.length > 0 && !activeFilters.brands.includes(part.brand)) {
      return false;
    }

    const price = parseFloat(part.price || 0);
    if (activeFilters.priceMin && price < parseFloat(activeFilters.priceMin)) {
      return false;
    }
    if (activeFilters.priceMax && price > parseFloat(activeFilters.priceMax)) {
      return false;
    }
    if (activeFilters.hasPhotos && !(part.photos || []).length) {
      return false;
    }

    const vehicles = part.compatible_vehicles || [];
    if (
      activeFilters.vehicleBrands.length > 0
      && !vehicles.some((vehicle) => activeFilters.vehicleBrands.includes(vehicle.brand))
    ) {
      return false;
    }
    if (
      activeFilters.vehicleModels.length > 0
      && !vehicles.some((vehicle) => activeFilters.vehicleModels.includes(vehicle.model))
    ) {
      return false;
    }

    return true;
  }, [activeFilters]);

  // Sort parts based on selected option
  const sortedAvailableParts = useMemo(() => {
    let sorted = isCatalogMode
      ? [...availableParts]
      : availableParts.filter(matchesActiveFilters);
    
    if (isCatalogMode) {
      return sorted;
    }

    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'date') {
      // Sort by date (ascending - oldest first)
      sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }
    
    return sorted;
  }, [availableParts, sortBy, isCatalogMode, matchesActiveFilters]);
  
  const sortedAnalogParts = useMemo(() => {
    let sorted = isCatalogMode
      ? [...analogParts]
      : analogParts.filter(matchesActiveFilters);
    
    if (sortBy === 'price_asc') {
      sorted.sort((a, b) => (a.price || 0) - (b.price || 0));
    } else if (sortBy === 'price_desc') {
      sorted.sort((a, b) => (b.price || 0) - (a.price || 0));
    } else if (sortBy === 'date') {
      // Sort by date (ascending - oldest first)
      sorted.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
    }
    
    return sorted;
  }, [analogParts, sortBy, isCatalogMode, matchesActiveFilters]);

  const [gridColumns, setGridColumns] = useState(() => getGridColumnCount(
    typeof window !== 'undefined' ? window.innerWidth : 1024
  ));

  useEffect(() => {
    const onResize = () => setGridColumns(getGridColumnCount(window.innerWidth));
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const shouldVirtualize = sortedAvailableParts.length > VIRTUALIZE_THRESHOLD;
  const gridRows = useMemo(
    () => chunkIntoRows(sortedAvailableParts, gridColumns),
    [sortedAvailableParts, gridColumns]
  );

  const gridRowVirtualizer = useWindowVirtualizer({
    count: shouldVirtualize && viewMode === 'grid' ? gridRows.length : 0,
    estimateSize: () => GRID_ROW_ESTIMATE_PX,
    overscan: 2,
  });

  const listRowVirtualizer = useWindowVirtualizer({
    count: shouldVirtualize && viewMode === 'list' ? sortedAvailableParts.length : 0,
    estimateSize: () => LIST_ROW_ESTIMATE_PX,
    overscan: 3,
  });

  const buildProductCardPart = useCallback((part) => ({
    id: part.id,
    title: formatProductDisplayTitle(part.brand, part.article, part.name),
    price: part.price ? `${part.price} ₽` : '—',
    originalPrice: null,
    discount: null,
    brand: part.brand || '—',
    article: part.article || '—',
    location: part.storage_location?.address || '—',
    description: part.description || '',
    sellerName: organization?.name || part.organization?.name || 'Продавец',
    rating: 4.7,
    reviewCount: 152,
    isDiscount: false,
    isNew: part.is_new,
    quantity: part.quantity || part.available_count || 0,
    sellerReliable: true,
    sellerVerified: true,
    photos: part.photos || [],
    videos: part.videos || [],
    image: (part.photos && part.photos.length > 0)
      ? (part.photos[0].full_url || part.photos[0].photo_url || part.photos[0])
      : '/api/placeholder/200/200',
    sellerLogo: organization?.name?.substring(0, 4).toUpperCase() || 'SELL',
    phone: organization?.phone || part.organization?.phone || '+7 (999) 123-45-67',
  }), [organization]);
  
  useEffect(() => {
    // Загружаем информацию об организации только для авторизованных продавцов и сотрудников
    if ((user?.is_seller || user?.is_employee) && user.organization_id) {
      dispatch(fetchStorageLocations(user.organization_id));
      dispatch(fetchOrganization(user.organization_id));
    }
  }, [dispatch, user]);

  const getStorageAddress = (locationId, partStorageLocation) => {
    if (partStorageLocation?.address) return partStorageLocation.address;
    if (!locationId) return '—';
    const loc = storageLocations.find(l => l.id === locationId);
    return loc ? (loc.address || `Склад #${locationId}`) : `Склад #${locationId}`;
  };

  // Component for displaying media with navigation
  const MediaDisplay = ({ part }) => {
    const [currentMediaIndex, setCurrentMediaIndex] = useState(0);
    const [hoverSide, setHoverSide] = useState(null);
    const [resolvedUrl, setResolvedUrl] = useState('');
    const [urlFallbackIndex, setUrlFallbackIndex] = useState(0);

    // Combine photos and videos
    const allMedia = React.useMemo(() => {
      const photos = (part.photos || []).slice(0, 1).map((photo) => {
        const urlChain = buildListImageUrlFallbackChain(photo);
        return {
          type: 'photo',
          url: urlChain[0] || '',
          urlChain,
          photo,
        };
      });
      if (photos.length > 0) {
        return photos;
      }
      if ((part.videos || []).length > 0) {
        return [{ type: 'video', url: null }];
      }
      return [];
    }, [part.photos, part.videos]);

    React.useEffect(() => {
      setResolvedUrl(allMedia[currentMediaIndex]?.url || '');
      setUrlFallbackIndex(0);
    }, [allMedia, currentMediaIndex]);

    if (!allMedia || allMedia.length === 0) {
      return (
        <div className="w-full h-full flex items-center justify-center">
          <svg className="w-16 h-16 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        </div>
      );
    }

    const currentMedia = allMedia[currentMediaIndex];
    const isVideo = currentMedia.type === 'video';

    const goToPrevious = () => {
      setCurrentMediaIndex(prev => prev > 0 ? prev - 1 : allMedia.length - 1);
    };

    const goToNext = () => {
      setCurrentMediaIndex(prev => prev < allMedia.length - 1 ? prev + 1 : 0);
    };

    return (
      <div className="relative w-full h-full group">
        {/* Navigation arrows */}
        {allMedia.length > 1 && (
          <>
            {/* Left arrow */}
            <button
              className={`absolute left-0 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-r-md transition-opacity duration-200 ${hoverSide === 'left' ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                goToPrevious();
              }}
              onMouseEnter={() => setHoverSide('left')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            {/* Right arrow */}
            <button
              className={`absolute right-0 top-1/2 transform -translate-y-1/2 z-20 bg-black bg-opacity-50 hover:bg-opacity-75 text-white p-2 rounded-l-md transition-opacity duration-200 ${hoverSide === 'right' ? 'opacity-100' : 'opacity-0 hover:opacity-100'}`}
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                goToNext();
              }}
              onMouseEnter={() => setHoverSide('right')}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </>
        )}

        {/* Media content */}
        {isVideo ? (
          <video
            src={currentMedia.url}
            className="w-full h-full object-cover rounded-lg"
            muted
            playsInline
          />
        ) : (
          <img
            src={resolvedUrl || currentMedia.url}
            alt={part.name || part.article}
            className="w-full h-full object-cover rounded-lg"
            loading="lazy"
            decoding="async"
            onError={() => {
              const chain = currentMedia.urlChain || [];
              const nextIndex = urlFallbackIndex + 1;
              if (nextIndex < chain.length && chain[nextIndex] !== resolvedUrl) {
                setUrlFallbackIndex(nextIndex);
                setResolvedUrl(chain[nextIndex]);
              }
            }}
          />
        )}

        {/* Video indicator overlay */}
        {isVideo && (
          <div className="absolute inset-0 flex items-center justify-center bg-black bg-opacity-30 rounded-lg pointer-events-none">
            <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" />
            </svg>
          </div>
        )}

        {/* Media counter */}
        {allMedia.length > 1 && (
          <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
            {currentMediaIndex + 1} / {allMedia.length}
          </div>
        )}
      </div>
    );
  };

  const renderPartListCard = (part, listKey) => {
    const availableQty = part.quantity || part.available_count || 0;
    const sellerOrg = part.organization || organization;
    const detailPath = buildPartDetailPath(part);
    return (
      <article
        key={listKey}
        className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm transition-shadow hover:shadow-md"
      >
        <Link
          to={detailPath}
          className="block text-inherit no-underline"
        >
          <div className="flex flex-row gap-3 p-3 sm:gap-4 sm:p-4">
            <div className="relative h-24 w-24 shrink-0 overflow-hidden rounded-lg bg-gray-100 sm:h-40 sm:w-40 lg:h-44 lg:w-44">
              <MediaDisplay part={part} />
            </div>
            <div className="flex min-w-0 flex-1 flex-col gap-2">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                <div className="min-w-0 flex-1">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-gray-900 hover:text-indigo-700 sm:text-base sm:leading-normal lg:text-lg">
                    {formatProductDisplayTitle(part.brand, part.article, part.name)}
                  </h3>
                  <p className="mt-0.5 text-xs text-gray-500 sm:text-sm">
                    Артикул: <span className="font-medium text-gray-700">{part.article || '—'}</span>
                  </p>
                </div>
                <div className="shrink-0 text-base font-bold text-indigo-600 sm:text-right sm:text-xl lg:text-2xl">
                  {part.price ? `${Number(part.price).toLocaleString('ru-RU')} ₽` : '—'}
                </div>
              </div>
              {part.description ? (
                <p className="line-clamp-2 text-xs text-gray-600 sm:text-sm">{part.description}</p>
              ) : null}
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 sm:text-sm">
                <div className="flex min-w-0 max-w-full items-start gap-1">
                  <svg className="mt-0.5 h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  </svg>
                  <span className="min-w-0 break-words">{getStorageAddress(part.storage_location_id, part.storage_location)}</span>
                </div>
                <div className="flex items-center gap-1">
                  <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className={availableQty > 0 ? 'font-medium text-green-600' : 'font-medium text-red-600'}>
                    {availableQty > 0 ? `В наличии: ${availableQty} шт.` : 'Нет в наличии'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-slate-50/80 px-3 py-2.5 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xs font-bold text-white">
              {(sellerOrg?.name || 'Продавец').substring(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-gray-900">{sellerOrg?.name || 'Продавец'}</p>
              {sellerOrg?.contact_person ? (
                <p className="truncate text-xs text-gray-600">{sellerOrg.contact_person}</p>
              ) : null}
            </div>
          </div>
          {sellerOrg?.phone ? (
            <a
              href={`tel:${sellerOrg.phone.replace(/\D/g, '')}`}
              className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-lg bg-amber-500 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-amber-600"
            >
              <svg className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span className="hidden sm:inline">{formatPhoneNumber(sellerOrg.phone)}</span>
              <span className="sm:hidden">Позвонить</span>
            </a>
          ) : null}
        </div>
      </article>
    );
  };




  const hasAvailableParts = sortedAvailableParts.length > 0;
  const hasAnalogParts = sortedAnalogParts.length > 0;
  const visibleTotal = isCatalogMode ? catalogTotal : sortedAvailableParts.length + sortedAnalogParts.length;

  return (
    <div className="mt-0 w-full px-0 max-md:pb-2">
      <h1 className="sr-only">
        {urlQ ? `Б/у запчасти: ${urlQ}` : 'Б/у автозапчасти'}
      </h1>
      {organizationFilterId ? (
        <div className="mb-3 mx-3 sm:mx-0 rounded-2xl border border-indigo-100 bg-indigo-50/80 px-4 py-3 text-sm text-indigo-900">
          <span>
            Показаны запчасти продавца
            {organizationFilterName ? ` «${organizationFilterName}»` : ''}
          </span>
          {' '}
          <Link to="/autoparts/used" className="font-semibold underline hover:text-indigo-700">
            Весь каталог
          </Link>
        </div>
      ) : null}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 px-3 sm:px-0">
        <p className="text-sm text-gray-600">Найдено: <span className="font-semibold text-gray-900">{visibleTotal}</span></p>
        <Link
          to={{ pathname: '/autoparts/used/filters', search: location.search }}
          className="rounded-full bg-gray-200 px-3 py-1.5 text-sm font-medium text-gray-800 lg:hidden"
        >
          Фильтры
        </Link>
      </div>
      <div className="flex flex-col gap-4 px-3 sm:gap-6 sm:px-0 lg:flex-row lg:items-start">
        <UsedPartsFiltersAside updateCatalogUrl={updateCatalogUrl} />
        <div className="relative min-w-0 flex-1">
          {isRefreshing ? (
            <div
              className="pointer-events-none absolute inset-0 z-10 flex justify-center rounded-lg bg-white/55 pt-20 backdrop-blur-[1px]"
              aria-live="polite"
              aria-busy="true"
            >
              <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-600 shadow-sm">
                <svg className="h-4 w-4 animate-spin text-indigo-600" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Обновление списка…
              </span>
            </div>
          ) : null}
      {status === 'loading' && (
        <div className="mt-5 text-center py-10">
          <p className="text-lg text-gray-600">Загрузка запчастей...</p>
        </div>
      )}
      {status !== 'loading' && !hasAvailableParts && !hasAnalogParts && (
        <div className="mt-16 flex flex-col items-center text-center max-w-2xl mx-auto px-4">
          <div className="bg-gray-100 p-6 rounded-full mb-8">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 sm:h-12 sm:w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Нет б/у запчастей</h2>
          {catalogError ? (
            <p className="text-red-600 text-base leading-relaxed">{String(catalogError)}</p>
          ) : (
            <p className="text-gray-600 text-base leading-relaxed">
              {urlQ
                ? `По запросу «${urlQ}» ничего не найдено.`
                : 'Сейчас нет запчастей в наличии по выбранным условиям.'}
            </p>
          )}
          <p className="text-sm text-gray-500 mt-4">Попробуйте изменить поисковый запрос или фильтры.</p>
          {(urlQ || usedHasActiveFilters(searchParams)) && updateCatalogUrl && (
            <button
              type="button"
              onClick={() => {
                updateCatalogUrl({
                  q: null,
                  part_type: null,
                  brand: null,
                  vmin: null,
                  vmax: null,
                  vb: null,
                  vm: null,
                  vehicle_id: null,
                  has_photos: null,
                  organization_id: null,
                });
                navigate('/autoparts/used');
              }}
              className="mt-6 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            >
              Сбросить поиск и фильтры
            </button>
          )}
        </div>
      )}
      {status !== 'loading' && (
        <>
      {hasAvailableParts && (
        <>

          {/* Grid view - карточки */}
          {viewMode === 'grid' && !shouldVirtualize && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedAvailableParts.map((part, index) => (
                <ProductCard
                  key={part.id}
                  listPriority={index < 2}
                  part={buildProductCardPart(part)}
                  isTestOrganization={true}
                  hideConditionAndQuantity={true}
                />
              ))}
            </div>
          )}
          {viewMode === 'grid' && shouldVirtualize && (
            <div
              className="relative w-full"
              style={{ height: `${gridRowVirtualizer.getTotalSize()}px` }}
            >
              {gridRowVirtualizer.getVirtualItems().map((virtualRow) => {
                const rowParts = gridRows[virtualRow.index] || [];
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={gridRowVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {rowParts.map((part, colIndex) => (
                      <ProductCard
                        key={part.id}
                        listPriority={virtualRow.index === 0 && colIndex < 2}
                        part={buildProductCardPart(part)}
                        isTestOrganization={true}
                        hideConditionAndQuantity={true}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          )}

          {/* List view — компактная строка: превью + данные, продавец снизу */}
          {viewMode === 'list' && !shouldVirtualize && (
            <div className="space-y-3">
              {sortedAvailableParts.map((part) => renderPartListCard(part, part.id))}
            </div>
          )}
          {viewMode === 'list' && shouldVirtualize && (
            <div
              className="relative w-full"
              style={{ height: `${listRowVirtualizer.getTotalSize()}px` }}
            >
              {listRowVirtualizer.getVirtualItems().map((virtualRow) => {
                const part = sortedAvailableParts[virtualRow.index];
                if (!part) return null;
                return (
                  <div
                    key={virtualRow.key}
                    data-index={virtualRow.index}
                    ref={listRowVirtualizer.measureElement}
                    className="absolute left-0 top-0 w-full pb-3"
                    style={{ transform: `translateY(${virtualRow.start}px)` }}
                  >
                    {renderPartListCard(part, part.id)}
                  </div>
                );
              })}
            </div>
          )}

          {isCatalogMode && catalogHasMore && (
            <div ref={loadMoreSentinelRef} className="mt-6 flex justify-center py-4" aria-hidden="true">
              {catalogLoadingMore && (
                <span className="text-sm text-gray-500">Загрузка…</span>
              )}
            </div>
          )}
        </>
      )}

      {/* Аналоги */}
      {(hasAnalogParts || (urlQ && analogsLoading)) && (
        <>
          <div className="font-medium text-xl sm:text-xl my-6 sm:my-10 px-4 sm:px-0">
            <h2 className="border-b-4 border-blue-500 pb-2 inline-block">
              Аналоги
              {analogsLoading && (
                <span className="ml-2 text-sm font-normal text-gray-500">загрузка…</span>
              )}
            </h2>
          </div>

          {/* Grid view - карточки */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedAnalogParts.map((part, index) => (
                <ProductCard
                  key={`analog-${part.id}`}
                  listPriority={index < 2}
                  part={buildProductCardPart(part)}
                  isTestOrganization={true}
                  hideConditionAndQuantity={true}
                />
              ))}
            </div>
          )}
          
          {/* List view — аналоги */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              {sortedAnalogParts.map((part) => renderPartListCard(part, `analog-${part.id}`))}
            </div>
          )}
        </>
      )}
        </>
      )}
        </div>
      </div>
    </div>
  );
};


export default React.memo(UsedPartsList);
