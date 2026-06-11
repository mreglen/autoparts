import React from 'react';
import { Link } from 'react-router-dom';
import { formatProductDisplayTitle } from '../../../utils/productDisplayName';

function formatPrice(price) {
  const value = Number(price);
  if (!Number.isFinite(value) || value <= 0) return null;
  return `${value.toLocaleString('ru-RU')} ₽`;
}

export default function NewPartSeoCardTile({ card }) {
  const title = formatProductDisplayTitle(card?.brand, card?.article, card?.name);
  const priceText = formatPrice(card?.price);
  const to = card?.canonical_url?.startsWith('http')
    ? card.canonical_url.replace(/^https?:\/\/[^/]+/, '')
    : card?.canonical_url || `/autoparts/new/part/${card?.id}`;

  return (
    <Link
      to={to}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
    >
      <div className="aspect-[4/3] overflow-hidden bg-gray-50">
        {card?.image_url ? (
          <img
            src={card.image_url}
            alt={title}
            className="h-full w-full object-contain p-3 transition group-hover:scale-[1.02]"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-gray-400">Нет фото</div>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <p className="line-clamp-2 text-sm font-semibold text-gray-900 group-hover:text-indigo-700">
          {title}
        </p>
        <p className="mt-1 font-mono text-xs text-gray-500">
          {card?.brand} {card?.article}
        </p>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="text-base font-bold text-gray-900">{priceText || 'Цена по запросу'}</span>
          {card?.stock_count > 0 ? (
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              в наличии
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
