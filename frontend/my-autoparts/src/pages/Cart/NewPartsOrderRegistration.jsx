import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import {
    selectCart,
    selectCartLoading,
    fetchCart,
    createNewPartsPaymentSession,
} from '../../redux/slices/CartSlice';
import { apiAxios } from '../../utils/apiClient';
import { apiAxiosUnauth } from '../../utils/apiClient';
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
import CheckoutPaymentAndOffer from '../../components/Legal/CheckoutPaymentAndOffer';
import { formatProductDisplayTitle } from '../../utils/productDisplayName';

function formatApiErrorDetail(detail) {
    if (!detail) return 'Ошибка при оформлении заказа. Попробуйте ещё раз.';
    if (typeof detail === 'string') return detail;
    return 'Ошибка при оформлении заказа. Попробуйте ещё раз.';
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

function DeliveryOption({ id, checked, onChange, title, description, icon, value }) {
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
                name="deliveryOption"
                type="radio"
                value={value || id}
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

export default function NewPartsOrderRegistration() {
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, isReady } = useAuthReady();
    const cart = useSelector(selectCart);
    const cartLoading = useSelector(selectCartLoading);

    const seller = 'Новые запчасти';

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
    const [acceptedOffer, setAcceptedOffer] = useState(false);
    const [showOfferError, setShowOfferError] = useState(false);

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
            type: 'new',
            brand: item.brand,
            number: item.partnumber,
            name: formatProductDisplayTitle(item.brand, item.partnumber, item.name),
            price: Number(item.price),
            quantity: item.quantity,
        }));
    }, [cart]);

    useEffect(() => {
        if (!cartLoading && selectedItems.length === 0 && !orderSuccess) {
            navigate('/cart', { replace: true });
        }
    }, [cartLoading, selectedItems.length, navigate, orderSuccess]);

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
            (selectedDeliveryOption.delivery_type === 'pickup' || deliveryAddress.trim())
    );

    const deliveryType = selectedDeliveryOption?.delivery_type || '';
    const selectedTransportCompany = selectedDeliveryOption?.carrier || '';
    const pickupAddress =
        selectedDeliveryOption?.pickup_point ||
        adminOrgAddress ||
        'Адрес самовывоза уточняется';

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
                setAdminOrgAddress('');
            }
        };
        fetchAdminOrgAddress();
    }, []);

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
        setRecipient((prev) => ({ ...prev, fullName: normalizeFullName(prev.fullName) }));
    };

    const handlePhoneChange = (e) => {
        setRecipient((prev) => ({ ...prev, phone: formatPhoneInput(e.target.value) }));
    };

    const handlePhoneBlur = () => {
        markTouched('phone');
        setRecipient((prev) => ({ ...prev, phone: formatPhoneInput(prev.phone) }));
    };

    const handleEmailChange = (e) => {
        setRecipient((prev) => ({ ...prev, email: formatEmailInput(e.target.value) }));
    };

    const handleEmailBlur = () => {
        markTouched('email');
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

    const buildOrderPayload = () => ({
        recipient_name: normalizeFullName(recipient.fullName),
        recipient_phone: recipient.phone,
        recipient_email: normalizeEmail(recipient.email),
        delivery_type: deliveryType || 'pickup',
        delivery_region_id: selectedDeliveryOption
            ? Number(selectedDeliveryOption.region_id)
            : null,
        delivery_region_name: selectedDeliveryOption?.region_name || null,
        delivery_option_id: selectedDeliveryOption
            ? Number(selectedDeliveryOption.id)
            : null,
        ...(deliveryType === 'pickup' && { pickup_address: pickupAddress }),
        ...((deliveryType === 'pvz' || deliveryType === 'courier') && {
            transport_company: selectedTransportCompany,
            delivery_address: deliveryAddress.trim(),
        }),
    });

    const handleSubmitOrder = async () => {
        if (submitting || orderSuccess) return;
        if (!validateBeforeSubmit()) return;
        setShowOfferError(false);

        setSubmitting(true);
        setNotification(null);
        try {
            const result = await dispatch(
                createNewPartsPaymentSession(buildOrderPayload())
            ).unwrap();
            navigate(`/cart/new/pay/${result.session_id}`);
        } catch (err) {
            setNotification({
                type: 'error',
                message: formatApiErrorDetail(err),
            });
        } finally {
            setSubmitting(false);
        }
    };

    if (!isReady || cartLoading) {
        return (
            <div className="py-16 text-center text-gray-600">
                Загрузка…
            </div>
        );
    }

    if (orderSuccess) {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
                <h1 className="text-xl font-bold text-gray-900">Заказ оформлен</h1>
                <p className="mt-2 text-sm text-gray-700">{orderSuccess.message}</p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Link
                        to="/purchases/orders"
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
                    >
                        Мои заказы
                    </Link>
                    <Link
                        to="/cart"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                        В корзину
                    </Link>
                </div>
            </div>
        );
    }

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
                            {item.done ? '✓' : '·'}
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
            <button
                type="button"
                onClick={handleSubmitOrder}
                disabled={submitting || !isFormValid}
                className="hidden w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 md:flex"
            >
                {submitting ? 'Переход к оплате...' : 'Оплата'}
            </button>
        </div>
    );

    return (
        <div className="max-md:mt-0 mt-5 pb-28 md:pb-8">
            <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <p className="text-sm font-medium text-indigo-600">Оформление заказа</p>
                    <h1 className="max-md:text-xl text-2xl font-bold text-gray-900 sm:text-3xl">
                        Новые запчасти
                    </h1>
                </div>
                <button
                    type="button"
                    onClick={() => navigate('/cart')}
                    className="inline-flex items-center self-start rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                >
                    ← В корзину
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
                    <p
                        className={`text-sm font-medium ${
                            notification.type === 'success' ? 'text-green-800' : 'text-red-800'
                        }`}
                    >
                        {notification.message}
                    </p>
                </div>
            )}

            <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
                <div className="space-y-6 lg:col-span-8">
                    <SectionCard
                        title={`Состав заказа · ${selectedItems.length} поз.`}
                        subtitle={formatPrice(calculateTotal())}
                    >
                        <div className="space-y-3">
                            {selectedItems.map((item) => (
                                <div
                                    key={item.id}
                                    className="flex gap-3 rounded-xl border border-gray-100 bg-gray-50/60 p-3"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="text-sm font-medium text-gray-900 line-clamp-2">
                                            {item.name}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-600">
                                            {item.quantity} шт. × {formatPrice(item.price)}
                                        </p>
                                    </div>
                                    <p className="shrink-0 text-sm font-semibold text-gray-900">
                                        {formatPrice(item.price * item.quantity)}
                                    </p>
                                </div>
                            ))}
                        </div>
                    </SectionCard>

                    <SectionCard step={1} title="Получатель" subtitle="Контакты для связи по заказу">
                        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                            <MobileFormField
                                className="sm:col-span-2"
                                label="ФИО"
                                htmlFor="recipient-fullName"
                                required
                                error={showError('fullName')}
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
                        </div>
                    </SectionCard>

                    <SectionCard
                        step={2}
                        title="Доставка"
                        subtitle="Выберите регион и способ доставки"
                    >
                        {deliveryOptionsLoading ? (
                            <p className="text-sm text-gray-500">Загрузка способов доставки…</p>
                        ) : deliveryOptions.length === 0 ? (
                            <p className="text-sm text-red-600">
                                Способы доставки не настроены.{' '}
                                <Link to="/delivery" className="text-indigo-600 underline">
                                    Подробнее
                                </Link>
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
                                            checked={
                                                String(selectedDeliveryOptionId) === String(option.id)
                                            }
                                            onChange={() =>
                                                setSelectedDeliveryOptionId(String(option.id))
                                            }
                                            title={`${deliveryTypeLabels[option.delivery_type] || option.delivery_type}${
                                                option.carrier ? ` — ${option.carrier}` : ''
                                            }`}
                                            description={
                                                option.min_order_amount &&
                                                Number(option.min_order_amount) > 0
                                                    ? `Мин. сумма: ${Number(option.min_order_amount).toLocaleString('ru-RU')} ₽`
                                                    : option.notes || 'Доступно для региона'
                                            }
                                            icon={
                                                <svg
                                                    className="h-5 w-5"
                                                    fill="none"
                                                    viewBox="0 0 24 24"
                                                    stroke="currentColor"
                                                    strokeWidth={2}
                                                >
                                                    <path
                                                        strokeLinecap="round"
                                                        strokeLinejoin="round"
                                                        d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                                                    />
                                                </svg>
                                            }
                                        />
                                    ))}
                                </div>
                                {selectedDeliveryOption?.delivery_type === 'pickup' && (
                                    <div className="rounded-xl border border-indigo-100 bg-indigo-50/40 px-4 py-3">
                                        <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">
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
                                                ? 'Укажите адрес'
                                                : ''
                                        }
                                    >
                                        <DadataAddressInput
                                            id="delivery-address"
                                            value={deliveryAddress}
                                            onChange={setDeliveryAddress}
                                            locations={dadataLocations}
                                            hasError={submitAttempted && !deliveryAddress.trim()}
                                            className={inputClass(
                                                submitAttempted && !deliveryAddress.trim()
                                            )}
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
                            </div>
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
                    <div className="lg:sticky lg:top-24">
                        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                            <h3 className="text-base font-semibold text-gray-900">Итого по заказу</h3>
                            <p className="mt-0.5 text-sm text-gray-500">{seller}</p>
                            <div className="mt-4">{summaryBlock}</div>
                        </div>
                    </div>
                </aside>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-30 border-t border-gray-200 bg-white/95 p-3 shadow-lg backdrop-blur md:hidden">
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
                        {submitting ? '...' : 'Оплата'}
                    </button>
                </div>
            </div>
        </div>
    );
}
