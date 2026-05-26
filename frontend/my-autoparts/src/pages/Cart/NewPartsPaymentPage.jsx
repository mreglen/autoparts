import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { QRCodeSVG } from 'qrcode.react';
import {
    createCardPayment,
    fetchCart,
    fetchPaymentSession,
    selectPaymentSession,
    selectPaymentSessionError,
    selectPaymentSessionLoading,
} from '../../redux/slices/CartSlice';

const formatPrice = (price) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(price || 0);

export default function NewPartsPaymentPage() {
    const { sessionId } = useParams();
    const [searchParams] = useSearchParams();
    const dispatch = useDispatch();
    const session = useSelector(selectPaymentSession);
    const loading = useSelector(selectPaymentSessionLoading);
    const error = useSelector(selectPaymentSessionError);
    const [cardLoading, setCardLoading] = useState(false);
    const [cardError, setCardError] = useState(null);

    const loadSession = useCallback(() => {
        if (sessionId) {
            dispatch(fetchPaymentSession(sessionId));
        }
    }, [dispatch, sessionId]);

    useEffect(() => {
        loadSession();
    }, [loadSession]);

    useEffect(() => {
        const terminal = ['fulfilled', 'expired', 'fulfillment_failed'];
        if (terminal.includes(session?.status)) {
            return undefined;
        }
        const timer = setInterval(loadSession, 3000);
        return () => clearInterval(timer);
    }, [loadSession, session?.status]);

    useEffect(() => {
        if (session?.status === 'fulfilled' && session?.garage_order_id) {
            dispatch(fetchCart());
        }
    }, [session?.status, session?.garage_order_id, dispatch]);

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
                <Link to="/cart" className="mt-4 inline-block text-indigo-600 hover:underline">
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
                        className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700"
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

    if (session?.status === 'fulfillment_failed') {
        return (
            <div className="mx-auto max-w-lg rounded-2xl border border-amber-200 bg-amber-50 p-6">
                <h1 className="text-xl font-bold text-gray-900">Оплата получена</h1>
                <p className="mt-2 text-sm text-gray-700">
                    Платёж прошёл, но при оформлении заказа у поставщика возникла ошибка.
                    Свяжитесь с поддержкой — мы поможем завершить заказ или вернём средства.
                </p>
                <Link
                    to="/about"
                    className="mt-4 inline-block text-sm font-medium text-indigo-600 hover:underline"
                >
                    Контакты
                </Link>
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
                    className="mt-4 inline-block rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
                >
                    К оформлению
                </Link>
            </div>
        );
    }

    const qrValue = session?.qr_payload || '';
    const isCardReturn = searchParams.get('card') === '1';

    return (
        <div className="mx-auto max-w-5xl px-4 py-6 md:py-10">
            <div className="mb-6">
                <Link to="/cart/new/checkout" className="text-sm text-indigo-600 hover:underline">
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
                        <div className="flex h-24 w-full max-w-xs items-center justify-center rounded-xl bg-gradient-to-br from-indigo-50 to-gray-50 border border-gray-100">
                            <span className="text-4xl" aria-hidden>
                                💳
                            </span>
                        </div>
                        <button
                            type="button"
                            onClick={handlePayByCard}
                            disabled={cardLoading || session?.status !== 'awaiting_payment'}
                            className="w-full max-w-xs rounded-xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
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
        </div>
    );
}
