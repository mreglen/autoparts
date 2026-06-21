import React from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoThumbnail from '../PhotoGallery/PhotoThumbnail';
import { stripHtmlTags } from '../../utils/text';
import {
  formatStockInDate,
  formatStockInMoney,
  getStockInLineTotal,
} from '../../utils/stockInUi';
import { formatInternalCodeDisplay } from '../../utils/internalCode';

function DetailBlock({ label, children }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 whitespace-pre-wrap">{children || '—'}</dd>
    </div>
  );
}

export default function StockInCard({ doc, isExpanded, onToggle, onImageClick }) {
  const navigate = useNavigate();
  const product = doc.product || {};
  const qty = Number(doc.quantity || 0);
  const unitPrice = Number(doc.sale_price || 0);
  const lineTotal = getStockInLineTotal(doc);
  const storageLabel =
    doc.storage_location?.address || (doc.storage_location_id ? `Склад #${doc.storage_location_id}` : '—');

  const handleOpenProduct = (e) => {
    e?.stopPropagation?.();
    if (product.id) navigate(`/part/${product.id}`);
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isExpanded
          ? 'border-emerald-200 shadow-md ring-1 ring-emerald-100'
          : 'border-gray-200/80 hover:border-emerald-200/60 hover:shadow'
      }`}
    >
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-900 ring-1 ring-emerald-100">
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 4v16m8-8H4"
                  />
                </svg>
                Поступление · #{doc.id}
              </span>
              <span className="text-sm text-gray-500">{formatStockInDate(doc.created_at)}</span>
              {product.internal_code && (
                <span className="font-mono text-xs text-gray-400">#{formatInternalCodeDisplay(product.internal_code)}</span>
              )}
            </div>

            <div>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-sm text-gray-600">
                {product.brand && <span className="font-semibold text-gray-900">{product.brand}</span>}
                {product.article && (
                  <>
                    <span className="text-gray-300" aria-hidden>
                      ·
                    </span>
                    <span className="font-mono">{product.article}</span>
                  </>
                )}
              </div>
              {product.id ? (
                <button
                  type="button"
                  onClick={handleOpenProduct}
                  className="text-left text-base font-semibold text-gray-900 hover:text-emerald-700 hover:underline"
                >
                  {product.name || 'Без названия'}
                </button>
              ) : (
                <h3 className="text-base font-semibold text-gray-900">{product.name || 'Без названия'}</h3>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-end gap-3 lg:flex-col lg:items-end">
            <div className="text-left lg:text-right">
              <div className="text-xs font-medium text-gray-500">
                {qty > 1 ? 'Сумма поступления' : 'Цена'}
              </div>
              <div className="text-xl font-bold tabular-nums text-gray-900">
                {unitPrice > 0 ? formatStockInMoney(qty > 1 ? lineTotal : unitPrice) : '—'}
              </div>
              {qty > 0 && unitPrice > 0 && (
                <div className="text-xs text-gray-500">
                  {qty} шт. × {formatStockInMoney(unitPrice)}
                </div>
              )}
              {qty > 0 && unitPrice <= 0 && (
                <div className="text-xs text-gray-500">{qty} шт.</div>
              )}
            </div>
            <span
              className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${
                product.is_new
                  ? 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
                  : 'bg-violet-50 text-violet-800 ring-1 ring-violet-100'
              }`}
            >
              {product.is_new ? 'Новый' : 'Б/У'}
            </span>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(doc.id)}
        className="flex w-full items-center justify-between bg-emerald-50/50 px-4 py-3 text-left sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-500"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-emerald-800">
          {isExpanded ? 'Скрыть детали' : 'Фото, описание и склад'}
        </span>
        <svg
          className={`h-5 w-5 text-emerald-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {isExpanded && (
        <div className="border-t border-gray-100 bg-gradient-to-b from-gray-50/80 to-white px-4 py-4 sm:px-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            <div>
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Медиа</h4>
              <div className="mt-2">
                <PhotoThumbnail
                  photos={product.photos || []}
                  videos={product.videos || []}
                  onImageClick={onImageClick}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Описание</h4>
                <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">
                  {stripHtmlTags(product.description) || '—'}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <DetailBlock label="Дата поступления">{formatStockInDate(doc.created_at)}</DetailBlock>
                <DetailBlock label="Склад">{storageLabel}</DetailBlock>
                <DetailBlock label="Ответственный">{doc.creator_name}</DetailBlock>
                <DetailBlock label="Количество">{qty > 0 ? `${qty} шт.` : null}</DetailBlock>
              </dl>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
