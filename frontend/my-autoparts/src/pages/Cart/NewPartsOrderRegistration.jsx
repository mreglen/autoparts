import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
  selectCart,
  selectCartLoading,
  fetchCart,
  createNewPartsPaymentSession,
} from '../../redux/slices/CartSlice';
import { apiAxios, apiAxiosUnauth } from '../../utils/apiClient';
import { useAuthReady } from '../../hooks/useAuthReady';
import MobileFormField from '../../components/MobileFormField/MobileFormField';
import DadataAddressInput from '../../components/DadataAddressInput/DadataAddressInput';
import OrderOfferConsent from '../../components/Legal/OrderOfferConsent';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';
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
import {
  CHECKOUT_DELIVERY_REGIONS,
  CHECKOUT_PVZ_METHODS,
  findPickupDeliveryOption,
  findPvzDeliveryOption,
  pvzCarrierName,
  regionIdForCheckout,
} from '../../utils/newPartsCheckoutDelivery';
import DeliveryFastIcon from '../../components/icons/DeliveryFastIcon';
import PickupIcon from '../../components/icons/PickupIcon';

function formatApiErrorDetail(detail) {
  if (!detail) return 'Ошибка при оформлении заказа. Попробуйте ещё раз.';
  if (typeof detail === 'string') return detail;
  return 'Ошибка при оформлении заказа. Попробуйте ещё раз.';
}

const formatMoney = (value) =>
  new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB', maximumFractionDigits: 0 }).format(
    Number(value) || 0
  );

const inputClass = (hasError) =>
  `block w-full rounded-xl border px-3 py-2.5 text-sm shadow-sm outline-none transition focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 ${
    hasError ? 'border-red-400 bg-red-50/40' : 'border-gray-300 bg-white'
  }`;

function SectionCard({ title, subtitle, children, className = '' }) {
  return (
    <section
      className={`rounded-2xl border border-gray-200/80 bg-white p-4 shadow-sm sm:p-6 ${className}`}
    >
      {(title || subtitle) && (
        <header className="mb-4 border-b border-gray-100 pb-3">
          {title && <h2 className="text-base font-semibold text-gray-900 sm:text-lg">{title}</h2>}
          {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
        </header>
      )}
      {children}
    </section>
  );
}

function ChoiceTile({ selected, onClick, title, description, icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex w-full items-start gap-3 rounded-xl border-2 p-4 text-left transition ${
        selected
          ? 'border-indigo-600 bg-indigo-50/80 ring-1 ring-indigo-600/20'
          : 'border-gray-200 bg-gray-50/50 hover:border-indigo-300 hover:bg-white'
      }`}
    >
      <span
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${
          selected ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 shadow-sm'
        }`}
      >
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold text-gray-900">{title}</span>
        {description && <span className="mt-0.5 block text-sm text-gray-500">{description}</span>}
      </span>
      <span
        className={`mt-1 h-5 w-5 shrink-0 rounded-full border-2 ${
          selected ? 'border-indigo-600 bg-indigo-600' : 'border-gray-300 bg-white'
        }`}
        aria-hidden
      >
        {selected && (
          <span className="flex h-full w-full items-center justify-center text-[10px] text-white">✓</span>
        )}
      </span>
    </button>
  );
}

