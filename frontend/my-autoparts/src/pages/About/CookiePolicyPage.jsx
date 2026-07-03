import React from 'react';
import LegalDocumentPage from '../../components/Legal/LegalDocumentPage';
import YandexWebmasterCounter from '../../components/Seo/YandexWebmasterCounter';
import { COOKIE_POLICY_PARAGRAPHS } from '../../content/legalTexts';

export default function CookiePolicyPage() {
  return (
    <>
      <LegalDocumentPage
        title="Политика обработки cookie"
        path="/cookie-policy"
        description="Информация об использовании файлов cookie на сайте «Свой Гараж»."
        paragraphs={COOKIE_POLICY_PARAGRAPHS}
        relatedLinks={[
          { to: '/privacy', label: 'Политика конфиденциальности' },
          { to: '/about', label: 'О компании' },
        ]}
      />
      <div className="max-w-3xl mx-auto px-4">
        <YandexWebmasterCounter />
      </div>
    </>
  );
}
