import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { clearCart } from '../../redux/slices/CartSlice';
import { apiAxios, apiAxiosUnauth } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import MobileFormField from '../../components/MobileFormField/MobileFormField';
import DadataAddressInput from '../../components/DadataAddressInput/DadataAddressInput';
import {
  normalizeFullName,
  normalizeEmail,
  formatEmailInput,
  validateFullName,
  validateEmail,
  validatePhone,
  formatPhoneInput,
  formatPhoneFromRaw,
} from '../../utils/contactValidation';
import { trackFormField, trackFormSubmit, trackConversion, CONVERSION_EVENTS } from '../../utils/siteAnalytics';
import CheckoutPaymentAndOffer from '../../components/Legal/CheckoutPaymentAndOffer';
import { PageHeader } from '../../components/UI/SectionHeader';
import Button from '../../components/UI/Button';

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
  `block w-full rounded-sg border px-3 py-2.5 text-sm shadow-sg-sm outline-none transition focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 ${
    hasError ? 'border-danger-400 bg-danger-50/40' : 'border-line bg-surface'
  }`;

function SectionCard({ step, title, subtitle, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-sg border border-line bg-surface shadow-sg-sm ${className}`.trim()}
    >
      <div className="border-b border-line bg-surface-muted/50 px-4 py-4 sm:px-6">
        <div className="flex items-start gap-3">
          {step != null && (
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-bold text-white">
              {step}
            </span>
          )}
          <div>
            <h2 className="text-lg font-semibold text-ink">{title}</h2>
            {subtitle ? <p className="mt-0.5 text-sm text-ink-muted">{subtitle}</p> : null}
          </div>
        </div>
      </div>
      <div className="px-4 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function DeliveryOption({ id, checked, onChange, title, description, icon, value }) {
  return (
    <label
      htmlFor={id}
      className={`flex cursor-pointer items-start gap-3 rounded-xl border-2 p-4 transition ${
        checked
          ? 'border-brand-600 bg-brand-50/50 ring-1 ring-brand-600/20'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <input
        id={id}
        name="deliveryOption"
        type="radio"
        value={value || id}
        checked={checked}
        onChange={onChange}
        className="mt-1 h-4 w-4 shrink-0 border-gray-300 text-brand-600 focus:ring-brand-500"
      />
      <div className="flex min-w-0 flex-1 items-start gap-3">
        <span
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
            checked ? 'bg-brand-600 text-white' : 'bg-gray-100 text-gray-600'
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
  const rawItems = orderData.items || [];
  const selectedItems = useMemo(
    () => rawItems.filter((item) => item.type === 'used'),
    [rawItems]
  );
  const seller = orderData.seller || 'Организация';
  const deliverInParts = orderData.deliverInParts || false;

  useEffect(() => {
    if (!isReady || user) return;
    navigate('/auth', { replace: true, state: { from: '/order-reg' } });
  }, [isReady, user, navigate]);

  useEffect(() => {
    if (rawItems.some((item) => item.type === 'new')) {
      navigate('/cart/new/checkout', { replace: true });
      return;
    }
    if (!selectedItems.length) navigate('/cart');
  }, [rawItems, selectedItems.length, navigate]);

  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [deliveryOptionsLoading, setDeliveryOptionsLoading] = useState(true);
  const [selectedRegionId, setSelectedRegionId] = useState('');
  const [selectedDeliveryOptionId, setSelectedDeliveryOptionId] = useState('');
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
  const [acceptedOffer, setAcceptedOffer] = useState(false);
  const [showOfferError, setShowOfferError] = useState(false);
  const [buyerComment, setBuyerComment] = useState('');

  const hasUsedItems = selectedItems.length > 0;


  const deliveryTypeLabels = {
    pickup: 'Самовывоз из магазина',
    pvz: 'ПВЗ',
    courier: 'Курьер',
  };

  const regions = useMemo(() => {
    const map = new Map();
    deliveryOptions.forEach((opt) => {
      const key = String(opt.region_id);
      if (!map.has(key)) {
        map.set(key, { id: opt.region_id, name: opt.region_name });
      }
    });
    return [...map.values()];
  }, [deliveryOptions]);

  const optionsForRegion = useMemo(
    () => deliveryOptions.filter((opt) => String(opt.region_id) === String(selectedRegionId)),
    [deliveryOptions, selectedRegionId]
  );

  const selectedDeliveryOption = useMemo(
    () => optionsForRegion.find((opt) => String(opt.id) === String(selectedDeliveryOptionId)) || null,
    [optionsForRegion, selectedDeliveryOptionId]
  );

  const orderTotal = useMemo(
    () => selectedItems.reduce((total, item) => total + item.price * item.quantity, 0),
    [selectedItems]
  );

  const minOrderError = useMemo(() => {
    if (!selectedDeliveryOption) return '';
    const minAmount = Number(selectedDeliveryOption.min_order_amount || 0);
    if (minAmount > 0 && orderTotal < minAmount) {
      return `Минимальная сумма заказа для выбранного способа: ${minAmount.toLocaleString('ru-RU')} ₽`;
    }
    return '';
  }, [selectedDeliveryOption, orderTotal]);

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

  const deliveryValid = Boolean(
    selectedDeliveryOption &&
      !minOrderError &&
      (selectedDeliveryOption.delivery_type === 'pickup' ||
        deliveryAddress.trim())
  );

  const deliveryType = selectedDeliveryOption?.delivery_type || '';
  const selectedTransportCompany = selectedDeliveryOption?.carrier || '';
  const pickupAddress =
    selectedDeliveryOption?.pickup_point ||
    adminOrgAddress ||
    pickupAddresses[seller] ||
    'Адрес самовывоза не указан';

  const dadataLocations = useMemo(() => {
    const regionName = selectedDeliveryOption?.region_name;
    if (!regionName) return undefined;
    return [{ region: regionName }];
  }, [selectedDeliveryOption]);

  const isFormValid = recipientValid && deliveryValid && acceptedOffer;

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
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxiosUnauth.get('/public/site-delivery');
        const rows = Array.isArray(res.data) ? res.data : [];
        if (!cancelled) {
          setDeliveryOptions(rows);
          if (rows.length > 0) {
            setSelectedRegionId(String(rows[0].region_id));
            setSelectedDeliveryOptionId(String(rows[0].id));
          }
        }
      } catch {
        if (!cancelled) setDeliveryOptions([]);
      } finally {
        if (!cancelled) setDeliveryOptionsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!selectedRegionId || optionsForRegion.length === 0) return;
    const stillValid = optionsForRegion.some(
      (opt) => String(opt.id) === String(selectedDeliveryOptionId)
    );
    if (!stillValid) {
      setSelectedDeliveryOptionId(String(optionsForRegion[0].id));
    }
  }, [selectedRegionId, optionsForRegion, selectedDeliveryOptionId]);

  useEffect(() => {
    if (selectedDeliveryOption?.delivery_type === 'pickup') {
      setDeliveryAddress('');
    }
  }, [selectedDeliveryOption]);

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
        email: prev.email || formatEmailInput(user.email || ''),
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
    if (recipient.fullName.trim()) trackFormField('order_registration', 'fullName');
    setRecipient((prev) => ({ ...prev, fullName: normalizeFullName(prev.fullName) }));
  };

  const handlePhoneChange = (e) => {
    setRecipient((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }));
  };

  const handlePhoneBlur = () => {
    markTouched('phone');
    if (recipient.phone.trim()) trackFormField('order_registration', 'phone');
    setRecipient((prev) => ({ ...prev, phone: formatPhoneInput(prev.phone) }));
  };

  const handleEmailChange = (e) => {
    setRecipient((prev) => ({ ...prev, email: formatEmailInput(e.target.value) }));
  };

  const handleEmailBlur = () => {
    markTouched('email');
    if (recipient.email.trim()) trackFormField('order_registration', 'email');
    setRecipient((prev) => ({ ...prev, email: normalizeEmail(prev.email) }));
  };

  const validateBeforeSubmit = () => {
    setSubmitAttempted(true);
    setTouched({ fullName: true, phone: true, email: true });
    if (!acceptedOffer) {
      setShowOfferError(true);
    }
    return (
      !fieldErrors.fullName &&
      !fieldErrors.phone &&
      !fieldErrors.email &&
      deliveryValid &&
      acceptedOffer
    );
  };

  const handleSubmitOrder = async () => {
    if (submitting || orderSuccess) return;
    if (!validateBeforeSubmit()) return;
    setShowOfferError(false);

    trackFormSubmit('order_registration', [
      recipient.fullName.trim() ? 'fullName' : null,
      recipient.phone.trim() ? 'phone' : null,
      recipient.email.trim() ? 'email' : null,
      deliveryAddress.trim() ? 'deliveryAddress' : null,
      selectedRegionId ? 'deliveryRegion' : null,
      selectedDeliveryOptionId ? 'deliveryOption' : null,
    ].filter(Boolean));

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

      const usedCartItemIds = selectedItems.map((item) => item.id);

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
        cart_item_ids: [],
        recipient_name: normalizeFullName(recipient.fullName),
        recipient_phone: recipient.phone,
        recipient_email: normalizeEmail(recipient.email),
        delivery_type: deliveryType || 'pickup',
        delivery_region_id: selectedDeliveryOption ? Number(selectedDeliveryOption.region_id) : null,
        delivery_region_name: selectedDeliveryOption?.region_name || null,
        delivery_option_id: selectedDeliveryOption ? Number(selectedDeliveryOption.id) : null,
        ...(deliveryType === 'pickup' && { pickup_address: pickupAddress }),
        ...((deliveryType === 'pvz' || deliveryType === 'courier') && {
          transport_company: selectedTransportCompany,
          delivery_address: deliveryAddress.trim(),
        }),
        total_amount: calculateTotal(),
        buyer_comment: buyerComment.trim() || undefined,
      };

      const response = await apiAxios.post('/orders/', orderPayload, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });

      dispatch(clearCart());
      localStorage.removeItem('orderData');

      setOrderSuccess({
        message: buildSuccessMessage(response.data),
        usedOrders: response.data?.used_orders || [],
      });
      trackConversion(CONVERSION_EVENTS.ORDER_PLACED, { path: '/order-reg' });
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

  const handleContinueShopping = () => navigate('/autoparts/used');

  const successScreen = orderSuccess ? (
    <div className="mx-auto max-w-2xl">
      <div className="overflow-hidden rounded-2xl border border-green-200 bg-white shadow-sm">
        <div className="border-b border-green-100 bg-gradient-to-r from-green-50 to-white px-6 py-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
            <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Заказ оформлен</h2>
          <p className="mt-2 text-sm text-gray-600">{orderSuccess.message}</p>
        </div>
        <div className="space-y-5 px-6 py-6">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Что дальше</h3>
            <ol className="mt-3 space-y-3">
              <li className="flex gap-3 text-sm text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">1</span>
                <span>Продавец подтвердит наличие товара</span>
              </li>
              <li className="flex gap-3 text-sm text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">2</span>
                <span>Статус заказа можно отслеживать в разделе «Мои покупки»</span>
              </li>
              <li className="flex gap-3 text-sm text-gray-700">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">3</span>
                <span>При вопросах напишите продавцу в чат со страницы заказа</span>
              </li>
            </ol>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/purchases/orders"
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Перейти в мои покупки
            </Link>
            <button
              type="button"
              onClick={handleContinueShopping}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Продолжить покупки
            </button>
          </div>
        </div>
      </div>
    </div>
  ) : null;

  const checklist = [
    { label: 'Контактные данные', done: recipientValid },
    { label: 'Способ доставки', done: Boolean(deliveryValid) },
    { label: 'Оферта', done: acceptedOffer },
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

      <div className="hidden md:block">
        <CheckoutPaymentAndOffer
          acceptedOffer={acceptedOffer}
          onOfferChange={(value) => {
            setAcceptedOffer(value);
            if (value) setShowOfferError(false);
          }}
          showOfferError={showOfferError}
        />
      </div>

      {!orderSuccess && (
        <button
          type="button"
          onClick={handleSubmitOrder}
          disabled={submitting || !isFormValid}
          className="hidden md:flex w-full items-center justify-center gap-2 rounded-xl bg-brand-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
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
      {!orderSuccess && (
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-600">Оформление заказа</p>
          <PageHeader
            title={seller ? `Заказ у ${seller}` : 'Заказ'}
            subtitle={deliverInParts ? 'Доставка частями по готовности позиций' : undefined}
            className="mb-0 mt-1"
          />
        </div>
        <Button variant="secondary" size="sm" onClick={() => navigate('/cart')}>
          ← В корзину
        </Button>
      </div>
      )}

      {notification && notification.type === 'error' && (
        <div
          className="mb-6 rounded-xl border border-red-200 bg-red-50 p-4"
          role="alert"
        >
          <div className="flex gap-3">
            <p className="flex-1 text-sm font-medium text-red-800">
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
        </div>
      )}

      {successScreen}

      {!orderSuccess && (
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
              className="mb-3 flex w-full items-center justify-between text-sm font-medium text-brand-600 md:hidden"
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
                  onBlur={handlePhoneBlur}
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

              <MobileFormField
                className="sm:col-span-2"
                label="Комментарий к заказу"
                htmlFor="buyer-comment"
                hint="Необязательно: пожелания, удобное время связи"
              >
                <textarea
                  id="buyer-comment"
                  rows={3}
                  maxLength={1000}
                  value={buyerComment}
                  onChange={(e) => setBuyerComment(e.target.value)}
                  className={inputClass(false)}
                  placeholder="Например: можно забрать после 18:00"
                />
              </MobileFormField>
            </div>
          </SectionCard>

          <SectionCard
            step={2}
            title="Доставка"
            subtitle="Выберите регион и способ доставки как на странице «Доставка»"
          >
            {deliveryOptionsLoading ? (
              <p className="text-sm text-gray-500">Загрузка способов доставки…</p>
            ) : deliveryOptions.length === 0 ? (
              <p className="text-sm text-red-600">
                Способы доставки не настроены. Смотрите{' '}
                <Link to="/delivery" className="text-brand-600 underline">страницу доставки</Link>.
              </p>
            ) : (
              <div className="space-y-4">
                <MobileFormField label="Регион доставки" htmlFor="delivery-region" required>
                  <select
                    id="delivery-region"
                    value={selectedRegionId}
                    onChange={(e) => setSelectedRegionId(e.target.value)}
                    className={inputClass(false)}
                  >
                    {regions.map((region) => (
                      <option key={region.id} value={String(region.id)}>
                        {region.name}
                      </option>
                    ))}
                  </select>
                </MobileFormField>

                <div className="space-y-3">
                  {optionsForRegion.map((option) => (
                    <DeliveryOption
                      key={option.id}
                      id={`delivery-option-${option.id}`}
                      value={String(option.id)}
                      checked={String(selectedDeliveryOptionId) === String(option.id)}
                      onChange={() => setSelectedDeliveryOptionId(String(option.id))}
                      title={`${deliveryTypeLabels[option.delivery_type] || option.delivery_type}${
                        option.carrier ? ` — ${option.carrier}` : ''
                      }`}
                      description={
                        option.min_order_amount && Number(option.min_order_amount) > 0
                          ? `Мин. сумма заказа: ${Number(option.min_order_amount).toLocaleString('ru-RU')} ₽`
                          : option.notes || 'Доступно для выбранного региона'
                      }
                      icon={
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
                        </svg>
                      }
                    />
                  ))}
                </div>

                {selectedDeliveryOption?.delivery_type === 'pickup' && (
                  <div className="rounded-xl border border-brand-100 bg-brand-50/40 px-4 py-3">
                    <p className="text-xs font-medium uppercase tracking-wide text-brand-700">
                      Адрес самовывоза
                    </p>
                    <p className="mt-1 text-sm text-gray-900">{pickupAddress}</p>
                  </div>
                )}

                {(selectedDeliveryOption?.delivery_type === 'pvz' ||
                  selectedDeliveryOption?.delivery_type === 'courier') && (
                  <MobileFormField
                    label={
                      selectedDeliveryOption.delivery_type === 'pvz'
                        ? 'Адрес пункта выдачи'
                        : 'Адрес доставки'
                    }
                    htmlFor="delivery-address"
                    required
                    error={
                      submitAttempted && !deliveryAddress.trim()
                        ? 'Укажите адрес доставки или ПВЗ'
                        : ''
                    }
                  >
                    <DadataAddressInput
                      id="delivery-address"
                      value={deliveryAddress}
                      onChange={setDeliveryAddress}
                      locations={dadataLocations}
                      hasError={submitAttempted && !deliveryAddress.trim()}
                      className={inputClass(submitAttempted && !deliveryAddress.trim())}
                      placeholder={
                        selectedDeliveryOption.delivery_type === 'pvz'
                          ? 'Город, улица, дом (пункт выдачи можно дописать)'
                          : 'Город, улица, дом, квартира'
                      }
                    />
                  </MobileFormField>
                )}

                {minOrderError && (
                  <p className="text-sm text-red-600">{minOrderError}</p>
                )}

                <p className="text-xs text-gray-500">
                  Подробные условия — на странице{' '}
                  <Link to="/delivery" className="text-brand-600 underline">Доставка</Link>.
                </p>
              </div>
            )}

            {submitAttempted && !deliveryValid && !deliveryOptionsLoading && deliveryOptions.length > 0 && (
              <p className="mt-3 text-sm text-red-600">Выберите способ доставки и заполните адрес</p>
            )}
          </SectionCard>

          <SectionCard title="Оплата и условия" className="md:hidden">
            <CheckoutPaymentAndOffer
              acceptedOffer={acceptedOffer}
              onOfferChange={(value) => {
                setAcceptedOffer(value);
                if (value) setShowOfferError(false);
              }}
              showOfferError={showOfferError}
            />
          </SectionCard>
        </div>

        <aside className="mt-6 lg:col-span-4 lg:mt-0">
          <div className="lg:sticky lg:top-[calc(var(--sg-desktop-header-h)+1rem)]">
            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
              <h3 className="text-base font-semibold text-gray-900">Итого по заказу</h3>
              <p className="mt-0.5 text-sm text-gray-500">{seller}</p>
              <div className="mt-4">{summaryBlock}</div>
            </div>
          </div>
        </aside>
      </div>
      )}

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
              className="shrink-0 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {submitting ? '...' : 'Оформить'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
