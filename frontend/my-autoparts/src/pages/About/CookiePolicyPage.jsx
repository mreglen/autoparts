import React from 'react';
import LegalDocumentPage from '../../components/Legal/LegalDocumentPage';
import { COOKIE_POLICY_PARAGRAPHS } from '../../content/legalTexts';

export default function CookiePolicyPage() {
  return (
    <LegalDocumentPage
      title="Политика обработки cookie"
      description="Информация об использовании файлов cookie на сайте «Свой Гараж»."
      paragraphs={COOKIE_POLICY_PARAGRAPHS}
      relatedLinks={[
        { to: '/privacy', label: 'Политика конфиденциальности' },
        { to: '/about', label: 'О компании' },
      ]}
    />
  );
}
