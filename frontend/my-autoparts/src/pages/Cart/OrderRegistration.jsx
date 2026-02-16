import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearCart } from '../../redux/slices/CartSlice';
import { apiAxios } from '../../utils/apiClient';

export default function OrderRegistration() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  // Получаем данные из localStorage
  const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
  const selectedItems = orderData.items || [];
  const seller = orderData.seller || 'Организация';
  const deliverInParts = orderData.deliverInParts || false;

  // Если данных нет, перенаправляем на корзину
  React.useEffect(() => {
    if (!selectedItems.length) {
      navigate('/cart');
    }
  }, [selectedItems.length, navigate]);

  // Состояние для формы доставки
  const [deliveryType, setDeliveryType] = useState(''); // 'pickup' или 'transport'
  const [selectedTransportCompany, setSelectedTransportCompany] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [adminOrgAddress, setAdminOrgAddress] = useState('');

  // Состояние для получателя
  const [recipient, setRecipient] = useState({
    fullName: '',
    phone: '',
    email: ''
  });

  // Состояние для уведомлений
  const [notification, setNotification] = useState(null);

  // Данные транспортных компаний
  const transportCompanies = [
    'СДЭК',
    'Boxberry',
    'Почта России',
    'DHL',
    'FedEx'
  ];

  // Адреса самовывоза для разных организаций
  const pickupAddresses = useMemo(() => ({
    'АвтоЗапчасти ООО': 'г. Москва, ул. Автозаводская, д. 23, склад №5',
    'ПрофиАвто Плюс': 'г. Санкт-Петербург, пр. Обуховской Обороны, д. 120, склад №3',
    'Организация': 'г. Москва, ул. Ленина, д. 15, офис 205'
  }), []);

  // Получение адреса организации админа
  useEffect(() => {
    const fetchAdminOrgAddress = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await apiAxios.get(
          '/cart/admin-org-address',
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        );
        setAdminOrgAddress(response.data.address);
      } catch (error) {
        console.error('Ошибка получения адреса организации:', error);
        // Fallback на статический адрес
        setAdminOrgAddress(pickupAddresses[seller] || `Адрес организации: ${seller}`);
      }
    };

    fetchAdminOrgAddress();
  }, [seller, pickupAddresses]);

  // Обновление адреса самовывоза при выборе типа доставки
  useEffect(() => {
    if (deliveryType === 'pickup') {
      // Для заказов от админа показываем адрес организации
      setPickupAddress(adminOrgAddress || pickupAddresses[seller] || 'Адрес самовывоза не указан');
    }
  }, [deliveryType, seller, adminOrgAddress, pickupAddresses]);

  // Проверка заполненности всех полей
  const isFormValid = () => {
    const recipientValid = recipient.fullName && recipient.phone && recipient.email;
    const deliveryValid = deliveryType === 'pickup' ||
                         (deliveryType === 'transport' && selectedTransportCompany && deliveryAddress);

    return recipientValid && deliveryValid;
  };

  const formatPrice = (price) => {
    return new Intl.NumberFormat('ru-RU', {
      style: 'currency',
      currency: 'RUB'
    }).format(price);
  };


  const calculateTotal = () => {
    return selectedItems.reduce((total, item) => total + (item.price * item.quantity), 0);
  };

  const handleRecipientChange = (field, value) => {
    setRecipient(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSubmitOrder = async () => {
    try {
      const token = localStorage.getItem('token');

      // Преобразуем данные в формат API
      const orderData = {
        items: selectedItems.map(item => ({
          name: item.name,
          brand: item.brand,
          partnumber: item.number,
          quantity: item.quantity,
          price: item.price,
          product_id: item.product_id, // Добавляем product_id если он есть
          status_id: 1  // В ожидании
        })),
        cart_item_ids: selectedItems.filter(item => item.type === 'new').map(item => item.id), // IDs новых товаров
        used_cart_item_ids: selectedItems.filter(item => item.type === 'used').map(item => item.id), // IDs б/у товаров
        new_parts_order: {
          seller: seller,
          deliver_in_parts: deliverInParts
        },
        recipient_name: recipient.fullName,
        recipient_phone: recipient.phone,
        recipient_email: recipient.email,
        delivery_type: deliveryType,
        ...(deliveryType === 'pickup' && { pickup_address: pickupAddress }),
        ...(deliveryType === 'transport' && {
          transport_company: selectedTransportCompany,
          delivery_address: deliveryAddress
        }),
        total_amount: calculateTotal()
      };

      const response = await apiAxios.post(
        '/orders/',
        orderData,
        {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      );

      console.log('Заказ создан:', response.data);

      // Очищаем корзину в Redux состоянии
      dispatch(clearCart());

      // Очищаем данные из localStorage
      localStorage.removeItem('orderData');

      // Перенаправляем на страницу корзины сразу
      navigate('/cart');

    } catch (error) {
      console.error('Ошибка при оформлении заказа:', error);

      // Показываем уведомление об ошибке
      setNotification({
        type: 'error',
        message: 'Ошибка при оформлении заказа. Попробуйте еще раз.'
      });

      // Автоматически скрываем уведомление через 5 секунд
      setTimeout(() => {
        setNotification(null);
      }, 5000);
    }
  };

  return (
    <div className="mt-5">
      {/* Заголовок */}
      <div className="mb-8 flex items-center justify-between">
        <h1 className="text-3xl font-bold text-gray-900">Заказ у {seller}</h1>
        <button
          onClick={() => navigate('/cart')}
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
        >
          <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Вернуться в корзину
        </button>
      </div>

      {/* Уведомление */}
      {notification && (
        <div className={`mb-8 p-4 rounded-md ${notification.type === 'success' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
          <div className="flex">
            <div className="flex-shrink-0">
              {notification.type === 'success' ? (
                <svg className="h-5 w-5 text-green-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
              )}
            </div>
            <div className="ml-3">
              <p className={`text-sm font-medium ${notification.type === 'success' ? 'text-green-800' : 'text-red-800'}`}>
                {notification.message}
              </p>
            </div>
            <div className="ml-auto pl-3">
              <div className="-mx-1.5 -my-1.5">
                <button
                  onClick={() => setNotification(null)}
                  className={`inline-flex rounded-md p-1.5 focus:outline-none focus:ring-2 focus:ring-offset-2 ${notification.type === 'success' ? 'text-green-500 hover:bg-green-100 focus:ring-green-600' : 'text-red-500 hover:bg-red-100 focus:ring-red-600'}`}
                >
                  <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Выбранные запчасти */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Выбранные запчасти</h2>
            <div className="text-sm text-gray-600">
              Режим доставки: {deliverInParts ? 'Частями' : 'Единовременно'}
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Товар
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Запчасть
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Кол-во
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Цена
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Сумма
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {selectedItems.map((item) => (
                <tr key={item.id}>
                  <td className="px-6 py-4">
                    <div className="text-sm font-medium text-gray-900 break-words leading-tight max-w-xs">
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
                    {item.quantity} шт.
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                    {formatPrice(item.price)}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                    {formatPrice(item.price * item.quantity)}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50">
              <tr>
                <td colSpan="4" className="px-6 py-4 text-right text-sm font-medium text-gray-900">
                  Итого:
                </td>
                <td className="px-6 py-4 text-sm font-bold text-gray-900">
                  {formatPrice(calculateTotal())}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Доставка */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Доставка</h2>
        </div>

        <div className="px-6 py-6">
          <div className="space-y-4">
            {/* Выбор типа доставки */}
            <div>
              <label className="text-sm font-medium text-gray-700">Способ доставки</label>
              <div className="mt-2 space-y-2">
                <div className="flex items-center">
                  <input
                    id="pickup"
                    name="deliveryType"
                    type="radio"
                    value="pickup"
                    checked={deliveryType === 'pickup'}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="pickup" className="ml-3 text-sm font-medium text-gray-700">
                    Самовывоз
                  </label>
                </div>
                <div className="flex items-center">
                  <input
                    id="transport"
                    name="deliveryType"
                    type="radio"
                    value="transport"
                    checked={deliveryType === 'transport'}
                    onChange={(e) => setDeliveryType(e.target.value)}
                    className="h-4 w-4 text-indigo-600 focus:ring-indigo-500 border-gray-300"
                  />
                  <label htmlFor="transport" className="ml-3 text-sm font-medium text-gray-700">
                    Транспортная компания
                  </label>
                </div>
              </div>
            </div>

            {/* Поля в зависимости от типа доставки */}
            {deliveryType === 'pickup' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Адрес самовывоза
                </label>
                <div className="bg-gray-50 border border-gray-300 rounded-md px-3 py-2 text-sm text-gray-900">
                  {pickupAddress}
                </div>
              </div>
            )}

            {deliveryType === 'transport' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Транспортная компания
                  </label>
                  <select
                    value={selectedTransportCompany}
                    onChange={(e) => setSelectedTransportCompany(e.target.value)}
                    className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                  >
                    <option value="">Выберите транспортную компанию</option>
                    {transportCompanies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Адрес пункта выдачи
                  </label>
                  <textarea
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={3}
                    className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                    placeholder="Введите полный адрес пункта выдачи транспортной компании"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Получатель */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">Получатель</h2>
        </div>

        <div className="px-6 py-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                ФИО
              </label>
              <input
                type="text"
                value={recipient.fullName}
                onChange={(e) => handleRecipientChange('fullName', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="Иванов Иван Иванович"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Номер телефона
              </label>
              <input
                type="tel"
                value={recipient.phone}
                onChange={(e) => handleRecipientChange('phone', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="+7 (999) 123-45-67"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Email
              </label>
              <input
                type="email"
                value={recipient.email}
                onChange={(e) => handleRecipientChange('email', e.target.value)}
                className="mt-1 block w-full border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                placeholder="example@email.com"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Порядок оплаты заказа */}
      {isFormValid() && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-8">
          <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-900">Порядок оплаты заказа</h2>
          </div>

          <div className="px-6 py-6">
            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-blue-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-blue-800">
                      Информация об оплате
                    </h3>
                    <div className="mt-2 text-sm text-blue-700">
                      <p>
                        Оплата производится после подтверждения заказа менеджером.
                        Возможные способы оплаты: банковский перевод, наличными при получении,
                        электронные платежные системы.
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-md p-4">
                <div className="text-center">
                  <h3 className="text-lg font-medium text-green-800 mb-2">
                    Сумма к оплате: {formatPrice(calculateTotal())}
                  </h3>
                  <button
                    onClick={handleSubmitOrder}
                    className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Подтвердить заказ
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}