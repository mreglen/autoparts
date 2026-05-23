import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearCart } from '../../redux/slices/CartSlice';
import { apiAxios } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import MobileFormField from '../../components/MobileFormField/MobileFormField';
import {
  normalizeFullName,
  normalizeEmail,
  validateFullName,
  validateEmail,
  validatePhone,
  formatPhoneInput,
  formatPhoneFromRaw,
} from '../../utils/contactValidation';

function formatApiErrorDetail(detail) {
  if (!detail) return 'Ошибка при оформлении заказа. Попробуйте еще раз.';
  if (typeof detail === 'string') return detail;
  if (typeof detail === 'object' && detail.message) {
    const extra = detail.product_id != null
      ? ` (товар №${detail.product_id}, запрошено: ${detail.requested}, доступно: ${detail.available})`
      : '';
    return `${detail.message}${extra}`;
  }
  return 'Ошибка при оформлении заказа. Попробуйте еще раз.';
}

function buildSuccessMessage(data) {
  const usedOrders = Array.isArray(data?.used_orders) ? data.used_orders : [];
  if (usedOrders.length > 1) {
    const ids = usedOrders.map((o) => o.id).join(', ');
    return `Создано заказов: ${usedOrders.length} (№${ids})`;
  }
  const orderId = data?.used_order_id ?? usedOrders[0]?.id;
  if (orderId) return `Заказ №${orderId} успешно оформлен`;
  if (data?.new_order_id) return `Заказ №${data.new_order_id} успешно оформлен`;
  return 'Заказ успешно оформлен';
}

const inputClass = (hasError) =>
  `block w-full rounded-lg border px-3 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 ${
    hasError ? 'border-red-400 bg-red-50/40' : 'border-gray-300 bg-white'
  }`;

