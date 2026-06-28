import React from 'react';
import { Link } from 'react-router-dom';

export default function PartDetailAboutBlock({ bodyDescription, isNew = false }) {
  const text = String(bodyDescription || '').trim();
  if (!text) return null;

  return (
    <section className="mt-5 border-t border-gray-200 pt-5">
      <h2 className="mb-3 text-sm font-semibold text-gray-900">О запчасти</h2>
      <p className="text-sm leading-relaxed text-gray-700">{text}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3.5">
          <h3 className="text-sm font-semibold text-gray-900">Доставка и оплата</h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            Доставка по России и самовывоз у продавца. Способы оплаты и сроки отправки
            согласуются при оформлении заказа.{' '}
            <Link to="/delivery" className="font-medium text-indigo-600 hover:text-indigo-800">
              Подробнее о доставке
            </Link>
          </p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50/80 p-3.5">
          <h3 className="text-sm font-semibold text-gray-900">
            {isNew ? 'Гарантия и комплектация' : 'Гарантия и осмотр'}
          </h3>
          <p className="mt-1.5 text-sm leading-relaxed text-gray-600">
            {isNew
              ? 'Новая запчасть. Состояние упаковки, комплектацию и условия гарантии уточняйте у продавца до оплаты.'
              : 'Б/у деталь рекомендуется осмотреть перед покупкой или запросить дополнительные фото и видео у продавца. Условия возврата уточняйте до оплаты.'}
          </p>
        </div>
      </div>
    </section>
  );
}
