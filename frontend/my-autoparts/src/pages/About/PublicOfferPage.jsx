import React from 'react';
import LegalDocumentPage from '../../components/Legal/LegalDocumentPage';
import { PUBLIC_OFFER_PARAGRAPHS } from '../../content/legalTexts';

export default function PublicOfferPage() {
  return (
    <LegalDocumentPage
      title="Публичная оферта"
      path="/offer"
      description="Условия покупки товаров в интернет-магазине «Свой Гараж»."
      paragraphs={PUBLIC_OFFER_PARAGRAPHS}
      relatedLinks={[
        { to: '/delivery', label: 'Доставка' },
        { to: '/payment', label: 'Оплата' },
        { to: '/privacy', label: 'Политика конфиденциальности' },
        { to: '/about', label: 'О компании' },
      ]}
    />
  );
}
