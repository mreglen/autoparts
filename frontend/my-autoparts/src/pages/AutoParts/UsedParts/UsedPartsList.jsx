import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../ProductCard';
import {
  addUsedPartsToCart,
  selectCart
} from '../../../redux/slices/CartSlice';
import {
  selectMyParts as selectMyPartsItems
} from '../../../redux/slices/ProductSlice';
import { selectSearchQuery } from '../../../redux/slices/RosskoSlice';
import { fetchStorageLocations, fetchOrganization } from '../../../redux/slices/OrganizationSlice';

// Селекторы для б/у запчастей
const selectUsedPartsData = (state) => state.products.usedPartsData;
const selectUsedPartsLoading = (state) => state.products.loading;
const selectAnalogsLoading = (state) => state.products.analogsLoading;

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

const UsedPartsList = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const usedPartsData = useSelector(selectUsedPartsData);
  const myPartsItems = useSelector(selectMyPartsItems);
  const searchQuery = useSelector(selectSearchQuery);
  const status = useSelector(selectUsedPartsLoading) ? 'loading' : 'idle';
  const { storageLocations, data: organization } = useSelector((state) => state.organization);
  const user = useSelector((state) => state.auth.user);
  const cart = useSelector(selectCart);
  const [addingToCartId, setAddingToCartId] = useState(null);
  const availableParts = searchQuery
    ? (usedPartsData?.available_parts || [])
    : (myPartsItems || []);
  const analogParts = usedPartsData?.analog_parts || [];

  const [expandedPartId, setExpandedPartId] = useState(null);
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

  // Получаем количество товара в корзине
  const getCartQuantity = (partId) => {
    if (!cart?.used_parts_items) return 0;
    const cartItem = cart.used_parts_items.find(item => item.product_id === partId);
    return cartItem ? cartItem.quantity : 0;
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




  if (status === 'loading') {
    return (
      <div className="mt-5 text-center py-10">
        <p className="text-lg text-gray-600">Загрузка запчастей...</p>
      </div>
    );
  }



  const hasAvailableParts = availableParts.length > 0;
  const hasAnalogParts = analogParts.length > 0;

  if (!hasAvailableParts && !hasAnalogParts) {
    return (
      <div className="mt-16 flex flex-col items-center text-center max-w-2xl mx-auto px-4">
        <div className="bg-gray-100 p-6 rounded-full mb-8">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 sm:h-12 sm:w-12 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-3">Нет б/у запчастей</h2>
        <p className="text-gray-600 text-base leading-relaxed">Б/у запчасти по данному поисковому запросу не найдены.</p>
        <p className="text-sm text-gray-500 mt-4">Попробуйте изменить поисковый запрос или проверьте правильность написания.</p>
      </div>
    );
  }


  return (
    <div className="mt-4 sm:mt-5 px-0 w-full">
      {/* В наличии */}
      {hasAvailableParts && (
        <>
          <div className="font-medium text-lg sm:text-lg my-6 sm:my-10 px-4 sm:px-0">
            <h2 className="border-b-4 border-blue-500 pb-2 inline-block">В наличии</h2>
          </div>

          {/* Десктопная версия - карточки для всех запчастей в разделе б/у */}
          <div className="hidden md:block">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {availableParts.map((part) => (
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
                    sellerReliable: true, // Default value
                    sellerVerified: true, // Default value
                    photos: part.photos || [],
                    image: (part.photos && part.photos.length > 0) ? (part.photos[0].full_url || part.photos[0]) : '/api/placeholder/200/200',
                    sellerLogo: organization?.name?.substring(0, 4).toUpperCase() || 'SELL',
                    phone: organization?.phone || part.organization?.phone || '+7 (999) 123-45-67' // Use phone from organization if available
                  }}
                  isTestOrganization={true}
                />
              ))}
            </div>
          </div>

          {/* Мобильная версия - карточки */}
          <div className="md:hidden space-y-4">
            {availableParts.map((part) => (
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
                  sellerReliable: true, // Default value
                  sellerVerified: true, // Default value
                  photos: part.photos || [],
                  image: (part.photos && part.photos.length > 0) ? (part.photos[0].full_url || part.photos[0]) : '/api/placeholder/200/200',
                  sellerLogo: organization?.name?.substring(0, 4).toUpperCase() || 'SELL',
                  phone: organization?.phone || part.organization?.phone || '+7 (999) 123-45-67' // Use phone from organization if available
                }}
                isTestOrganization={true}
              />
            ))}
          </div>
        </>
      )}

      
    </div>
  );
};


export default UsedPartsList;