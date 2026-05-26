import React from 'react';
import { CHECKOUT_PAYMENT_HINT } from '../../constants/checkoutLegal';
import OrderOfferConsent from './OrderOfferConsent';

/** Блок оплаты и согласия с офертой при оформлении заказа. */
export default function CheckoutPaymentAndOffer({
  acceptedOffer,
  onOfferChange,
  showOfferError = false,
}) {
  return (
    <div className="space-y-3">
      <div className="rounded-lg border border-blue-100 bg-blue-50/80 px-3 py-2.5 text-xs text-blue-800">
        {CHECKOUT_PAYMENT_HINT}
      </div>
      <OrderOfferConsent
        accepted={acceptedOffer}
        onChange={onOfferChange}
        showError={showOfferError}
      />
    </div>
  );
}
