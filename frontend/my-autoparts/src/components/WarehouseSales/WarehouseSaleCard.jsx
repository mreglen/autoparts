import React from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoThumbnail from '../PhotoGallery/PhotoThumbnail';
import {
  formatWarehouseMoney,
  formatWarehouseSaleDate,
  getSaleSourceMeta,
} from '../../utils/warehouseSaleUi';

function getUserDisplayName(user) {
  if (!user) return '—';
  const parts = [user.last_name, user.first_name, user.patronymic].filter(Boolean);
  return parts.join(' ') || '—';
}

export default function WarehouseSaleCard({
  sale,
  isExpanded,
  onToggle,
  storageAddress,
}) {
  const navigate = useNavigate();
  const product = sale.product || {};
  const sourceMeta = getSaleSourceMeta(sale);
  const qty = Number(sale.quantity || 0);
  const unitPrice = Number(sale.sale_price || 0);
  const lineTotal = unitPrice * qty;
  const vehicles = product.compatible_vehicles || [];

  const handleOpenProduct = (e) => {
    e?.stopPropagation?.();
    if (product.id) navigate(`/part/${product.id}`);
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isExpanded
          ? 'border-amber-200 shadow-md ring-1 ring-amber-100'
          : 'border-gray-200/80 hover:border-amber-200/60 hover:shadow'
      }`}
    >
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ${sourceMeta.className}`}
              >
                {sourceMeta.label}
              </span>
              <span className="text-sm text-gray-500">{formatWarehouseSaleDate(sale.movement_date)}</span>
              {product.internal_code && (
                <span className="font-mono text-xs text-gray-400">#{product.internal_code}</span>
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
                  className="text-left text-base font-semibold text-gray-900 hover:text-amber-700 hover:underline"
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
              <div className="text-xs font-medium text-gray-500">Сумма продажи</div>
              <div className="text-xl font-bold tabular-nums text-gray-900">{formatWarehouseMoney(lineTotal)}</div>
              <div className="text-xs text-gray-500">
                {qty} шт. × {formatWarehouseMoney(unitPrice)}
              </div>
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
        onClick={() => onToggle(sale.id)}
        className="flex w-full items-center justify-between bg-amber-50/50 px-4 py-3 text-left sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-amber-500"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-amber-900">
          {isExpanded ? 'Скрыть детали' : 'Подробнее о продаже'}
        </span>
        <svg
          className={`h-5 w-5 text-amber-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
              <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Фото</h4>
              <div className="mt-2">
                <PhotoThumbnail photos={product.photos || []} />
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Описание</h4>
                <p className="mt-2 text-sm text-gray-900 whitespace-pre-wrap">
                  {product.description?.trim() || '—'}
                </p>
              </div>

              <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5">
                  <dt className="text-xs text-gray-500">Склад</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">{storageAddress}</dd>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5">
                  <dt className="text-xs text-gray-500">Ответственный</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">{getUserDisplayName(sale.user)}</dd>
                </div>
                <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5">
                  <dt className="text-xs text-gray-500">Дата списания</dt>
                  <dd className="mt-1 text-sm font-medium text-gray-900">
                    {formatWarehouseSaleDate(sale.movement_date)}
                  </dd>
                </div>
                {sale.avito_order_id && (
                  <div className="rounded-xl border border-sky-200/80 bg-sky-50/50 px-3 py-2.5">
                    <dt className="text-xs text-sky-700">Заказ Авито</dt>
                    <dd className="mt-1 font-mono text-sm font-medium text-sky-900">#{sale.avito_order_id}</dd>
                  </div>
                )}
              </dl>

              {vehicles.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Совместимость · {vehicles.length}
                  </h4>
                  <ul className="mt-2 space-y-2">
                    {vehicles.map((vehicle) => (
                      <li
                        key={vehicle.id}
                        className="rounded-xl border border-gray-200/80 bg-white p-3 text-sm"
                      >
                        <p className="font-medium text-gray-900">
                          {[vehicle.brand, vehicle.model].filter(Boolean).join(' ')}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">
                          {[vehicle.generation, vehicle.engine].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </article>
  );
}
