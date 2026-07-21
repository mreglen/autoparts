import React, { useEffect } from 'react';
import { PartDetailContent } from './SellerWorkspaceDetailModals';
import OrderSourceBadge from '../../components/Orders/OrderSourceBadge';

const formatCurrency = (amount) =>
    new Intl.NumberFormat('ru-RU', { style: 'currency', currency: 'RUB' }).format(amount || 0);

const formatDate = (value) => {
    if (!value) return '—';
    try {
        return new Date(value).toLocaleString('ru-RU', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    } catch {
        return value;
    }
};

export default function ClientOrdersModal({
    isOpen,
    onClose,
    buyerOrders,
    loading,
    onOpenItem,
    selectedPart,
    onClosePart,
    onImageClick,
}) {
    const showingProduct = Boolean(selectedPart);

    useEffect(() => {
        if (!isOpen) return undefined;
        const onKey = (e) => {
            if (e.key !== 'Escape') return;
            if (showingProduct) {
                onClosePart();
            } else {
                onClose();
            }
        };
        document.addEventListener('keydown', onKey);
        const prev = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => {
            document.removeEventListener('keydown', onKey);
            document.body.style.overflow = prev;
        };
    }, [isOpen, onClose, onClosePart, showingProduct]);

    if (!isOpen) return null;

    const handleBackdropClick = () => {
        if (showingProduct) {
            onClosePart();
        } else {
            onClose();
        }
    };

    return (
        <div className="fixed inset-0 z-[100] overflow-y-auto">
            <div
                className="fixed inset-0 bg-black/50"
                onClick={handleBackdropClick}
                aria-hidden="true"
            />
            <div className="flex min-h-full items-center justify-center p-4">
                <div
                    className="relative w-full max-w-4xl bg-white rounded-xl shadow-xl max-h-[90vh] flex flex-col"
                    onClick={(e) => e.stopPropagation()}
                    role="dialog"
                    aria-modal="true"
                >
                    <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-gray-200 shrink-0">
                        <div className="min-w-0 flex-1">
                            {showingProduct ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={onClosePart}
                                        className="inline-flex items-center gap-1 text-sm font-medium text-indigo-600 hover:text-indigo-800 mb-1"
                                    >
                                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                                        </svg>
                                        Вернуться к заказам
                                    </button>
                                    <h2 className="text-lg font-semibold text-gray-900 truncate">
                                        {selectedPart.brand || '—'} · {selectedPart.article || '—'}
                                    </h2>
                                    {selectedPart.name && (
                                        <p className="text-sm text-gray-500 mt-0.5 truncate">{selectedPart.name}</p>
                                    )}
                                </>
                            ) : (
                                <>
                                    <h2 className="text-lg font-semibold text-gray-900">Заказы клиента</h2>
                                    {buyerOrders && (
                                        <p className="text-sm text-gray-500 mt-0.5 truncate">
                                            {buyerOrders.buyer_name || `${buyerOrders.buyer_email}`}
                                            {buyerOrders.buyer_phone ? ` · ${buyerOrders.buyer_phone}` : ''}
                                        </p>
                                    )}
                                </>
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={onClose}
                            className="shrink-0 p-1 text-gray-400 hover:text-gray-600 rounded-lg"
                            aria-label="Закрыть"
                        >
                            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                        </button>
                    </div>

                    <div className="px-5 py-4 overflow-y-auto">
                        {showingProduct ? (
                            <PartDetailContent
                                part={selectedPart}
                                onImageClick={onImageClick}
                                hideSiteLink
                            />
                        ) : loading ? (
                            <div className="flex justify-center py-16">
                                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
                            </div>
                        ) : !buyerOrders?.orders?.length ? (
                            <p className="text-center text-gray-500 py-12">Заказов не найдено</p>
                        ) : (
                            <div className="space-y-6">
                                {buyerOrders.orders.map((order) => (
                                    <section
                                        key={`${order.order_type}-${order.id}`}
                                        className="border border-gray-200 rounded-xl overflow-hidden"
                                    >
                                        <div className="bg-gray-50 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
                                            <div>
                                                <h3 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-gray-900">
                                                    <OrderSourceBadge
                                                        source={order.order_type === 'new' ? 'rossko' : 'used'}
                                                        size="sm"
                                                    />
                                                    <span>Заказ #{order.id}</span>
                                                </h3>
                                                <p className="text-xs text-gray-500 mt-0.5">
                                                    {formatDate(order.created_at)}
                                                    {' · '}
                                                    {order.status_code}
                                                    {order.is_paid ? ' · оплачен' : ''}
                                                </p>
                                            </div>
                                            <p className="text-sm font-semibold text-gray-900">
                                                {formatCurrency(order.total_amount)}
                                            </p>
                                        </div>
                                        <div className="divide-y divide-gray-100">
                                            {order.items.map((item) => (
                                                <button
                                                    key={item.id}
                                                    type="button"
                                                    onClick={() => onOpenItem(item)}
                                                    className="w-full text-left px-4 py-3 hover:bg-indigo-50/50 transition-colors flex flex-wrap items-center justify-between gap-2"
                                                >
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-sm font-medium text-gray-900">
                                                            {item.brand ? `${item.brand} · ` : ''}
                                                            {item.partnumber || '—'}
                                                        </p>
                                                        <p className="text-sm text-gray-600 line-clamp-2 mt-0.5">
                                                            {item.name}
                                                        </p>
                                                    </div>
                                                    <p className="text-sm font-medium text-gray-900 shrink-0">
                                                        {item.quantity} шт. × {formatCurrency(item.price)}
                                                    </p>
                                                </button>
                                            ))}
                                        </div>
                                    </section>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
