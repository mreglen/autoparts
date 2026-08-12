import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import {
    fetchRosskoCheckoutDetails,
    fetchRosskoSettings,
    fetchRosskoMarkupSettings,
    saveRosskoSettings,
    saveRosskoMarkupSettings,
    clearRosskoAdminErrors,
} from '../../redux/slices/RosskoAdminSlice';
import { applyPublicMarkupSettings } from '../../redux/slices/PublicInfoSlice';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';

const inputClass =
    'block w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm shadow-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20';

export default function RosskoSettingsPage() {
    const dispatch = useDispatch();
    const navigate = useNavigate();
    const { isReady, user } = useAuthReady();
    const {
        checkoutDetails,
        settings,
        markupSettings,
        loadingDetails,
        loadingSettings,
        loadingMarkupSettings,
        saving,
        savingMarkup,
        error,
        saveError,
        markupSaveError,
    } = useSelector((state) => state.rosskoAdmin);

    const [form, setForm] = useState({
        delivery_id: '',
        address_id: '',
        payment_id: '',
        requisite_id: '',
        contact_name: '',
        contact_phone: '',
        default_comment: '',
        delivery_parts: false,
        delivery_name: '',
        address_label: '',
        payment_name: '',
        requisite_name: '',
        is_pickup: false,
        requires_address: true,
        requires_requisite: false,
    });
    const [markupForm, setMarkupForm] = useState({
        buyer_markup_percent: '30',
        seller_markup_percent: '15',
        autoservice_markup_percent: '7',
    });
    const [notification, setNotification] = useState(null);

    useEffect(() => {
        if (!isReady) return;
        if (!user?.is_admin) {
            navigate('/', { replace: true });
            return;
        }
        dispatch(clearRosskoAdminErrors());
        dispatch(fetchRosskoCheckoutDetails());
        dispatch(fetchRosskoSettings());
        dispatch(fetchRosskoMarkupSettings());
    }, [isReady, user, navigate, dispatch]);

    useEffect(() => {
        if (!markupSettings) return;
        setMarkupForm({
            buyer_markup_percent: String(markupSettings.buyer_markup_percent ?? 30),
            seller_markup_percent: String(markupSettings.seller_markup_percent ?? 15),
            autoservice_markup_percent: String(markupSettings.autoservice_markup_percent ?? 7),
        });
    }, [markupSettings]);

    useEffect(() => {
        if (!settings) return;
        setForm({
            delivery_id: settings.delivery_id || '',
            address_id: settings.address_id || '',
            payment_id: settings.payment_id != null ? String(settings.payment_id) : '',
            requisite_id: settings.requisite_id != null ? String(settings.requisite_id) : '',
            contact_name: settings.contact_name || '',
            contact_phone: settings.contact_phone || '',
            default_comment: settings.default_comment || '',
            delivery_parts: Boolean(settings.delivery_parts),
            delivery_name: settings.delivery_name || '',
            address_label: settings.address_label || '',
            payment_name: settings.payment_name || '',
            requisite_name: settings.requisite_name || '',
            is_pickup: Boolean(settings.is_pickup),
            requires_address: settings.requires_address !== false,
            requires_requisite: Boolean(settings.requires_requisite),
        });
    }, [settings]);

    const deliveries = checkoutDetails?.deliveries || [];
    const addresses = checkoutDetails?.addresses || [];
    const payments = checkoutDetails?.payments || [];
    const requisites = checkoutDetails?.requisites || [];

    const selectedDelivery = useMemo(
        () => deliveries.find((d) => String(d.id) === String(form.delivery_id)),
        [deliveries, form.delivery_id]
    );
    const selectedPayment = useMemo(
        () => payments.find((p) => String(p.id) === String(form.payment_id)),
        [payments, form.payment_id]
    );

    const requiresAddress = selectedDelivery ? !selectedDelivery.is_pickup : form.requires_address;
    const requiresRequisite = selectedPayment
        ? selectedPayment.requires_requisite
        : form.requires_requisite;

    const canSave = useMemo(() => {
        if (!form.delivery_id || !form.payment_id) return false;
        if (!form.contact_name.trim() || !form.contact_phone.trim()) return false;
        if (requiresAddress && !form.address_id) return false;
        if (requiresRequisite && !form.requisite_id) return false;
        return true;
    }, [form, requiresAddress, requiresRequisite]);

    const handleDeliveryChange = useCallback(
        (deliveryId) => {
            const delivery = deliveries.find((d) => String(d.id) === String(deliveryId));
            setForm((prev) => ({
                ...prev,
                delivery_id: deliveryId,
                delivery_name: delivery?.label || '',
                is_pickup: Boolean(delivery?.is_pickup),
                requires_address: delivery ? !delivery.is_pickup : true,
                address_id: delivery?.is_pickup ? '' : prev.address_id,
                address_label: delivery?.is_pickup ? '' : prev.address_label,
            }));
        },
        [deliveries]
    );

    const handlePaymentChange = useCallback(
        (paymentId) => {
            const payment = payments.find((p) => String(p.id) === String(paymentId));
            setForm((prev) => ({
                ...prev,
                payment_id: paymentId,
                payment_name: payment?.label || '',
                requires_requisite: Boolean(payment?.requires_requisite),
            }));
        },
        [payments]
    );

    const handleRefreshCheckoutDetails = useCallback(() => {
        setNotification(null);
        dispatch(clearRosskoAdminErrors());
        dispatch(fetchRosskoCheckoutDetails());
    }, [dispatch]);

    const handleSave = async () => {
        if (!canSave || saving) return;
        setNotification(null);
        const address = addresses.find((a) => String(a.id) === String(form.address_id));
        const requisite = requisites.find((r) => String(r.id) === String(form.requisite_id));

        const payload = {
            delivery_id: form.delivery_id,
            address_id: requiresAddress ? form.address_id : null,
            payment_id: Number(form.payment_id),
            requisite_id: form.requisite_id ? Number(form.requisite_id) : null,
            contact_name: form.contact_name.trim(),
            contact_phone: form.contact_phone.trim(),
            default_comment: form.default_comment.trim() || null,
            delivery_parts: form.delivery_parts,
            delivery_name: form.delivery_name || selectedDelivery?.label,
            address_label: requiresAddress ? (form.address_label || address?.label) : null,
            payment_name: form.payment_name || selectedPayment?.label,
            requisite_name: form.requisite_id
                ? form.requisite_name || requisite?.label
                : null,
            is_pickup: Boolean(selectedDelivery?.is_pickup),
            requires_address: requiresAddress,
            requires_requisite: requiresRequisite,
        };

        try {
            await dispatch(saveRosskoSettings(payload)).unwrap();
            setNotification({ type: 'success', message: 'Настройки Rossko сохранены' });
        } catch (err) {
            setNotification({ type: 'error', message: err || 'Не удалось сохранить' });
        }
    };

    const canSaveMarkup = useMemo(() => {
        const buyer = Number(markupForm.buyer_markup_percent);
        const seller = Number(markupForm.seller_markup_percent);
        const autoservice = Number(markupForm.autoservice_markup_percent);
        return [buyer, seller, autoservice].every((n) => Number.isFinite(n) && n >= 0);
    }, [markupForm]);

    const handleSaveMarkup = async () => {
        if (!canSaveMarkup || savingMarkup) return;
        setNotification(null);
        const payload = {
            buyer_markup_percent: Number(markupForm.buyer_markup_percent),
            seller_markup_percent: Number(markupForm.seller_markup_percent),
            autoservice_markup_percent: Number(markupForm.autoservice_markup_percent),
        };
        try {
            const saved = await dispatch(saveRosskoMarkupSettings(payload)).unwrap();
            applyPublicMarkupSettings(dispatch, {
                buyerMarkupPercent: saved.buyer_markup_percent,
                autoserviceMarkupPercent: saved.autoservice_markup_percent,
            });
            setNotification({ type: 'success', message: 'Наценки сохранены' });
        } catch (err) {
            setNotification({ type: 'error', message: err || 'Не удалось сохранить наценки' });
        }
    };

    if (!isReady) return <AuthLoadingScreen />;

    const loading = loadingDetails || loadingSettings;

    return (
        <div className="w-full max-w-3xl">
            <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
                <div>
                    <p className="text-sm font-medium text-indigo-600">Админка</p>
                    <h1 className="text-2xl font-bold text-gray-900">Rossko — оформление заказов</h1>
                    <p className="mt-1 text-sm text-gray-600">
                        Доставка, оплата и реквизиты загружаются из GetCheckoutDetails (личный кабинет
                        Rossko).
                    </p>
                </div>
                <button
                    type="button"
                    onClick={handleRefreshCheckoutDetails}
                    disabled={loadingDetails}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                >
                    {loadingDetails ? 'Обновление…' : 'Обновить списки'}
                </button>
            </div>

            {(error || saveError || markupSaveError) && (
                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error || saveError || markupSaveError}
                </div>
            )}
            {notification && (
                <div
                    className={`mb-4 rounded-lg border px-4 py-3 text-sm ${
                        notification.type === 'success'
                            ? 'border-green-200 bg-green-50 text-green-800'
                            : 'border-red-200 bg-red-50 text-red-800'
                    }`}
                >
                    {notification.message}
                </div>
            )}

            {loading ? (
                <p className="text-gray-600">Загрузка…</p>
            ) : (
                <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Способ доставки *
                        </label>
                        <select
                            className={inputClass}
                            value={form.delivery_id}
                            onChange={(e) => handleDeliveryChange(e.target.value)}
                        >
                            <option value="">Выберите доставку</option>
                            {deliveries.map((d) => (
                                <option key={d.id} value={d.id}>
                                    {d.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {requiresAddress && (
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Адрес доставки *
                            </label>
                            <select
                                className={inputClass}
                                value={form.address_id}
                                onChange={(e) => {
                                    const addr = addresses.find(
                                        (a) => String(a.id) === String(e.target.value)
                                    );
                                    setForm((prev) => ({
                                        ...prev,
                                        address_id: e.target.value,
                                        address_label: addr?.label || '',
                                    }));
                                }}
                            >
                                <option value="">Выберите адрес</option>
                                {addresses.map((a) => (
                                    <option key={a.id} value={a.id}>
                                        {a.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Способ оплаты *
                        </label>
                        <select
                            className={inputClass}
                            value={form.payment_id}
                            onChange={(e) => handlePaymentChange(e.target.value)}
                        >
                            <option value="">Выберите оплату</option>
                            {payments.map((p) => (
                                <option key={p.id} value={p.id}>
                                    {p.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Реквизиты{requiresRequisite ? ' *' : ''}
                        </label>
                        {requisites.length === 0 ? (
                            <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-900">
                                Реквизиты не найдены. Добавьте их в личном кабинете на портале Rossko,
                                затем нажмите «Обновить списки».
                            </p>
                        ) : (
                            <select
                                className={inputClass}
                                value={form.requisite_id}
                                onChange={(e) => {
                                    const req = requisites.find(
                                        (r) => String(r.id) === String(e.target.value)
                                    );
                                    setForm((prev) => ({
                                        ...prev,
                                        requisite_id: e.target.value,
                                        requisite_name: req?.label || '',
                                    }));
                                }}
                            >
                                <option value="">Выберите реквизиты</option>
                                {requisites.map((r) => (
                                    <option key={r.id} value={r.id}>
                                        {r.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                ФИО контакта *
                            </label>
                            <input
                                type="text"
                                className={inputClass}
                                value={form.contact_name}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, contact_name: e.target.value }))
                                }
                            />
                        </div>
                        <div>
                            <label className="mb-1 block text-sm font-medium text-gray-700">
                                Телефон *
                            </label>
                            <input
                                type="tel"
                                className={inputClass}
                                value={form.contact_phone}
                                onChange={(e) =>
                                    setForm((prev) => ({ ...prev, contact_phone: e.target.value }))
                                }
                            />
                        </div>
                    </div>

                    <div>
                        <label className="mb-1 block text-sm font-medium text-gray-700">
                            Комментарий к заказу (по умолчанию)
                        </label>
                        <textarea
                            className={inputClass}
                            rows={3}
                            value={form.default_comment}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, default_comment: e.target.value }))
                            }
                        />
                    </div>

                    <label className="flex cursor-pointer items-center gap-2">
                        <input
                            type="checkbox"
                            checked={form.delivery_parts}
                            onChange={(e) =>
                                setForm((prev) => ({ ...prev, delivery_parts: e.target.checked }))
                            }
                            className="h-4 w-4 rounded border-gray-300 text-indigo-600"
                        />
                        <span className="text-sm font-medium text-gray-700">
                            Доставлять заказ по частям
                        </span>
                    </label>

                    {settings?.configured && (
                        <p className="text-sm text-green-700">
                            Настройки заполнены и готовы к оформлению заказов.
                        </p>
                    )}

                    <button
                        type="button"
                        onClick={handleSave}
                        disabled={!canSave || saving}
                        className="inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                    >
                        {saving ? 'Сохранение…' : 'Сохранить'}
                    </button>
                </div>
            )}

            <div className="mt-8 space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-6">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">Наценки для цен / автосервиса</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Покупатели — публичные цены новых запчастей. Продавцы — рабочая наценка в кабинете
                        продавца. Автосервис — значение по умолчанию в заказах автосервиса.
                    </p>
                </div>

                {loadingMarkupSettings ? (
                    <p className="text-gray-600">Загрузка наценок…</p>
                ) : (
                    <>
                        <div className="grid gap-4 sm:grid-cols-3">
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Покупатели, %
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    className={inputClass}
                                    value={markupForm.buyer_markup_percent}
                                    onChange={(e) =>
                                        setMarkupForm((prev) => ({
                                            ...prev,
                                            buyer_markup_percent: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Продавцы, %
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    className={inputClass}
                                    value={markupForm.seller_markup_percent}
                                    onChange={(e) =>
                                        setMarkupForm((prev) => ({
                                            ...prev,
                                            seller_markup_percent: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                            <div>
                                <label className="mb-1 block text-sm font-medium text-gray-700">
                                    Автосервис, %
                                </label>
                                <input
                                    type="number"
                                    min="0"
                                    step="0.1"
                                    className={inputClass}
                                    value={markupForm.autoservice_markup_percent}
                                    onChange={(e) =>
                                        setMarkupForm((prev) => ({
                                            ...prev,
                                            autoservice_markup_percent: e.target.value,
                                        }))
                                    }
                                />
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleSaveMarkup}
                            disabled={!canSaveMarkup || savingMarkup}
                            className="inline-flex rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {savingMarkup ? 'Сохранение…' : 'Сохранить наценки'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
