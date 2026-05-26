import React from 'react';
import LegalDocumentPage from '../../components/Legal/LegalDocumentPage';
import { PERSONAL_DATA_CONSENT_PARAGRAPHS } from '../../content/legalTexts';

export default function PersonalDataConsentPage() {
  return (
    <LegalDocumentPage
      title="Согласие на обработку персональных данных"
      description="Согласие пользователя на обработку персональных данных на сайте «Свой Гараж»."
      paragraphs={PERSONAL_DATA_CONSENT_PARAGRAPHS}
      relatedLinks={[
        { to: '/privacy', label: 'Политика конфиденциальности' },
        { to: '/about', label: 'О компании' },
      ]}
    />
  );
}
