import React from 'react';
import { Link } from 'react-router-dom';

export default function PartDetailAboutBlock({ bodyDescription, isNew = false }) {
  const text = String(bodyDescription || '').trim();
  if (!text) return null;

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-gray-900">О запчасти</h2>
      <p className="mt-2.5 text-sm leading-relaxed text-gray-700">{text}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-100 text-indigo-700">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-gray-900">Доставка и оплата</h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Доставка по России и самовывоз у продавца. Способы оплаты и сроки отправки
            согласуются при оформлении заказа.{' '}
            <Link to="/delivery" className="font-medium text-indigo-600 hover:text-indigo-800">
              Подробнее
            </Link>
          </p>
        </div>
        <div className="rounded-lg border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4">
          <div className="flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-amber-100 text-amber-800">
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </span>
            <h3 className="text-sm font-semibold text-gray-900">
              {isNew ? 'Гарантия и комплектация' : 'Гарантия и осмотр'}
            </h3>
          </div>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            {isNew
              ? 'Новая запчасть. Состояние упаковки, комплектацию и условия гарантии уточняйте у продавца до оплаты.'
              : 'Б/у деталь рекомендуется осмотреть перед покупкой или запросить дополнительные фото и видео у продавца. Условия возврата уточняйте до оплаты.'}
          </p>
        </div>
      </div>
    </section>
  );
}
