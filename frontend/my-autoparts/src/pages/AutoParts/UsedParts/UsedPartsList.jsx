import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useSearchParams } from 'react-router-dom';
import ProductCard from '../ProductCard';
import {
  selectCatalogItems,
  selectCatalogTotal,
  selectCatalogPage,
  selectCatalogPageSize,
  selectCatalogLoading,
  selectCatalogFacets,
  selectPublicPartTypes,
} from '../../../redux/slices/ProductSlice';
import { selectSearchQuery } from '../../../redux/slices/RosskoSlice';
import { fetchStorageLocations, fetchOrganization } from '../../../redux/slices/OrganizationSlice';
import { normalizeImageUrl } from '../../../utils/apiClient';

// Селекторы для б/у запчастей
const selectUsedPartsData = (state) => state.products.usedPartsData;
const selectUsedPartsLoading = (state) => state.products.loading;

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

const COLLAPSED_FILTER_LIMIT = 3;

const UsedPartsList = ({ viewMode = 'grid', sortBy = 'date', updateCatalogUrl }) => {
  const dispatch = useDispatch();
  const [searchParams] = useSearchParams();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [expandedFilterGroups, setExpandedFilterGroups] = useState({});

  const usedPartsData = useSelector(selectUsedPartsData);
  const catalogItems = useSelector(selectCatalogItems);
  const catalogTotal = useSelector(selectCatalogTotal);
  const catalogPage = useSelector(selectCatalogPage);
  const catalogPageSize = useSelector(selectCatalogPageSize);
  const catalogFacets = useSelector(selectCatalogFacets);
  const publicPartTypes = useSelector(selectPublicPartTypes);
  const searchQuery = useSelector(selectSearchQuery);
  const isCatalogMode = !(searchQuery || '').trim();
  const catalogLoading = useSelector(selectCatalogLoading);
  const usedPartsLoading = useSelector(selectUsedPartsLoading);
  const status = isCatalogMode
    ? (catalogLoading ? 'loading' : 'idle')
    : (usedPartsLoading ? 'loading' : 'idle');
  const { storageLocations, data: organization } = useSelector((state) => state.organization);
  const user = useSelector((state) => state.auth.user);

  const availableParts = useMemo(
    () => (isCatalogMode ? catalogItems : (usedPartsData?.available_parts || [])),
    [isCatalogMode, catalogItems, usedPartsData]
  );
  const analogParts = useMemo(
    () => (isCatalogMode ? [] : (usedPartsData?.analog_parts || [])),
    [isCatalogMode, usedPartsData]
  );

  const totalPages = Math.max(1, Math.ceil(catalogTotal / catalogPageSize));

  const activeFilters = useMemo(() => ({
    partTypes: searchParams.getAll('part_type'),
    brands: searchParams.getAll('brand'),
    priceMin: searchParams.get('vmin') || '',
    priceMax: searchParams.get('vmax') || '',
    vehicleBrands: searchParams.getAll('vb'),
    vehicleModels: searchParams.getAll('vm'),
    hasPhotos: searchParams.get('has_photos') === '1',
  }), [searchParams]);

  const searchFacets = useMemo(() => {
    const countValues = (values) => {
      const counts = new Map();
      values.filter(Boolean).forEach((value) => {
        counts.set(value, (counts.get(value) || 0) + 1);
      });
      return Array.from(counts.entries())
        .map(([value, count]) => ({ value, count }))
        .sort((a, b) => String(a.value).localeCompare(String(b.value), 'ru'));
    };

    const parts = [...availableParts, ...analogParts];
    const vehicleBrands = [];
    const vehicleModels = [];

    parts.forEach((part) => {
      (part.compatible_vehicles || []).forEach((vehicle) => {
        vehicleBrands.push(vehicle.brand);
        vehicleModels.push(vehicle.model);
      });
    });

    return {
      brands: countValues(parts.map((part) => part.brand)),
      vehicle_brands: countValues(vehicleBrands),
      vehicle_models: countValues(vehicleModels),
    };
  }, [availableParts, analogParts]);

  const brandOptions = isCatalogMode ? (catalogFacets?.brands || []) : searchFacets.brands;
  const vehicleBrandOptions = isCatalogMode ? (catalogFacets?.vehicle_brands || []) : searchFacets.vehicle_brands;
  const vehicleModelOptions = isCatalogMode ? (catalogFacets?.vehicle_models || []) : searchFacets.vehicle_models;

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

  const setFilter = (key, value) => {
    if (!updateCatalogUrl) return;
    const updates = { [key]: value };
    if (key !== 'page') updates.page = 1;
    updateCatalogUrl(updates);
  };

  const toggleMultiFilter = (key, value) => {
    const currentValues = searchParams.getAll(key);
    const nextValues = currentValues.includes(String(value))
      ? currentValues.filter((item) => item !== String(value))
      : [...currentValues, String(value)];
    setFilter(key, nextValues);
  };

  const clearFilters = () => {
    if (!updateCatalogUrl) return;
    updateCatalogUrl({
      part_type: null,
      brand: null,
      vmin: null,
      vmax: null,
      vb: null,
      vm: null,
      vehicle_id: null,
      has_photos: null,
      page: 1,
    });
  };

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

    // Combine photos and videos
    const allMedia = React.useMemo(() => {
      const photos = (part.photos || []).map(photo => ({
        type: 'photo',
        url: normalizeImageUrl(photo.full_url || photo.photo_url || photo)
      }));
      const videos = (part.videos || []).map(video => ({
        type: 'video',
        url: normalizeImageUrl(video.full_url || video.video_url || video)
      }));
      return [...photos, ...videos];
    }, [part.photos, part.videos]);

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
            src={currentMedia.url}
            alt={part.name || part.article}
            className="w-full h-full object-cover rounded-lg"
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




  const hasAvailableParts = sortedAvailableParts.length > 0;
  const hasAnalogParts = sortedAnalogParts.length > 0;
  const visibleTotal = isCatalogMode ? catalogTotal : sortedAvailableParts.length + sortedAnalogParts.length;

  const toggleFilterGroup = (groupKey) => {
    setExpandedFilterGroups((prev) => ({
      ...prev,
      [groupKey]: !prev[groupKey],
    }));
  };

  const buildFilterOptionsList = (options, selectedValues) => {
    const selectedSet = new Set(selectedValues.map(String));
    const withSelectedValues = [...options];
    const knownValues = new Set(options.map((option) => String(option.value)));

    selectedSet.forEach((value) => {
      if (!knownValues.has(value)) {
        withSelectedValues.push({ value, label: value });
      }
    });

    return withSelectedValues;
  };

  const getCollapsedFilterOptions = (allOptions, selectedValues) => {
    const selectedSet = new Set(selectedValues.map(String));
    const visible = [];
    const seen = new Set();

    allOptions.forEach((option) => {
      const optionValue = String(option.value);
      if ((visible.length < COLLAPSED_FILTER_LIMIT || selectedSet.has(optionValue)) && !seen.has(optionValue)) {
        visible.push(option);
        seen.add(optionValue);
      }
    });

    return visible;
  };

  const renderCheckboxGroup = ({ title, groupKey, options, selectedValues, urlKey }) => {
    const allOptions = buildFilterOptionsList(options, selectedValues);
    const collapsedOptions = getCollapsedFilterOptions(allOptions, selectedValues);
    const isExpanded = Boolean(expandedFilterGroups[groupKey]);
    const visibleOptions = isExpanded ? allOptions : collapsedOptions;
    const showToggle = allOptions.length > COLLAPSED_FILTER_LIMIT;

    return (
      <div>
        <p className="block text-xs font-medium text-gray-600 mb-2">{title}</p>
        <div className="space-y-2">
          {visibleOptions.length > 0 ? (
            visibleOptions.map((option) => {
              const value = String(option.value);
              return (
                <label key={value} className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={selectedValues.includes(value)}
                    onChange={() => toggleMultiFilter(urlKey, value)}
                    className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="min-w-0 flex-1 truncate">{option.label || option.value}</span>
                  {typeof option.count === 'number' && (
                    <span className="text-xs text-gray-400">{option.count}</span>
                  )}
                </label>
              );
            })
          ) : (
            <p className="text-xs text-gray-400">Нет вариантов</p>
          )}
        </div>
        {showToggle && (
          <button
            type="button"
            onClick={() => toggleFilterGroup(groupKey)}
            className="mt-2 text-xs font-medium text-indigo-600 hover:text-indigo-800"
          >
            {isExpanded ? 'Скрыть' : 'Показать больше'}
          </button>
        )}
      </div>
    );
  };

  const partTypeOptions = publicPartTypes.map((partType) => ({
    value: String(partType.id),
    label: partType.name,
  }));

  const filtersPanel = (
    <div className="space-y-4">
      {renderCheckboxGroup({
        title: 'Категории',
        groupKey: 'partTypes',
        options: partTypeOptions,
        selectedValues: activeFilters.partTypes,
        urlKey: 'part_type',
      })}
      {renderCheckboxGroup({
        title: 'Бренды',
        groupKey: 'brands',
        options: brandOptions,
        selectedValues: activeFilters.brands,
        urlKey: 'brand',
      })}
      <div className="grid grid-cols-2 gap-2">
        <input type="number" placeholder="Цена от" value={searchParams.get('vmin') || ''} onChange={(e) => setFilter('vmin', e.target.value || null)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
        <input type="number" placeholder="Цена до" value={searchParams.get('vmax') || ''} onChange={(e) => setFilter('vmax', e.target.value || null)} className="border border-gray-300 rounded-lg px-3 py-2 text-sm" />
      </div>
      {renderCheckboxGroup({
        title: 'Марки авто',
        groupKey: 'vehicleBrands',
        options: vehicleBrandOptions,
        selectedValues: activeFilters.vehicleBrands,
        urlKey: 'vb',
      })}
      {renderCheckboxGroup({
        title: 'Модели',
        groupKey: 'vehicleModels',
        options: vehicleModelOptions,
        selectedValues: activeFilters.vehicleModels,
        urlKey: 'vm',
      })}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={searchParams.get('has_photos') === '1'} onChange={(e) => setFilter('has_photos', e.target.checked ? '1' : null)} />
        Только с фото
      </label>
      <button type="button" onClick={clearFilters} className="w-full text-sm text-indigo-600 hover:text-indigo-800 font-medium">Сбросить фильтры</button>
    </div>
  );

  return (
    <div className="mt-4 sm:mt-5 px-0 w-full">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Найдено: <span className="font-semibold text-gray-900">{visibleTotal}</span></p>
        <button type="button" onClick={() => setFiltersOpen(!filtersOpen)} className="lg:hidden px-4 py-2 rounded-lg bg-gray-200 text-gray-800 text-sm font-medium">
          {filtersOpen ? 'Скрыть фильтры' : 'Фильтры'}
        </button>
      </div>
      <div className="flex flex-col lg:flex-row gap-6">
        <aside className={`${filtersOpen ? 'block' : 'hidden'} lg:block w-full lg:w-64 flex-shrink-0`}>
          <div className="bg-white rounded-lg border border-gray-200 p-4 lg:sticky lg:top-4">
            <h3 className="font-semibold text-gray-900 mb-3 hidden lg:block">Фильтры</h3>
            {filtersPanel}
          </div>
        </aside>
        <div className="flex-1 min-w-0">
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
          <p className="text-gray-600 text-base leading-relaxed">Б/у запчасти по данному поисковому запросу не найдены.</p>
          <p className="text-sm text-gray-500 mt-4">Попробуйте изменить поисковый запрос или фильтры.</p>
        </div>
      )}
      {status !== 'loading' && (
        <>
      {hasAvailableParts && (
        <>

          {/* Grid view - карточки */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedAvailableParts.map((part) => (
                <ProductCard
                  key={part.id}
                  part={{
                    id: part.id,
                    title: part.name || part.article || '—',
                    price: part.price ? `${part.price} ₽` : '—',
                    originalPrice: null, // No original price in current data
                    discount: null, // No discount info in current data
                    brand: part.brand || '—',
                    article: part.article || '—',
                    location: part.storage_location?.address || '—',
                    description: part.description || '',
                    sellerName: organization?.name || part.organization?.name || 'Продавец',
                    rating: 4.7, // Default rating since not in data
                    reviewCount: 152, // Default review count
                    isDiscount: false, // No discount info in current data
                    isNew: part.is_new,
                    quantity: part.quantity || part.available_count || 0,
                    sellerReliable: true, // Default value
                    sellerVerified: true, // Default value
                    photos: part.photos || [],
                    videos: part.videos || [], // Add videos from backend
                    image: (part.photos && part.photos.length > 0) ? (part.photos[0].full_url || part.photos[0].photo_url || part.photos[0]) : '/api/placeholder/200/200',
                    sellerLogo: organization?.name?.substring(0, 4).toUpperCase() || 'SELL',
                    phone: organization?.phone || part.organization?.phone || '+7 (999) 123-45-67' // Use phone from organization if available
                  }}
                  isTestOrganization={true}
                  hideConditionAndQuantity={true}
                />
              ))}
            </div>
          )}

          {isCatalogMode && totalPages > 1 && (
            <div className="mt-6 flex items-center justify-center gap-2 flex-wrap">
              <button type="button" disabled={catalogPage <= 1} onClick={() => setFilter('page', catalogPage - 1)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-40">Назад</button>
              <span className="text-sm text-gray-600 px-2">Стр. {catalogPage} из {totalPages}</span>
              <button type="button" disabled={catalogPage >= totalPages} onClick={() => setFilter('page', catalogPage + 1)} className="px-3 py-2 rounded-lg border border-gray-300 text-sm disabled:opacity-40">Вперёд</button>
            </div>
          )}
          
          {/* List view - список */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              {sortedAvailableParts.map((part) => {
                const availableQty = part.quantity || part.available_count || 0;
                const sellerOrg = part.organization || organization;
                
                return (
                  <div 
                    key={part.id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Photo/Video with navigation */}
                        <div className="w-full sm:w-48 h-48 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                          <MediaDisplay part={part} />
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 flex flex-col">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900">{part.brand} {part.name || part.article}</h3>
                              <p className="text-xs sm:text-sm text-gray-500 mt-1">Артикул: <span className="font-medium">{part.article || '—'}</span></p>
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-indigo-600 whitespace-nowrap">
                              {part.price ? `${part.price.toLocaleString()} ₽` : '—'}
                            </div>
                          </div>
                          
                          {part.description && (
                            <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2">{part.description}</p>
                          )}
                          
                          <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-3">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              <span>{getStorageAddress(part.storage_location_id, part.storage_location)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className={availableQty > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {availableQty > 0 ? `В наличии: ${availableQty} шт.` : 'Нет в наличии'}
                              </span>
                            </div>
                          </div>
                          
                        </div>
                        
                        {/* Seller Info - Right Side */}
                        <div className="flex-shrink-0 w-full sm:w-80">
                          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {(sellerOrg?.name || 'Продавец').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{sellerOrg?.name || 'Продавец'}</p>
                                {sellerOrg?.contact_person && (
                                  <p className="text-xs text-gray-600 truncate">{sellerOrg.contact_person}</p>
                                )}
                              </div>
                            </div>
                            {sellerOrg?.phone && (
                              <a
                                href={`tel:${sellerOrg.phone.replace(/\D/g, '')}`}
                                className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span className="hidden sm:inline">{formatPhoneNumber(sellerOrg.phone)}</span>
                                <span className="sm:hidden">Позвонить</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Аналоги */}
      {hasAnalogParts && (
        <>
          <div className="font-medium text-xl sm:text-xl my-6 sm:my-10 px-4 sm:px-0">
            <h2 className="border-b-4 border-blue-500 pb-2 inline-block">Аналоги</h2>
          </div>

          {/* Grid view - карточки */}
          {viewMode === 'grid' && (
            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {sortedAnalogParts.map((part) => (
                <ProductCard 
                  key={`analog-${part.id}`}
                  part={{
                    id: part.id,
                    title: part.name || part.article || '—',
                    price: part.price ? `${part.price} ₽` : '—',
                    originalPrice: null, // No original price in current data
                    discount: null, // No discount info in current data
                    brand: part.brand || '—',
                    article: part.article || '—',
                    location: part.storage_location?.address || '—',
                    description: part.description || '',
                    sellerName: organization?.name || part.organization?.name || 'Продавец',
                    rating: 4.7, // Default rating since not in data
                    reviewCount: 152, // Default review count
                    isDiscount: false, // No discount info in current data
                    isNew: part.is_new,
                    quantity: part.quantity || part.available_count || 0,
                    sellerReliable: true, // Default value
                    sellerVerified: true, // Default value
                    photos: part.photos || [],
                    videos: part.videos || [], // Add videos from backend
                    image: (part.photos && part.photos.length > 0) ? (part.photos[0].full_url || part.photos[0].photo_url || part.photos[0]) : '/api/placeholder/200/200',
                    sellerLogo: organization?.name?.substring(0, 4).toUpperCase() || 'SELL',
                    phone: organization?.phone || part.organization?.phone || '+7 (999) 123-45-67' // Use phone from organization if available
                  }}
                  isTestOrganization={true}
                  hideConditionAndQuantity={true}
                />
              ))}
            </div>
          )}
          
          {/* List view - список */}
          {viewMode === 'list' && (
            <div className="space-y-3">
              {sortedAnalogParts.map((part) => {
                const availableQty = part.quantity || part.available_count || 0;
                const sellerOrg = part.organization || organization;
                
                return (
                  <div 
                    key={`analog-${part.id}`}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden hover:shadow-md transition-shadow"
                  >
                    <div className="p-4">
                      <div className="flex flex-col sm:flex-row gap-4">
                        {/* Photo/Video with navigation */}
                        <div className="w-full sm:w-48 h-48 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                          <MediaDisplay part={part} />
                        </div>
                        
                        {/* Info */}
                        <div className="flex-1 flex flex-col">
                          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2 mb-2">
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg font-semibold text-gray-900">{part.brand} {part.name || part.article}</h3>
                              <p className="text-xs sm:text-sm text-gray-500 mt-1">Артикул: <span className="font-medium">{part.article || '—'}</span></p>
                            </div>
                            <div className="text-xl sm:text-2xl font-bold text-indigo-600 whitespace-nowrap">
                              {part.price ? `${part.price.toLocaleString()} ₽` : '—'}
                            </div>
                          </div>
                          
                          {part.description && (
                            <p className="text-xs sm:text-sm text-gray-600 mb-3 line-clamp-2">{part.description}</p>
                          )}
                          
                          <div className="flex flex-wrap gap-3 sm:gap-4 text-xs sm:text-sm text-gray-500 mb-3">
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                              </svg>
                              <span>{getStorageAddress(part.storage_location_id, part.storage_location)}</span>
                            </div>
                            <div className="flex items-center gap-1">
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              <span className={availableQty > 0 ? 'text-green-600 font-medium' : 'text-red-600 font-medium'}>
                                {availableQty > 0 ? `В наличии: ${availableQty} шт.` : 'Нет в наличии'}
                              </span>
                            </div>
                          </div>
                          
                        </div>
                        
                        {/* Seller Info - Right Side */}
                        <div className="flex-shrink-0 w-full sm:w-80">
                          <div className="bg-gradient-to-r from-indigo-50 to-blue-50 rounded-lg p-3 border border-gray-200">
                            <div className="flex items-center gap-3 mb-2">
                              <div className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm flex-shrink-0">
                                {(sellerOrg?.name || 'Продавец').substring(0, 2).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <p className="text-sm font-semibold text-gray-900 truncate">{sellerOrg?.name || 'Продавец'}</p>
                                {sellerOrg?.contact_person && (
                                  <p className="text-xs text-gray-600 truncate">{sellerOrg.contact_person}</p>
                                )}
                              </div>
                            </div>
                            {sellerOrg?.phone && (
                              <a
                                href={`tel:${sellerOrg.phone.replace(/\D/g, '')}`}
                                className="flex items-center justify-center gap-2 w-full px-3 py-2 bg-amber-500 hover:bg-amber-600 text-white text-sm font-medium rounded-lg transition-colors"
                              >
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                                </svg>
                                <span className="hidden sm:inline">{formatPhoneNumber(sellerOrg.phone)}</span>
                                <span className="sm:hidden">Позвонить</span>
                              </a>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
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


export default UsedPartsList;
