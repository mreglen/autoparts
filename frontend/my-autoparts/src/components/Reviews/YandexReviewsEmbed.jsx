import React from 'react';
import { YANDEX_ORG_URL, YANDEX_REVIEWS_WIDGET_URL } from './reviewUtils';

export default function YandexReviewsEmbed({ compact = false }) {
  const height = compact ? 520 : 640;

  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm ring-1 ring-gray-100">
      <div className="border-b border-gray-100 bg-gradient-to-r from-gray-50 to-yellow-50/40 px-4 py-3 sm:px-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-semibold text-gray-900">Отзывы на Яндекс Картах</p>
            <p className="text-xs text-gray-500">Реальные оценки клиентов магазина «Свой Гараж»</p>
          </div>
          <a
            href={YANDEX_ORG_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
          >
            Открыть на Яндекс Картах
          </a>
        </div>
      </div>
      <div className="relative bg-white" style={{ height }}>
        <iframe
          title="Отзывы о Свой Гараж на Яндекс Картах"
          src={YANDEX_REVIEWS_WIDGET_URL}
          className="h-full w-full border-0"
          loading="lazy"
        />
      </div>
    </div>
  );
}
