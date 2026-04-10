import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
  selectCart,
  selectCartLoading,
  selectCartError,
  fetchCart,
  updateCartItemQuantity,
  updateUsedCartItemQuantity,
  removeFromCart,
  removeUsedFromCart
} from '../../redux/slices/CartSlice';

export default function CartPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const cart = useSelector(selectCart);
  const loading = useSelector(selectCartLoading);
  const error = useSelector(selectCartError);
  const isAuthorized = useSelector((state) => Boolean(state.auth.token));

  // Состояние для выбранных товаров
  const [selectedItems, setSelectedItems] = useState(new Set());


  // Состояние для режима доставки по продавцам (частями или единовременно)
  const [sellerDeliveryParts, setSellerDeliveryParts] = useState({});

  // Загрузка корзины при монтировании компонента
  useEffect(() => {
    dispatch(fetchCart());
  }, [dispatch]);

  // Группировка товаров по продавцам
  const groupedItems = React.useMemo(() => {
    if (!cart) return {};

    const groups = {};

    // Группируем новые запчасти
    if (cart.new_parts_items) {
      // Сначала собираем все товары по продавцам для определения последней даты поставки
      const sellerItemsMap = {};
      cart.new_parts_items.forEach(item => {
        const seller = item.seller || 'Новые запчасти';
        if (!sellerItemsMap[seller]) {
          sellerItemsMap[seller] = [];
        }
        sellerItemsMap[seller].push(item);
      });

      // Для каждого продавца определяем дату поставки в зависимости от режима доставки
      Object.keys(sellerItemsMap).forEach(seller => {
        const items = sellerItemsMap[seller];
        const deliverParts = sellerDeliveryParts[seller] || false;

        let deliveryDate = null;

        if (deliverParts) {
          // Если доставка частями - каждый товар сохраняет свою дату
          // В этом случае дата будет индивидуальной для каждого товара
        } else {
          // Если доставка единовременная - находим самую позднюю дату поставки
          let latestDelivery = null;
          items.forEach(item => {
            if (item.delivery && item.delivery !== 'Не указана') {
              if (!latestDelivery || item.delivery > latestDelivery) {
                latestDelivery = item.delivery;
              }
            }
          });
          deliveryDate = latestDelivery;
        }

        // Создаем группы с учетом режима доставки
        items.forEach(item => {
          if (!groups[seller]) {
            groups[seller] = [];
          }

          // Преобразуем item в формат, ожидаемый компонентом
          groups[seller].push({
            id: item.id,
            type: 'new',
            seller: seller,
            brand: item.brand,
            number: item.partnumber,
            name: item.name || `${item.brand} ${item.partnumber}`, // Используем name если есть, иначе бренд + номер
            deliveryDate: deliverParts ? item.delivery : deliveryDate,
            price: item.price,
            quantity: item.quantity,
            stock_id: item.stock_id, // Добавляем stock_id для ограничения количества
            product_id: item.product_id, // Добавляем product_id для передачи в заказ
            image: '/api/placeholder/80/80'
          });
        });
      });
    }

    // Группируем б/у запчасти (пока пусто)
    if (cart.used_parts_items) {
      cart.used_parts_items.forEach(item => {
        const seller = item.seller || 'Б/У запчасти';
        if (!groups[seller]) {
          groups[seller] = [];
    }
        groups[seller].push({
          id: item.id,
          type: 'used',
          seller: seller,
          brand: item.brand,
          number: item.partnumber,
          internalCode: item.partnumber,
          name: `${item.brand} ${item.partnumber}`,
          deliveryDate: item.delivery,
          price: item.price,
          quantity: item.quantity,
          product_id: item.product_id, // Добавляем product_id для передачи в заказ
          image: '/api/placeholder/80/80'
        });
      });
    }

    return groups;
  }, [cart, sellerDeliveryParts]);

  // Получаем все товары из группировки
  const cartItems = React.useMemo(() => {
    return Object.values(groupedItems).flat();
  }, [groupedItems]);


  const handleQuantityChange = async (id, newQuantity) => {
    const quantity = Math.max(1, newQuantity);

    // Находим товар в корзине
    const cartItem = cartItems.find(item => item.id === id);
    if (!cartItem) {
      // Если товар не найден, просто перезагружаем корзину
      dispatch(fetchCart());
      return;
    }

    // Получаем максимальное доступное количество на складе
    const maxAllowed = getMaxAllowedQuantity(cartItem);

    // Ограничиваем количество максимальным доступным на складе
    const finalQuantity = Math.min(quantity, maxAllowed);

    // Минимум 1
    const safeQuantity = Math.max(1, finalQuantity);

    try {
      if (cartItem.type === 'used') {
        await dispatch(updateUsedCartItemQuantity({ itemId: id, quantity: safeQuantity })).unwrap();
      } else {
        await dispatch(updateCartItemQuantity({ itemId: id, quantity: safeQuantity })).unwrap();
      }
    } catch (error) {
      // При ошибке перезагрузим корзину
      dispatch(fetchCart());
    }
  };

  const handleRemoveItem = async (id) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      newSet.delete(id);
      return newSet;
    });

    // Находим товар в корзине чтобы определить его тип
    const cartItem = cartItems.find(item => item.id === id);
    
    try {
      if (cartItem?.type === 'used') {
        // Удаление б/у запчасти
        await dispatch(removeUsedFromCart(id)).unwrap();
      } else {
        // Удаление новой запчасти (по умолчанию)
        await dispatch(removeFromCart(id)).unwrap();
      }
    } catch (error) {
      // При ошибке перезагрузим корзину
      dispatch(fetchCart());
    }
  };

  const handleCheckout = (seller) => {
    if (!isAuthorized) {
      navigate('/auth');
      return;
    }
    // Оформление заказа для всех товаров продавца
    const sellerItems = groupedItems[seller] || [];

    // Сохраняем данные в localStorage для передачи на страницу оформления
    const orderData = {
      items: sellerItems,
      seller: seller,
      deliverInParts: sellerDeliveryParts[seller] || false
    };
    localStorage.setItem('orderData', JSON.stringify(orderData));

    // Переходим на страницу оформления заказа
    navigate('/order-reg');
  };

  const handleCheckoutSelected = (seller) => {
    if (!isAuthorized) {
      navigate('/auth');
      return;
    }
    // Оформление выбранных товаров продавца
    const selectedFromSeller = groupedItems[seller]?.filter(item => selectedItems.has(item.id)) || [];

    // Сохраняем данные в localStorage для передачи на страницу оформления
    const orderData = {
      items: selectedFromSeller,
      seller: seller,
      deliverInParts: sellerDeliveryParts[seller] || false
    };
    localStorage.setItem('orderData', JSON.stringify(orderData));

    // Переходим на страницу оформления заказа
    navigate('/order-reg');
  };

  const handleItemSelect = (itemId) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleSelectAllSellerItems = (seller) => {
    const sellerItemIds = groupedItems[seller].map(item => item.id);
    const allSelected = sellerItemIds.every(id => selectedItems.has(id));

    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (allSelected) {
        // Снимаем выделение со всех товаров продавца
        sellerItemIds.forEach(id => newSet.delete(id));
      } else {
        // Выделяем все товары продавца
        sellerItemIds.forEach(id => newSet.add(id));
      }
      return newSet;
    });
  };


  const calculateSellerTotal = (items) => {
    return items.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };

  const formatDeliveryTime = (deliveryString) => {
    if (!deliveryString) return 'Не указана';

    // Если это уже отформатированная строка вида "26.12.2025 с 09:15 до 20:00"
    if (typeof deliveryString === 'string' && deliveryString.includes('с') && deliveryString.includes('до')) {
      return deliveryString;
    }

    // Если это объект с delivery_start и delivery_end
    if (deliveryString && typeof deliveryString === 'object' && deliveryString.delivery_start && deliveryString.delivery_end) {
      try {
        const startDate = new Date(deliveryString.delivery_start);
        const endDate = new Date(deliveryString.delivery_end);

        const dayText = startDate.toLocaleDateString('ru-RU', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        });

        const startTime = startDate.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });
        const endTime = endDate.toLocaleTimeString('ru-RU', {
          hour: '2-digit',
          minute: '2-digit'
        });

        return `${dayText} с ${startTime} до ${endTime}`;
      } catch (error) {
        console.error('Error formatting delivery time:', error);
        return 'Не указана';
      }
    }

    // Для других форматов дат используем старый formatDate
    return formatDate(deliveryString);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Не указана';

    try {
      let date;

      // Обработка разных форматов дат
      if (typeof dateString === 'string') {
        date = new Date(dateString);
      } else if (dateString && typeof dateString === 'object' && dateString.year) {
        // Формат datetime объекта из Python
        date = new Date(dateString.year, dateString.month - 1, dateString.day,
                       dateString.hour || 0, dateString.minute || 0);
      } else {
        date = new Date(dateString);
      }

      // Проверка корректности даты
      if (isNaN(date.getTime())) {
        return 'Не указана';
      }

      return date.toLocaleDateString('ru-RU');
    } catch (error) {
      console.error('Error formatting date:', error, 'dateString:', dateString);
      return 'Не указана';
    }
  };

  // Функция для получения максимального количества товара (упрощенная версия)
  const getMaxAllowedQuantity = (item) => {
    // Без данных о складах ограничиваем до 50 для безопасности
    return 50;
  };

  return (
    <div className="mt-5">
      <h1 className="text-3xl font-bold text-gray-900 mb-8">Корзина</h1>

      {loading ? (
        <div className="text-center py-16">
          <div className="bg-gray-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <svg className="animate-spin h-12 w-12 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h2 className="text-2xl font-medium text-gray-900 mb-2">Загрузка корзины...</h2>
        </div>
      ) : error ? (
        <div className="text-center py-16">
          <div className="bg-red-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <h2 className="text-2xl font-medium text-gray-900 mb-2">Ошибка загрузки корзины</h2>
          <p className="text-gray-500 mb-6">{typeof error === 'object' ? error.detail || 'Произошла ошибка' : error}</p>
          <button
            onClick={() => dispatch(fetchCart())}
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Попробовать снова
          </button>
        </div>
      ) : cartItems.length === 0 ? (
        <div className="text-center py-16">
          <div className="bg-gray-100 rounded-full w-24 h-24 mx-auto mb-6 flex items-center justify-center">
            <img src="/img/cart.svg" alt="Корзина пуста" className="h-12 w-12 text-gray-400 filter brightness-0 saturate-100 invert-61 sepia-0 saturate-0 hue-rotate-0deg brightness-90 contrast-89" />
          </div>
          <h2 className="text-2xl font-medium text-gray-900 mb-2">Корзина пуста</h2>
          <p className="text-gray-500 mb-6">Добавьте товары в корзину, чтобы оформить заказ</p>
          <a
            href="/autoparts"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
          >
            Перейти к покупкам
          </a>
        </div>
      ) : (
        <div className="space-y-8">
          {Object.entries(groupedItems).map(([seller, items]) => (
            <div key={seller} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              {/* Заголовок продавца */}
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={items.every(item => selectedItems.has(item.id))}
                      onChange={() => handleSelectAllSellerItems(seller)}
                      className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                    />
                    <h2 className="text-xl font-semibold text-gray-900">{seller}</h2>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center space-x-2">
                      <input
                        id={`deliverParts-${seller}`}
                        type="checkbox"
                        checked={sellerDeliveryParts[seller] || false}
                        onChange={(e) => {
                          const isChecked = e.target.checked;
                          setSellerDeliveryParts(prev => ({
                            ...prev,
                            [seller]: isChecked
                          }));
                        }}
                        className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`deliverParts-${seller}`} className="text-sm font-medium text-gray-700">
                        Доставить частями
                      </label>
                    </div>
                    <p className="text-sm text-gray-600">
                      {items.length} товар{items.length !== 1 ? 'а' : ''} • Итого: {formatPrice(calculateSellerTotal(items))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Таблица товаров - десктоп версия */}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Выбор
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Товар
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Запчасть
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Дата поставки
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Кол-во
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Цена
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={selectedItems.has(item.id)}
                            onChange={() => handleItemSelect(item.id)}
                            className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-medium text-gray-900 break-words leading-tight">
                            {item.name}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          <div className="leading-tight">
                            <div className="font-medium">{item.brand}</div>
                            <div className="text-gray-500">{item.number}</div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {item.deliveryDate ? formatDeliveryTime(item.deliveryDate) : 'Не указана'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={item.quantity <= 1}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                              </svg>
                            </button>
                            <span className="text-sm font-medium text-gray-900 w-8 text-center">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="text-gray-400 hover:text-gray-600 p-1 disabled:opacity-50 disabled:cursor-not-allowed"
                              disabled={item.quantity >= getMaxAllowedQuantity(item)}
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                              </svg>
                            </button>
                            {item.quantity >= getMaxAllowedQuantity(item) && getMaxAllowedQuantity(item) < 10 && (
                              <div className="relative group">
                                <svg className="w-4 h-4 text-orange-500 ml-1" fill="currentColor" viewBox="0 0 20 20">
                                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                                </svg>
                                <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap z-10">
                                  Товара больше нет в наличии на этом складе
                                  <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-800"></div>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {formatPrice(item.price)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Итого и оформление заказа для продавца */}
              <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
                <div className="flex items-center justify-between">
                  <div className="text-sm text-gray-600">
                    Итого товаров: {items.reduce((sum, item) => sum + item.quantity, 0)} шт.
                  </div>
                  <div className="flex items-center space-x-4">

                    <div className="flex space-x-2">
                      {/* Кнопки для выбранных товаров этого продавца */}
                      {items.some(item => selectedItems.has(item.id)) && (
                        <>
                          <button
                            onClick={() => {
                              // Удалить выбранные товары этого продавца
                              items
                                .filter(item => selectedItems.has(item.id))
                                .forEach(item => handleRemoveItem(item.id));
                            }}
                            className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
                          >
                            <img src="/img/trash_full.svg" alt="" className="w-3 h-3 mr-1 filter brightness-0 saturate-100 invert-16 sepia-84 saturate-7456 hue-rotate-0deg brightness-97 contrast-105" />
                            Удалить выбранное
                          </button>
                          <button
                            onClick={() => handleCheckoutSelected(seller)}
                            className="inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <img src="/img/cart.svg" alt="" className="w-3 h-3 mr-1 filter brightness-0" />
                            {isAuthorized ? 'Оформить выбранное' : 'Авторизироваться'}
                          </button>
                        </>
                      )}
                      <div className="text-right">
                        <div className="text-sm text-gray-600">Итого к оплате:</div>
                        <div className="text-lg font-bold text-gray-900">
                          {formatPrice(calculateSellerTotal(items))}
                        </div>
                      </div>
                      {/* Основные кнопки */}
                      <button
                        onClick={() => {
                          // Удалить все товары этого продавца
                          items.forEach(item => handleRemoveItem(item.id));
                        }}
                        className="inline-flex items-center px-3 py-1 border border-red-300 text-xs font-medium rounded text-red-700 bg-white hover:bg-red-50 focus:outline-none focus:ring-1 focus:ring-red-500"
                      >
                        <img src="/img/trash_full.svg" alt="" className="w-3 h-3 mr-1 filter brightness-0 saturate-100 invert-16 sepia-84 saturate-7456 hue-rotate-0deg brightness-97 contrast-105" />
                        Удалить все
                      </button>
                      <button
                        onClick={() => handleCheckout(seller)}
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                      >
                        {isAuthorized ? 'Оформить заказ' : 'Авторизироваться'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}