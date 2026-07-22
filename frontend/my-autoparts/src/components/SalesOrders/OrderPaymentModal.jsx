import React, { useEffect, useState } from 'react';

/**
 * Two-step payment modal: choose method → confirm payment.
 * Supports whole order or a single line item.
 */
export default function OrderPaymentModal({
  isOpen,
  order,
  item = null,
  methods = [],
  methodsLoading = false,
  methodsError = '',
  isSubmitting = false,
  error = '',
  formatPrice,
  onClose,
  onConfirm,
}) {
  const [step, setStep] = useState('select'); // select | confirm
  const [selectedMethod, setSelectedMethod] = useState(null);

  useEffect(() => {
    if (!isOpen) {
      setStep('select');
      setSelectedMethod(null);
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!isOpen || !order) return null;

  const lineAmount = item
    ? Number(item.price || 0) * Number(item.quantity || 0)
    : Number(order.total_amount || 0);
  const amountLabel = typeof formatPrice === 'function'
    ? formatPrice(lineAmount)
    : `${lineAmount.toLocaleString('ru-RU')} ₽`;
  const itemTitle = item
    ? (item.product_name || item.name || 'Позиция')
    : null;

  const handleSelect = (method) => {
    setSelectedMethod(method);
    setStep('confirm');
  };

  const handleBack = () => {
    setStep('select');
    setSelectedMethod(null);
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-payment-title"
        className="flex max-h-[90dvh] w-full max-w-md flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl"
      >
        <div className="border-b border-gray-100 px-4 py-3 sm:px-5">
          <h2 id="order-payment-title" className="text-base font-semibold text-gray-900">
            {step === 'select' ? 'Способ оплаты' : 'Подтверждение оплаты'}
          </h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Заказ #{order.id}
            {itemTitle ? ` · ${itemTitle}` : ''}
            {' · '}
            {amountLabel}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-4 sm:px-5">
          {step === 'select' ? (
            <>
              {methodsLoading ? (
                <div className="animate-pulse space-y-2">
                  <div className="h-12 rounded-xl bg-gray-100" />
                  <div className="h-12 rounded-xl bg-gray-100" />
                  <div className="h-12 rounded-xl bg-gray-100" />
                </div>
              ) : methodsError ? (
                <p className="text-sm text-red-600">{methodsError}</p>
              ) : methods.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Нет назначенных способов оплаты. Включите их в настройках организации.
                </p>
              ) : (
                <div className="space-y-2">
                  {methods.map((method) => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => handleSelect(method)}
                      disabled={isSubmitting}
                      className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-gray-50/80 px-4 py-3 text-left transition hover:border-amber-300 hover:bg-amber-50/60"
                    >
                      <span>
                        <span className="block text-sm font-semibold text-gray-900">{method.name}</span>
                        {method.description ? (
                          <span className="mt-0.5 block text-xs text-gray-500">{method.description}</span>
                        ) : null}
                      </span>
                      <span className="text-gray-400" aria-hidden>
                        →
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-gray-700">Подтвердить оплату?</p>
              <div className="rounded-xl border border-amber-100 bg-amber-50/80 px-4 py-3 text-sm">
                <div className="flex justify-between gap-3">
                  <span className="text-gray-600">Способ</span>
                  <span className="font-medium text-gray-900">{selectedMethod?.name}</span>
                </div>
                <div className="mt-2 flex justify-between gap-3">
                  <span className="text-gray-600">Сумма</span>
                  <span className="font-semibold tabular-nums text-gray-900">{amountLabel}</span>
                </div>
              </div>
              {error ? <p className="text-sm text-red-600">{error}</p> : null}
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-gray-100 px-4 py-3 sm:px-5">
          {step === 'confirm' ? (
            <>
              <button
                type="button"
                onClick={handleBack}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
              >
                Назад
              </button>
              <button
                type="button"
                onClick={() => onConfirm?.(selectedMethod)}
                disabled={isSubmitting || !selectedMethod}
                className="flex-1 rounded-xl bg-amber-500 px-3 py-2.5 text-sm font-semibold text-white hover:bg-amber-600 disabled:opacity-50"
              >
                {isSubmitting ? 'Сохранение…' : 'Подтвердить'}
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