function SectionCard({ step, title, subtitle, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`.trim()}
    >
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-white px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {step != null && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
              {step}
            </span>
          )}
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-gray-500">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function DeliveryOption({ id, checked, onChange, title, description, icon }) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
        checked
          ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600/20'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <input
        id={id}
        name="deliveryType"
        type="radio"
        value={id === 'pickup' ? 'pickup' : 'transport'}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-indigo-600 focus:ring-indigo-500"
      />
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            checked ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {icon}
        </span>
        <div>
          <span className="block text-sm font-semibold text-gray-900">{title}</span>
          <span className="mt-0.5 block text-sm text-gray-500">{description}</span>
        </div>
      </div>
    </label>
  );
}

export default function OrderRegistration() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, isReady } = useAuthReady();

  const orderData = JSON.parse(localStorage.getItem('orderData') || '{}');
  const selectedItems = orderData.items || [];
  const seller = orderData.seller || 'Организация';
  const deliverInParts = orderData.deliverInParts || false;

  useEffect(() => {
    if (!selectedItems.length) navigate('/cart');
  }, [selectedItems.length, navigate]);

  const [deliveryType, setDeliveryType] = useState('');
  const [selectedTransportCompany, setSelectedTransportCompany] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [adminOrgAddress, setAdminOrgAddress] = useState('');

  const [recipient, setRecipient] = useState({
    fullName: '',
    phone: '',
    email: '',
  });
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [notification, setNotification] = useState(null);
  const [orderSuccess, setOrderSuccess] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(false);

  const hasNewItems = selectedItems.some((item) => item.type === 'new');
  const hasUsedItems = selectedItems.some((item) => item.type === 'used');
  const isUsedOnlyCheckout = hasUsedItems && !hasNewItems;

  const transportCompanies = ['СДЭК', 'Boxberry', 'Почта России', 'DHL', 'FedEx'];

  const pickupAddresses = useMemo(
    () => ({
      'АвтоЗапчасти ООО': 'г. Москва, ул. Автозаводская, д. 23, склад №5',
      'ПрофиАвто Плюс': 'г. Санкт-Петербург, пр. Обуховской Обороны, д. 120, склад №3',
      Организация: 'г. Москва, ул. Ленина, д. 15, офис 205',
    }),
    []
  );

  const fieldErrors = useMemo(
    () => ({
      fullName: validateFullName(recipient.fullName),
      phone: validatePhone(recipient.phone),
      email: validateEmail(recipient.email),
    }),
    [recipient]
  );

  const showError = useCallback(
    (field) => (touched[field] || submitAttempted) && fieldErrors[field],
    [touched, submitAttempted, fieldErrors]
  );

  const recipientValid =
    !fieldErrors.fullName && !fieldErrors.phone && !fieldErrors.email && recipient.fullName.trim();

  const deliveryValid =
    deliveryType === 'pickup' ||
    (deliveryType === 'transport' && selectedTransportCompany && deliveryAddress.trim());

  const isFormValid = recipientValid && deliveryValid;

  useEffect(() => {
    const fetchAdminOrgAddress = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await apiAxios.get('/cart/admin-org-address', {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        setAdminOrgAddress(response.data.address);
      } catch {
        setAdminOrgAddress(pickupAddresses[seller] || `Адрес организации: ${seller}`);
      }
    };
    fetchAdminOrgAddress();
  }, [seller, pickupAddresses]);

  useEffect(() => {
    if (deliveryType === 'pickup') {
      setPickupAddress(
        adminOrgAddress || pickupAddresses[seller] || 'Адрес самовывоза не указан'
      );
    }
  }, [deliveryType, seller, adminOrgAddress, pickupAddresses]);

  useEffect(() => {
    if (!isReady || !user) return;
    setRecipient((prev) => {
      const fullName = [user.last_name, user.first_name, user.patronymic]
        .filter(Boolean)
        .join(' ')
        .trim();
      return {
        fullName: prev.fullName || fullName,
        phone: prev.phone || formatPhoneFromRaw(user.phone || ''),
        email: prev.email || user.email || '',
      };
    });
  }, [isReady, user]);

  const formatPrice = (price) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(price);

  const calculateTotal = () =>
    selectedItems.reduce((total, item) => total + item.price * item.quantity, 0);

  const totalQty = selectedItems.reduce((sum, item) => sum + item.quantity, 0);

  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleFullNameChange = (e) => {
    const value = e.target.value.replace(/[^А-Яа-яЁё\s-]/g, '');
    setRecipient((prev) => ({ ...prev, fullName: value }));
  };

  const handleFullNameBlur = () => {
    markTouched('fullName');
    setRecipient((prev) => ({ ...prev, fullName: normalizeFullName(prev.fullName) }));
  };

  const handlePhoneChange = (e) => {
    setRecipient((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }));
  };

  const handleEmailChange = (e) => {
    setRecipient((prev) => ({ ...prev, email: e.target.value }));
  };

  const handleEmailBlur = () => {
    markTouched('email');
    setRecipient((prev) => ({ ...prev, email: normalizeEmail(prev.email) }));
  };

  const validateBeforeSubmit = () => {
    setSubmitAttempted(true);
    setTouched({ fullName: true, phone: true, email: true });
    return (
      !fieldErrors.fullName &&
      !fieldErrors.phone &&
      !fieldErrors.email &&
      deliveryValid
    );
  };

  const handleSubmitOrder = async () => {
    if (submitting || orderSuccess) return;
    if (!validateBeforeSubmit()) return;

    const usedItemsWithoutProduct = selectedItems.filter(
      (item) => item.type === 'used' && !item.product_id
    );
    if (usedItemsWithoutProduct.length > 0) {
      setNotification({
        type: 'error',
        message: 'Для б/у товаров не указан product_id. Обновите корзину и попробуйте снова.',
      });
      return;
    }

    try {
      setSubmitting(true);
      setNotification(null);
      const token = localStorage.getItem('token');

      const newCartItemIds = selectedItems.filter((item) => item.type === 'new').map((item) => item.id);
      const usedCartItemIds = selectedItems.filter((item) => item.type === 'used').map((item) => item.id);

      const orderPayload = {
        items: selectedItems.map((item) => ({
          name: item.name,
          brand: item.brand,
          partnumber: item.number,
          quantity: item.quantity,
          price: item.price,
          product_id: item.product_id,
        })),
        used_cart_item_ids: usedCartItemIds,
        recipient_name: normalizeFullName(recipient.fullName),
        recipient_phone: recipient.phone,
        recipient_email: normalizeEmail(recipient.email),
        delivery_type: deliveryType,
        ...(deliveryType === 'pickup' && { pickup_address: pickupAddress }),
        ...(deliveryType === 'transport' && {
          transport_company: selectedTransportCompany,
          delivery_address: deliveryAddress.trim(),
        }),
        total_amount: calculateTotal(),
      };

      if (!isUsedOnlyCheckout) {
        orderPayload.cart_item_ids = newCartItemIds;
        orderPayload.new_parts_order = {
          seller,
          deliver_in_parts: deliverInParts,
        };
      }

      const response = await apiAxios.post('/orders/', orderPayload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      dispatch(clearCart());
      localStorage.removeItem('orderData');

      setOrderSuccess({
        message: buildSuccessMessage(response.data),
        usedOrders: response.data?.used_orders || [],
      });
      setNotification({
        type: 'success',
        message: buildSuccessMessage(response.data),
      });
    } catch (error) {
      const detail = error?.response?.data?.detail;
      setNotification({
        type: 'error',
        message: formatApiErrorDetail(detail),
      });
      setTimeout(() => setNotification(null), 8000);
    } finally {
      setSubmitting(false);
    }
  };

  const handleSuccessDismiss = () => navigate('/cart');

  const checklist = [
    { label: 'Контактные данные', done: recipientValid },
    { label: 'Способ доставки', done: Boolean(deliveryValid) },
  ];

  const summaryBlock = (
    <div className="space-y-4">
      <div className="rounded-xl bg-gray-50 px-4 py-3">
        <div className="flex justify-between text-sm text-gray-600">
          <span>Товаров</span>
          <span className="font-medium text-gray-900">
            {selectedItems.length} поз. · {totalQty} шт.
          </span>
        </div>
        <div className="mt-2 flex justify-between border-t border-gray-200 pt-2">
          <span className="text-sm font-medium text-gray-700">К оплате</span>
          <span className="text-xl font-bold text-gray-900">{formatPrice(calculateTotal())}</span>
        </div>
      </div>

      <ul className="space-y-2">
        {checklist.map((item) => (
          <li key={item.label} className="flex items-center gap-2 text-sm">
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${
                item.done ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
              }`}
            >
              {item.done ? (
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path
                    fillRule="evenodd"
                    d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                    clipRule="evenodd"
                  />
                </svg>
              ) : (
                <span className="h-1.5 w-1.5 rounded-full bg-current" />
              )}
            </span>
            <span className={item.done ? 'text-gray-700' : 'text-gray-400'}>{item.label}</span>
          </li>
        ))}
      </ul>

      <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-800">
        Оплата после подтверждения менеджером: перевод, наличные при получении или онлайн.
      </div>

      {!orderSuccess && (
        <button
          type="button"
          onClick={handleSubmitOrder}
          disabled={submitting || !isFormValid}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? (
            <>
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              Оформление...
            </>
          ) : (
            'Подтвердить заказ'
          )}
        </button>
      )}

      {submitAttempted && !isFormValid && !orderSuccess && (
        <p className="text-center text-xs text-red-600">
          Заполните все обязательные поля корректно
        </p>
      )}
    </div>
  );

  return (
    <div className="max-md:mt-0 mt-5 pb-28 md:pb-8">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-indigo-600">Оформление заказа</p>
          <h1 className="max-md:text-xl text-2xl font-bold text-gray-900 sm:text-3xl">
            <span className="md:hidden">Заказ</span>
            <span className="max-md:hidden">Заказ у {seller}</span>
          </h1>
          {deliverInParts && (
            <p className="mt-1 text-sm text-gray-500">Доставка частями по готовности позиций</p>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/cart')}
          className="inline-flex items-center self-start rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
        >
          <svg className="mr-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          В корзину
        </button>
      </div>

      {notification && (
        <div
          className={`mb-6 rounded-xl border p-4 ${
            notification.type === 'success'
              ? 'border-green-200 bg-green-50'
              : 'border-red-200 bg-red-50'
          }`}
          role="alert"
        >
          <div className="flex gap-3">
            <p
              className={`flex-1 text-sm font-medium ${
                notification.type === 'success' ? 'text-green-800' : 'text-red-800'
              }`}
            >
              {notification.message}
            </p>
            <button
              type="button"
              onClick={() => setNotification(null)}
              className="shrink-0 text-gray-500 hover:text-gray-700"
              aria-label="Закрыть"
            >
              ×
            </button>
          </div>
          {notification.type === 'success' && orderSuccess && (
            <div className="mt-3 flex flex-wrap gap-4">
              <Link
                to="/purchases/orders"
                className="text-sm font-medium text-green-700 underline hover:text-green-900"
              >
                Мои покупки
              </Link>
              <button
                type="button"
                onClick={handleSuccessDismiss}
                className="text-sm font-medium text-green-700 underline hover:text-green-900"
              >
                Вернуться в корзину
              </button>
            </div>
          )}
        </div>
      )}

      <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
        <div className="space-y-6 lg:col-span-8">
          <SectionCard
            step={null}
            title={`Состав заказа · ${selectedItems.length} поз.`}
            subtitle={formatPrice(calculateTotal())}
          >
            <button
              type="button"
              onClick={() => setItemsExpanded((v) => !v)}
              className="mb-3 flex w-full items-center justify-between text-sm font-medium text-indigo-600 md:hidden"
            >
              {itemsExpanded ? 'Скрыть товары' : 'Показать товары'}
              <svg
                className={`h-4 w-4 transition ${itemsExpanded ? 'rotate-180' : ''}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </button>

            <div className={`space-y-3 ${itemsExpanded ? '' : 'max-md:hidden'}`}>
              {selectedItems.map((item) => (
                <div
                  key={item.id}
                  className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-900 line-clamp-2">{item.name}</p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      {item.brand} · {item.number}
                    </p>
                    <p className="mt-1 text-xs text-gray-600">{item.quantity} шт. × {formatPrice(item.price)}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-gray-900">
                    {formatPrice(item.price * item.quantity)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-4 hidden border-t border-gray-100 pt-3 md:flex md:justify-between">
              <span className="text-sm text-gray-600">Итого</span>
              <span className="text-lg font-bold text-gray-900">{formatPrice(calculateTotal())}</span>
            </div>
          </SectionCard>

          <SectionCard
            step={1}
            title="Получатель"
            subtitle="Контакты для связи по заказу"
          >
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
              <MobileFormField
                className="sm:col-span-2"
                label="ФИО"
                htmlFor="recipient-fullName"
                required
                error={showError('fullName')}
                hint="Фамилия, имя и отчество кириллицей"
              >
                <input
                  id="recipient-fullName"
                  type="text"
                  autoComplete="name"
                  value={recipient.fullName}
                  onChange={handleFullNameChange}
                  onBlur={handleFullNameBlur}
                  className={inputClass(showError('fullName'))}
                  placeholder="Иванов Иван Иванович"
                />
              </MobileFormField>

              <MobileFormField
                label="Телефон"
                htmlFor="recipient-phone"
                required
                error={showError('phone')}
                hint="Российский номер, 11 цифр"
              >
                <input
                  id="recipient-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  value={recipient.phone}
                  onChange={handlePhoneChange}
                  onBlur={() => markTouched('phone')}
                  className={inputClass(showError('phone'))}
                  placeholder="+7 (999) 123-45-67"
                />
              </MobileFormField>

              <MobileFormField
                label="Email"
                htmlFor="recipient-email"
                required
                error={showError('email')}
              >
                <input
                  id="recipient-email"
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  value={recipient.email}
                  onChange={handleEmailChange}
                  onBlur={handleEmailBlur}
                  className={inputClass(showError('email'))}
                  placeholder="name@mail.ru"
                />
              </MobileFormField>
            </div>
          </SectionCard>

          <SectionCard
            step={2}
            title="Доставка"
            subtitle="Выберите удобный способ получения"
          >
            <div className="space-y-3">
              <DeliveryOption
                id="pickup"
                checked={deliveryType === 'pickup'}
                onChange={(e) => setDeliveryType(e.target.value)}
                title="Самовывоз"
                description="Заберёте заказ по адресу продавца"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
              <DeliveryOption
                id="transport"
                checked={deliveryType === 'transport'}
                onChange={(e) => setDeliveryType(e.target.value)}
                title="Транспортная компания"
                description="Доставка до пункта выдачи ТК"
                icon={
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                  </svg>
                }
              />
            </div>

            {deliveryType === 'pickup' && (
              <div className="mt-4 rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
                  Адрес самовывоза
                </p>
                <p className="mt-1 text-sm text-gray-900">{pickupAddress}</p>
              </div>
            )}

            {deliveryType === 'transport' && (
              <div className="mt-4 space-y-4">
                <MobileFormField label="Транспортная компания" htmlFor="transport-company" required>
                  <select
                    id="transport-company"
                    value={selectedTransportCompany}
                    onChange={(e) => setSelectedTransportCompany(e.target.value)}
                    className={inputClass(
                      submitAttempted && deliveryType === 'transport' && !selectedTransportCompany
                    )}
                  >
                    <option value="">Выберите компанию</option>
                    {transportCompanies.map((company) => (
                      <option key={company} value={company}>
                        {company}
                      </option>
                    ))}
                  </select>
                </MobileFormField>

                <MobileFormField
                  label="Адрес пункта выдачи"
                  htmlFor="delivery-address"
                  required
                  error={
                    submitAttempted && deliveryType === 'transport' && !deliveryAddress.trim()
                      ? 'Укажите адрес пункта выдачи'
                      : ''
                  }
                >
                  <textarea
                    id="delivery-address"
                    value={deliveryAddress}
                    onChange={(e) => setDeliveryAddress(e.target.value)}
                    rows={3}
                    className={inputClass(
                      submitAttempted && deliveryType === 'transport' && !deliveryAddress.trim()
                    )}
                    placeholder="Город, улица, пункт выдачи ТК"
                  />
                </MobileFormField>
              </div>
            )}

            {submitAttempted && !deliveryType && (
              <p className="mt-3 text-sm text-red-600">Выберите способ доставки</p>
            )}
          </SectionCard>
        </div>

        <aside className="mt-6 lg:col-span-4 lg:mt-0">
          <div className="lg:sticky lg:top-24">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">Итого по заказу</h3>
              <p className="mt-0.5 text-sm text-gray-500">{seller}</p>
              <div className="mt-4">{summaryBlock}</div>
            </div>
          </div>
        </aside>
      </div>

      {!orderSuccess && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur md:hidden pb-safe-bottom">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500">К оплате</p>
              <p className="text-lg font-bold text-gray-900">{formatPrice(calculateTotal())}</p>
            </div>
            <button
              type="button"
              onClick={handleSubmitOrder}
              disabled={submitting || !isFormValid}
              className="shrink-0 rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? '...' : 'Оформить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
