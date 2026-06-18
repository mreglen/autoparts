import React from 'react';
import { Link } from 'react-router-dom';
import { resolveProductCity } from '../../utils/productSearchSeo';

function SpecRow({ label, children }) {
  return (
    <div className="grid grid-cols-[7.5rem_1fr] gap-2 border-b border-gray-100 py-2.5 last:border-b-0">
      <dt className="text-xs font-semibold uppercase tracking-wide text-gray-500">{label}</dt>
      <dd className="text-sm text-gray-900">{children}</dd>
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

  return (
    <section className="mt-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-gray-900">
        Характеристики
      </h2>
      <dl>
        {partTypeName ? <SpecRow label="Тип детали">{partTypeName}</SpecRow> : null}
        <SpecRow label="Состояние">{conditionLabel}</SpecRow>
        {brand ? <SpecRow label="Бренд">{brand}</SpecRow> : null}
        {article ? <SpecRow label="Артикул">{article}</SpecRow> : null}
        <SpecRow label="Город">{city}</SpecRow>
        <SpecRow label="Доставка">
          <span>
            Доставка по России, самовывоз — уточняйте у продавца.{' '}
            <Link to="/delivery" className="font-medium text-indigo-600 hover:text-indigo-800">
              Подробнее
            </Link>
          </span>
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
