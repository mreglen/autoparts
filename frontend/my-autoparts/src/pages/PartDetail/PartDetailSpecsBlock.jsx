import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI';
import { resolveProductCity } from '../../utils/productSearchSeo';

function SpecRowCard({ label, children }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-x-4 gap-y-1 border-b border-line-soft py-3 last:border-b-0 sm:grid-cols-[8.5rem_1fr]">
      <dt className="text-sm text-ink-muted">{label}</dt>
      <dd className="text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function SpecRowInline({ label, children }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-dotted border-line py-2.5 last:border-b-0">
      <dt className="shrink-0 text-sm text-ink-muted">{label}</dt>
      <dd className="min-w-0 text-right text-sm font-medium text-ink">{children}</dd>
    </div>
  );
}

function PartDetailSpecsContent({ product, SpecRow }) {
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
    <>
      {partTypeName ? <SpecRow label="Тип детали">{partTypeName}</SpecRow> : null}
      <SpecRow label="Состояние">{conditionLabel}</SpecRow>
      {brand ? <SpecRow label="Бренд">{brand}</SpecRow> : null}
      {article ? <SpecRow label="Артикул">{article}</SpecRow> : null}
      {(product.internal_code || '').trim() ? (
        <SpecRow label="Код товара">
          <span className="font-mono text-ink-soft">{String(product.internal_code).trim()}</span>
        </SpecRow>
      ) : null}
      <SpecRow label="Наличие">
        <span className={inStock ? 'text-success-700' : 'text-warning-700'}>{stockLabel}</span>
      </SpecRow>
      <SpecRow label="Город">{city}</SpecRow>
      <SpecRow label="Доставка">
        <span>
          Доставка по России, самовывоз — у продавца.{' '}
          <Link to="/delivery" className="font-medium text-brand-600 hover:text-brand-800">
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
            className="font-medium text-brand-600 hover:text-brand-800"
          >
            {sellerName}
          </Link>
        </SpecRow>
      ) : null}
    </>
  );
}

export default function PartDetailSpecsBlock({ product, variant = 'card' }) {
  if (!product) return null;

  const SpecRow = variant === 'inline' ? SpecRowInline : SpecRowCard;

  if (variant === 'inline') {
    return (
      <section className="mt-5">
        <h2 className="text-base font-semibold text-ink">Характеристики</h2>
        <dl className="mt-2">
          <PartDetailSpecsContent product={product} SpecRow={SpecRow} />
        </dl>
      </section>
    );
  }

  return (
    <Card as="section" padding="sm" className="sm:p-5">
      <h2 className="text-base font-semibold text-ink">Характеристики</h2>
      <dl className="mt-2">
        <PartDetailSpecsContent product={product} SpecRow={SpecRow} />
      </dl>
    </Card>
  );
}
