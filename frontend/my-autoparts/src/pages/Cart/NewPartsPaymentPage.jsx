import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { QRCodeSVG } from 'qrcode.react';
import { trackConversion, CONVERSION_EVENTS } from '../../utils/siteAnalytics';
import {
    createCardPayment,
    fetchCart,
    fetchPaymentSession,
    selectPaymentSession,
    selectPaymentSessionError,
    selectPaymentSessionLoading,
} from '../../redux/slices/CartSlice';
import { useAuthReady } from '../../hooks/useAuthReady';
import { formatNewPartMoney } from '../AutoParts/NewParts/newPartStockUtils';
import { clearNewPartsCheckoutItemIds, clearNewPartsDeliverInParts } from '../../utils/newPartsCheckout';
import { clearNewCheckoutDraft } from '../../utils/checkoutDraft';
import ProductDetailStickyBar from '../../components/ProductDetail/ProductDetailStickyBar';
import { MOBILE_PRODUCT_STICKY_SCROLL_PAD } from '../../constants/mobileTokens';

const formatPrice = (price) => formatNewPartMoney(price);

export default function NewPartsPaymentPage() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const location = useLocation();
    const navigate = useNavigate();
    const dispatch = useDispatch();
    const { user, isReady } = useAuthReady();
    const session = useSelector(selectPaymentSession);
    const loading = useSelector(selectPaymentSessionLoading);
    const error = useSelector(selectPaymentSessionError);
    const [cardLoading, setCardLoading] = useState(false);
    const [cardError, setCardError] = useState(null);
    const trackedOrderRef = useRef(false);

    const loadSession = useCallback(() => {
        if (sessionId) {
            dispatch(fetchPaymentSession(sessionId));
        }
    }, [dispatch, sessionId]);

    useEffect(() => {
        if (!isReady || user) return;
        navigate('/auth', {
            replace: true,
            state: { from: `${location.pathname}${location.search}` },
        });
    }, [isReady, user, navigate, location.pathname, location.search]);

    useEffect(() => {
        if (!isReady || !user) return;
        loadSession();
    }, [isReady, user, loadSession]);

    useEffect(() => {
        const terminal = ['fulfilled', 'expired', 'fulfillment_failed', 'refunded'];
        if (terminal.includes(session?.status)) {
            return undefined;
        }
        const timer = setInterval(loadSession, 3000);
        return () => clearInterval(timer);
    }, [loadSession, session?.status]);

    useEffect(() => {
        if (session?.status === 'fulfilled' && session?.garage_order_id) {
            dispatch(fetchCart());
            clearNewPartsCheckoutItemIds();
            clearNewPartsDeliverInParts();
            clearNewCheckoutDraft();
        }
    }, [session?.status, session?.garage_order_id, dispatch]);

    useEffect(() => {
        const paid = session?.status === 'paid' || session?.status === 'fulfilled';
        if (!paid || trackedOrderRef.current) return;
        trackedOrderRef.current = true;
        trackConversion(CONVERSION_EVENTS.ORDER_PLACED, {
            path: `/cart/new/pay/${sessionId}`,
            section: 'new',
        });
    }, [session?.status, sessionId]);

    const handlePayByCard = async () => {
        setCardLoading(true);
        setCardError(null);
        try {
            const result = await dispatch(createCardPayment(sessionId)).unwrap();
            if (result?.confirmation_url) {
                window.location.href = result.confirmation_url;
                return;
            }
            setCardError('Не удалось получить ссылку на оплату картой');
        } catch (err) {
            setCardError(typeof err === 'string' ? err : 'Ошибка создания платежа');
        } finally {
            setCardLoading(false);
        }
    };

    if (!sessionId) {
        return (
            <div className="mx-auto max-w-lg px-4 py-16 text-center">
                <p className="text-gray-600">Сессия оплаты не найдена</p>
                <Link to="/cart" className="mt-4 inline-block text-brand-600 hover:underline">
                    В корзину
                </Link>
            </div>
        );
    }

    if (session?.status === 'fulfilled' && session?.garage_order_id) {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-green-200 bg-green-50 p-6 text-center">
                <h1 className="text-xl font-bold text-gray-900">Оплата прошла успешно</h1>
                <p className="mt-2 text-sm text-gray-700">
                    Заказ №{session.garage_order_id} оформлен. Мы отправим его поставщику.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Link
                        to="/purchases/orders"
                        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                        Мои заказы
                    </Link>
                    <Link
                        to="/autoparts/new"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        В каталог
                    </Link>
                </div>
            </div>
        );
    }

    if (session?.status === 'refunded') {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
                <h1 className="text-xl font-bold text-gray-900">Заказ не оформлен</h1>
                <p className="mt-2 text-sm text-gray-700">
                    Оплата прошла, но создать заказ не удалось. Средства возвращены на тот же
                    способ оплаты. Срок зачисления зависит от банка (обычно до нескольких дней).
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-center">
                    <Link
                        to="/cart/new/checkout"
                        className="rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                    >
                        Оформить снова
                    </Link>
                    <Link
                        to="/cart"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        В корзину
                    </Link>
                </div>
            </div>
        );
    }

    if (session?.status === 'refund_pending') {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-blue-200 bg-blue-50 p-6 text-center">
                <h1 className="text-xl font-bold text-gray-900">Возврат средств</h1>
                <p className="mt-2 text-sm text-gray-700">
                    Заказ не был создан. Возврат оплаты обрабатывается — обновите страницу через
                    минуту.
                </p>
                <button
                    type="button"
                    onClick={loadSession}
                    className="mt-4 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-brand-700"
                >
                    Обновить статус
                </button>
            </div>
        );
    }

    if (session?.status === 'fulfillment_failed') {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h1 className="text-xl font-bold text-gray-900">Заказ не оформлен</h1>
                <p className="mt-2 text-sm text-gray-700">
                    Оплата прошла, но заказ создать не удалось. Автоматический возврат не
                    выполнен — свяжитесь с поддержкой, мы вернём средства вручную.
                </p>
                <div className="mt-6 flex flex-col gap-2 sm:flex-row">
                    <Link
                        to="/purchases/orders"
                        className="rounded-xl bg-brand-600 px-4 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
                    >
                        Мои заказы
                    </Link>
                    <Link
                        to="/cart"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        В корзину
                    </Link>
                    <Link
                        to="/about"
                        className="rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-center text-sm font-semibold text-gray-700 hover:bg-gray-50"
                    >
                        Контакты
                    </Link>
                </div>
            </div>
        );
    }

    if (session?.status === 'expired') {
        return (
            <div className="mx-auto max-w-lg px-4 py-16 text-center">
                <h1 className="text-lg font-semibold text-gray-900">Время оплаты истекло</h1>
                <p className="mt-2 text-sm text-gray-600">Вернитесь в корзину и начните оформление заново.</p>
                <Link
                    to="/cart/new/checkout"
                    className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white"
                >
                    К оформлению
                </Link>
            </div>
        );
    }

    const qrValue = session?.qr_payload || '';
    const isCardReturn = searchParams.get('card') === '1';
    const showStickyPay = session?.status === 'awaiting_payment' || session?.status === 'paid';
    const statusLabel = session?.status === 'paid'
        ? 'Платёж обрабатывается…'
        : session?.sbp_payment_status
            ? `Статус: ${session.sbp_payment_status}`
            : 'Ожидание оплаты';

    if (loading && !session) {
        return (
            <div className={`mx-auto max-w-5xl px-4 py-6 md:py-10 ${MOBILE_PRODUCT_STICKY_SCROLL_PAD}`}>
                <div className="mb-6 h-6 w-48 animate-pulse rounded bg-surface-muted" />
                <div className="grid gap-6 lg:grid-cols-2">
                    <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
                    <div className="h-80 animate-pulse rounded-2xl bg-surface-muted" />
                </div>
            </div>
        );
    }

    return (
        <div className={`mx-auto max-w-5xl px-4 py-6 md:py-10 ${showStickyPay ? MOBILE_PRODUCT_STICKY_SCROLL_PAD : ''}`}>
            <div className="mb-6">
                <Link to="/cart/new/checkout" className="text-sm text-brand-600 hover:underline">
                    ← Назад к оформлению
                </Link>
                <h1 className="mt-2 text-2xl font-bold text-gray-900">Оплата заказа</h1>
                <p className="mt-1 text-sm text-gray-600">
                    Сумма к оплате:{' '}
                    <span className="font-semibold text-gray-900">
                        {formatPrice(session?.amount)}
                    </span>
                </p>
                {isCardReturn && session?.status === 'paid' && (
                    <p className="mt-2 text-sm text-green-700">Платёж обрабатывается…</p>
                )}
            </div>

            {(error || cardError) && (
                <div className="mb-4 rounded-lg border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
                    {error || cardError}
                </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">СБП — QR-код</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Отсканируйте код в приложении банка
                    </p>
                    <div className="mt-6 flex flex-col items-center justify-center">
                        {qrValue ? (
                            <div className="rounded-xl border border-gray-100 bg-white p-4 shadow-inner">
                                <QRCodeSVG value={qrValue} size={220} level="M" />
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">
                                {loading ? 'Загрузка QR…' : 'QR-код недоступен'}
                            </p>
                        )}
                        {session?.sbp_payment_status && (
                            <p className="mt-3 text-xs text-gray-500">
                                Статус: {session.sbp_payment_status}
                            </p>
                        )}
                    </div>
                </section>

                <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-900">Банковская карта</h2>
                    <p className="mt-1 text-sm text-gray-600">
                        Visa, Mastercard, Мир — оплата на защищённой странице ЮKassa
                    </p>
                    <div className="mt-8 flex flex-col items-center gap-4">
                        <div className="flex h-24 w-full max-w-xs items-center justify-center rounded-xl border border-gray-100 bg-gradient-to-br from-brand-50 to-gray-50">
                            <span className="text-4xl" aria-hidden>
                                💳
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handlePayByCard}
                            disabled={cardLoading || session?.status !== 'awaiting_payment'}
                            className="w-full max-w-xs rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50 max-lg:hidden"
                        >
                            {cardLoading ? 'Перенаправление…' : 'Оплатить картой'}
                        </button>
                        {session?.card_payment_status && (
                            <p className="text-xs text-gray-500">
                                Статус: {session.card_payment_status}
                            </p>
                        )}
                    </div>
                </section>
            </div>

            <p className="mt-6 text-center text-xs text-gray-500">
                После успешной оплаты заказ будет автоматически отправлен поставщику
            </p>

            {showStickyPay ? (
                <ProductDetailStickyBar
                    ariaLabel="Действия с заказом"
                    priceLabel="К оплате"
                    priceValue={formatPrice(session?.amount)}
                    meta={statusLabel}
                    className="lg:hidden"
                >
                    <button
                        type="button"
                        onClick={handlePayByCard}
                        disabled={cardLoading || session?.status !== 'awaiting_payment'}
                        className="min-h-11 w-full rounded-xl bg-brand-600 px-5 text-sm font-semibold text-white shadow-sm hover:bg-brand-700 disabled:opacity-50"
                    >
                        {cardLoading ? 'Перенаправление…' : 'Оплатить картой'}
                    </button>
                </ProductDetailStickyBar>
            ) : null}
        </div>
    );
}
