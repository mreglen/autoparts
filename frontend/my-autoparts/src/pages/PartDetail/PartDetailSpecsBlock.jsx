import React from 'react';
import { Link } from 'react-router-dom';
import { resolveProductCity } from '../../utils/productSearchSeo';

function SpecRow({ label, children }) {
  return (
    <div className="grid grid-cols-[6.5rem_1fr] gap-x-3 gap-y-1 border-b border-gray-100 py-2.5 last:border-b-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-sm text-gray-500">{label}</dt>
      <dd className="text-sm font-medium text-gray-900">{children}</dd>
    </div>
  );
}

export default function PartDetailSpecsBlock({ product }) {
  if (!product) return null;

  const brand = (product.brand || '').trim();
  const article = (product.article || '').trim();
  const partTypeName = (product.part_type?.name || '').trim();
  const conditionLabel = product.is_new ? 'Новая' : 'Б/у';
  const city = resolveProductCity(product.organization);
  const seller = product.organization;
  const sellerName = (seller?.name || '').trim();
  const inStock = (product.quantity || 0) > 0;
  const stockLabel = inStock ? `${product.quantity} шт.` : 'Нет в наличии';

  return (
    <section className="mt-5 rounded-xl border border-gray-200 bg-white p-4">
      <h2 className="mb-1 text-sm font-semibold text-gray-900">Характеристики</h2>
      <dl className="mt-2">
        {partTypeName ? <SpecRow label="Тип детали">{partTypeName}</SpecRow> : null}
        <SpecRow label="Состояние">{conditionLabel}</SpecRow>
        {brand ? <SpecRow label="Бренд">{brand}</SpecRow> : null}
        {article ? <SpecRow label="Артикул">{article}</SpecRow> : null}
        {(product.internal_code || '').trim() ? (
          <SpecRow label="Код товара">
            <span className="font-mono text-gray-800">{String(product.internal_code).trim()}</span>
          </SpecRow>
        ) : null}
        <SpecRow label="Наличие">
          <span className={inStock ? 'text-green-700' : 'text-amber-700'}>{stockLabel}</span>
        </SpecRow>
        <SpecRow label="Город">{city}</SpecRow>
        <SpecRow label="Доставка">
          <span>
            Доставка по России, самовывоз — у продавца.{' '}
            <Link to="/delivery" className="font-medium text-indigo-600 hover:text-indigo-800">
              Подробнее
            </Link>
          </span>
        </SpecRow>
        <SpecRow label={product.is_new ? 'Гарантия' : 'Осмотр'}>
          {product.is_new
            ? 'Новая деталь. Комплектацию и гарантию уточняйте у продавца.'
            : 'Рекомендуем осмотреть деталь или запросить фото/видео у продавца.'}
        </SpecRow>
        {seller?.id && sellerName ? (
          <SpecRow label="Продавец">
            <Link
              to={`/organizations/${seller.id}`}
              className="font-medium text-indigo-600 hover:text-indigo-800"
            >
              {sellerName}
            </Link>
          </SpecRow>
        ) : null}
      </dl>
    </section>
  );
}