function SelectChip({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition ${
        selected
          ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
          : 'border-gray-200 bg-white text-gray-800 hover:border-indigo-300 hover:bg-indigo-50/50'
      }`}
    >
      {children}
    </button>
  );
}

export default function NewPartsOrderRegistration() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user, isReady } = useAuthReady();
  const cart = useSelector(selectCart);
  const cartLoading = useSelector(selectCartLoading);

  const [recipient, setRecipient] = useState({ fullName: '', phone: '', email: '' });
  const [touched, setTouched] = useState({});
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const [fulfillmentMode, setFulfillmentMode] = useState(null);
  const [deliveryRegion, setDeliveryRegion] = useState('');
  const [pvzMethod, setPvzMethod] = useState('');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');

  const [deliveryOptions, setDeliveryOptions] = useState([]);
  const [deliveryLoading, setDeliveryLoading] = useState(true);

  const [acceptedOffer, setAcceptedOffer] = useState(false);
  const [showOfferError, setShowOfferError] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate('/auth', { replace: true });
      return;
    }
    dispatch(fetchCart());
  }, [isReady, user, navigate, dispatch]);

  const selectedItems = useMemo(() => {
    if (!cart?.new_parts_items?.length) return [];
    return cart.new_parts_items.map((item) => ({
      id: item.id,
      brand: item.brand,
      partnumber: item.partnumber,
      name: formatProductDisplayTitle(item.brand, item.partnumber, item.name),
      price: Number(item.price),
      quantity: item.quantity,
    }));
  }, [cart]);

  const orderTotal = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
    [selectedItems]
  );

  const totalQty = useMemo(
    () => selectedItems.reduce((sum, item) => sum + item.quantity, 0),
    [selectedItems]
  );

  useEffect(() => {
    if (!cartLoading && selectedItems.length === 0) {
      navigate('/cart', { replace: true });
    }
  }, [cartLoading, selectedItems.length, navigate]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setDeliveryLoading(true);
      try {
        const res = await apiAxiosUnauth.get('/public/site-delivery');
        const rows = Array.isArray(res.data) ? res.data : [];
        if (cancelled) return;
        setDeliveryOptions(rows);
        const pickupOpt = findPickupDeliveryOption(rows);
        if (pickupOpt?.pickup_point) setPickupAddress(pickupOpt.pickup_point);
      } catch {
        if (!cancelled) setDeliveryOptions([]);
      } finally {
        if (!cancelled) setDeliveryLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (pickupAddress.trim()) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await apiAxios.get('/cart/admin-org-address');
        if (cancelled) return;
        const addr = res.data?.address?.trim();
        if (addr) setPickupAddress(addr);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [pickupAddress]);

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

  const matchedPickupOption = useMemo(
    () => findPickupDeliveryOption(deliveryOptions),
    [deliveryOptions]
  );

  const matchedPvzOption = useMemo(() => {
    if (fulfillmentMode !== 'delivery' || !deliveryRegion || !pvzMethod) return null;
    return findPvzDeliveryOption(deliveryOptions, deliveryRegion, pvzMethod);
  }, [deliveryOptions, deliveryRegion, fulfillmentMode, pvzMethod]);

  const minOrderAmount = useMemo(() => {
    if (fulfillmentMode === 'pickup') {
      const n = Number(matchedPickupOption?.min_order_amount);
      return Number.isFinite(n) ? n : 0;
    }
    if (fulfillmentMode === 'delivery') {
      const n = Number(matchedPvzOption?.min_order_amount);
      return Number.isFinite(n) ? n : 0;
    }
    return 0;
  }, [fulfillmentMode, matchedPickupOption, matchedPvzOption]);

  const meetsMinOrder = orderTotal >= minOrderAmount;

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

  const resolvedPickupAddress = useMemo(() => {
    const fromState = pickupAddress?.trim();
    if (fromState) return fromState;
    return matchedPickupOption?.pickup_point?.trim() || '';
  }, [pickupAddress, matchedPickupOption]);

  const deliveryValid = useMemo(() => {
    if (fulfillmentMode === 'pickup') return Boolean(resolvedPickupAddress);
    if (fulfillmentMode === 'delivery') {
      return Boolean(deliveryRegion && pvzMethod && deliveryAddress.trim());
    }
    return false;
  }, [deliveryAddress, deliveryRegion, fulfillmentMode, pvzMethod, resolvedPickupAddress]);

  const markTouched = (field) => setTouched((prev) => ({ ...prev, [field]: true }));

  const handleFulfillmentModeChange = (mode) => {
    setFulfillmentMode(mode);
    if (mode === 'pickup') {
      setDeliveryRegion('');
      setPvzMethod('');
      setDeliveryAddress('');
      const opt = findPickupDeliveryOption(deliveryOptions);
      if (opt?.pickup_point) setPickupAddress(opt.pickup_point);
    }
  };

  const buildOrderPayload = useCallback(() => {
    const base = {
      recipient_name: normalizeFullName(recipient.fullName),
      recipient_phone: recipient.phone,
      recipient_email: normalizeEmail(recipient.email),
      deliver_in_parts: false,
    };

    if (fulfillmentMode === 'pickup') {
      const opt = matchedPickupOption || findPickupDeliveryOption(deliveryOptions);
      return {
        ...base,
        delivery_type: 'pickup',
        pickup_address: resolvedPickupAddress || opt?.pickup_point || null,
        delivery_region_id: opt?.region_id ?? null,
        delivery_region_name: opt?.region_name || null,
        delivery_option_id: opt?.id ?? null,
      };
    }

    const opt = matchedPvzOption;
    const regionId = regionIdForCheckout(deliveryOptions, deliveryRegion, opt);
    const transportLabel = pvzCarrierName(pvzMethod) || opt?.carrier || null;

    return {
      ...base,
      delivery_type: 'pvz',
      delivery_address: deliveryAddress.trim(),
      transport_company: transportLabel,
      delivery_region_id: regionId,
      delivery_region_name: deliveryRegion,
      delivery_option_id: opt?.id ?? null,
    };
  }, [
    deliveryAddress,
    deliveryOptions,
    deliveryRegion,
    fulfillmentMode,
    matchedPickupOption,
    matchedPvzOption,
    pvzMethod,
    recipient,
    resolvedPickupAddress,
  ]);

  const validateBeforeSubmit = () => {
    setSubmitAttempted(true);
    setTouched({ fullName: true, phone: true, email: true });
    if (!acceptedOffer) setShowOfferError(true);
    if (!fulfillmentMode) {
      setNotification({ type: 'error', message: 'Выберите доставку или самовывоз' });
      return false;
    }
    if (!deliveryValid) {
      setNotification({
        type: 'error',
        message:
          fulfillmentMode === 'pickup'
            ? 'Укажите адрес самовывоза'
            : 'Выберите регион, способ доставки и адрес',
      });
      return false;
    }
    if (!meetsMinOrder) {
      setNotification({
        type: 'error',
        message: `Минимальная сумма заказа — ${formatMoney(minOrderAmount)}`,
      });
      return false;
    }
    if (!recipientValid) {
      setNotification({ type: 'error', message: 'Проверьте контактные данные получателя' });
      return false;
    }
    if (!acceptedOffer) return false;
    return true;
  };

  const handlePay = async () => {
    if (submitting) return;
    if (!validateBeforeSubmit()) return;
    setShowOfferError(false);
    setNotification(null);
    setSubmitting(true);
    try {
      const result = await dispatch(createNewPartsPaymentSession(buildOrderPayload())).unwrap();
      navigate(`/cart/new/pay/${result.session_id}`);
    } catch (err) {
      setNotification({ type: 'error', message: formatApiErrorDetail(err) });
    } finally {
      setSubmitting(false);
    }
  };

  if (!isReady || cartLoading) {
    return <div className="py-16 text-center text-gray-600">Загрузка…</div>;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-4 py-6 pb-16 sm:py-8">
      <div className="mb-6">
        <Link
          to="/cart"
          className="inline-flex items-center gap-1 text-sm text-gray-500 transition hover:text-indigo-600"
        >
          ← Корзина
        </Link>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl">Оформление заказа</h1>
        <p className="mt-1 text-sm text-gray-500">
          {selectedItems.length} {selectedItems.length === 1 ? 'позиция' : 'позиций'} · {totalQty} шт. ·{' '}
          {formatMoney(orderTotal)}
        </p>
      </div>

      {notification?.type === 'error' && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {notification.message}
        </div>
      )}

      <div className="space-y-5">
        <SectionCard title="Состав заказа">
          <ul className="divide-y divide-gray-100">
            {selectedItems.map((item) => (
              <li key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    {item.quantity} × {formatMoney(item.price)}
                  </p>
                </div>
                <p className="shrink-0 font-semibold text-gray-900">
                  {formatMoney(item.price * item.quantity)}
                </p>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex items-center justify-between border-t border-gray-100 pt-4">
            <span className="font-medium text-gray-700">Итого</span>
            <span className="text-lg font-bold text-gray-900">{formatMoney(orderTotal)}</span>
          </div>
        </SectionCard>

        <SectionCard title="Получатель" subtitle="Контакты для связи по заказу">
          <div className="space-y-1">
            <MobileFormField label="ФИО" error={showError('fullName')}>
              <input
                type="text"
                value={recipient.fullName}
                onChange={(e) => {
                  const value = e.target.value.replace(/[^А-Яа-яЁё\s-]/g, '');
                  setRecipient((prev) => ({ ...prev, fullName: value }));
                }}
                onBlur={() => {
                  markTouched('fullName');
                  setRecipient((prev) => ({ ...prev, fullName: normalizeFullName(prev.fullName) }));
                }}
                className={inputClass(showError('fullName'))}
                placeholder="Иванов Иван Иванович"
                autoComplete="name"
              />
            </MobileFormField>
            <MobileFormField label="Телефон" error={showError('phone')}>
              <input
                type="tel"
                value={recipient.phone}
                onChange={(e) =>
                  setRecipient((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }))
                }
                onBlur={() => {
                  markTouched('phone');
                  setRecipient((prev) => ({ ...prev, phone: formatPhoneInput(prev.phone) }));
                }}
                className={inputClass(showError('phone'))}
                placeholder="+7 (999) 123-45-67"
                autoComplete="tel"
              />
            </MobileFormField>
            <MobileFormField label="Email" error={showError('email')}>
              <input
                type="email"
                value={recipient.email}
                onChange={(e) =>
                  setRecipient((prev) => ({ ...prev, email: formatEmailInput(e.target.value) }))
                }
                onBlur={() => {
                  markTouched('email');
                  setRecipient((prev) => ({ ...prev, email: normalizeEmail(prev.email) }));
                }}
                className={inputClass(showError('email'))}
                placeholder="email@example.com"
                autoComplete="email"
              />
            </MobileFormField>
          </div>
        </SectionCard>

        <SectionCard title="Доставка" subtitle="Сначала выберите способ получения заказа">
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ChoiceTile
                selected={fulfillmentMode === 'delivery'}
                onClick={() => handleFulfillmentModeChange('delivery')}
                title="Доставка"
                description="ПВЗ в выбранном регионе"
                icon={<DeliveryFastIcon />}
              />
              <ChoiceTile
                selected={fulfillmentMode === 'pickup'}
                onClick={() => handleFulfillmentModeChange('pickup')}
                title="Самовывоз"
                description="Забрать в пункте выдачи магазина"
                icon={<PickupIcon />}
              />
            </div>

            {fulfillmentMode === 'pickup' && (
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">Адрес самовывоза</p>
                {deliveryLoading && !resolvedPickupAddress ? (
                  <p className="mt-2 text-sm text-gray-600">Загрузка адреса…</p>
                ) : (
                  <p className="mt-2 text-sm leading-relaxed text-gray-900">
                    {resolvedPickupAddress || 'Адрес будет уточнён менеджером при подтверждении заказа'}
                  </p>
                )}
              </div>
            )}

            {fulfillmentMode === 'delivery' && (
              <div className="space-y-5 border-t border-gray-100 pt-4">
                <div>
                  <p className="mb-2 text-sm font-medium text-gray-800">Регион</p>
                  <div className="flex flex-wrap gap-2">
                    {CHECKOUT_DELIVERY_REGIONS.map((name) => (
                      <SelectChip
                        key={name}
                        selected={deliveryRegion === name}
                        onClick={() => {
                          setDeliveryRegion(name);
                          setPvzMethod('');
                          setDeliveryAddress('');
                        }}
                      >
                        {name}
                      </SelectChip>
                    ))}
                  </div>
                </div>

                {deliveryRegion && (
                  <div>
                    <p className="mb-2 text-sm font-medium text-gray-800">Способ доставки</p>
                    <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      {CHECKOUT_PVZ_METHODS.map((method) => (
                        <SelectChip
                          key={method.key}
                          selected={pvzMethod === method.key}
                          onClick={() => {
                            setPvzMethod(method.key);
                            setDeliveryAddress('');
                          }}
                        >
                          {method.label}
                        </SelectChip>
                      ))}
                    </div>
                  </div>
                )}

                {deliveryRegion && pvzMethod && (
                  <div>
                    <label htmlFor="delivery-address" className="mb-1 block text-sm font-medium text-gray-800">
                      Адрес (город, улица, дом)
                    </label>
                    <p className="mb-2 text-xs text-gray-500">
                      Выберите адрес из подсказок или введите его вручную — любой удобный вариант
                    </p>
                    <DadataAddressInput
                      id="delivery-address"
                      value={deliveryAddress}
                      onChange={setDeliveryAddress}
                      hasError={submitAttempted && !deliveryAddress.trim()}
                      placeholder="Город, улица, дом, квартира"
                      multiline
                      rows={2}
                      className={inputClass(submitAttempted && !deliveryAddress.trim())}
                    />
                  </div>
                )}
              </div>
            )}

            {fulfillmentMode && minOrderAmount > 0 && !meetsMinOrder && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                Минимальная сумма для этого способа — {formatMoney(minOrderAmount)}. Сейчас в корзине{' '}
                {formatMoney(orderTotal)}.
              </p>
            )}
          </div>
        </SectionCard>

        <section className="rounded-2xl border border-gray-200/80 bg-gradient-to-b from-white to-gray-50/80 p-4 shadow-sm sm:p-6">
          <OrderOfferConsent
            accepted={acceptedOffer}
            onChange={(v) => {
              setAcceptedOffer(v);
              if (v) setShowOfferError(false);
            }}
            showError={showOfferError}
          />
          <button
            type="button"
            onClick={handlePay}
            disabled={submitting}
            className="mt-4 w-full rounded-xl bg-indigo-600 px-4 py-3.5 text-base font-semibold text-white shadow-md transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? 'Переход к оплате…' : `Оплатить ${formatMoney(orderTotal)}`}
          </button>
        </section>
      </div>
    </div>
  );
}
