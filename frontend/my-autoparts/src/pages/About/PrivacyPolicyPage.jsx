import React from 'react';
import LegalDocumentPage from '../../components/Legal/LegalDocumentPage';
import { PRIVACY_POLICY_PARAGRAPHS } from '../../content/legalTexts';

export default function PrivacyPolicyPage() {
  return (
    <LegalDocumentPage
      title="Политика конфиденциальности"
      description="Политика конфиденциальности интернет-магазина «Свой Гараж»."
      paragraphs={PRIVACY_POLICY_PARAGRAPHS}
      relatedLinks={[
        { to: '/personal-data-consent', label: 'Согласие на обработку персональных данных' },
        { to: '/cookie-policy', label: 'Политика обработки cookie' },
        { to: '/about', label: 'О компании' },
      ]}
    />
  );
}
