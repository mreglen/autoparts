import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import PhotoThumbnail from '../PhotoGallery/PhotoThumbnail';
import { stripHtmlTags } from '../../utils/text';
import { useActionsDropdownPlacement } from '../../hooks/useActionsDropdownPlacement';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';
import {
  formatStockOutDate,
  formatStockOutMoney,
  getStockOutChannelMeta,
  getStockOutLineTotal,
  getStockOutOperationMeta,
  getStockOutUserName,
} from '../../utils/stockOutUi';

function DetailBlock({ label, children }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 whitespace-pre-wrap">{children || '—'}</dd>
    </div>
  );
}

export default function StockOutCard({
  item,
  storageLabel,
  isExpanded,
  isSelected,
  onToggle,
  onSelect,
  onReturn,
  onImageClick,
}) {
  const navigate = useNavigate();
  const [showActions, setShowActions] = useState(false);
  const actionsPlacement = useActionsDropdownPlacement(showActions, 56);

  const product = item.product || {};
  const operationMeta = getStockOutOperationMeta(item);
  const channelMeta = getStockOutChannelMeta(item);
  const qty = Number(item.quantity || 0);
  const unitPrice = Number(item.sale_price || 0);
  const lineTotal = getStockOutLineTotal(item);
  const vehicles = product.compatible_vehicles || [];

  useEffect(() => {
    if (!showActions) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest(`[data-stock-out-actions="${item.id}"]`)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions, item.id]);

  const handleOpenProduct = (e) => {
    e?.stopPropagation?.();
    if (product.id) navigate(`/part/${product.id}`);
  };

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isSelected
          ? 'border-rose-300 ring-2 ring-rose-200'
          : isExpanded
            ? 'border-rose-200 shadow-md ring-1 ring-rose-100'
            : 'border-gray-200/80 hover:border-rose-200/60 hover:shadow'
      }`}
    >
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex gap-3">
          <label className="mt-1 flex shrink-0 cursor-pointer items-start">
            <input
              type="checkbox"
              checked={isSelected}
              onChange={onSelect}
              onClick={(e) => e.stopPropagation()}
              className="h-4 w-4 rounded border-gray-300 text-rose-600 focus:ring-rose-500"
              aria-label={`Выбрать расход #${item.id}`}
            />
          </label>

          <div className="min-w-0 flex-1">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-900 ring-1 ring-rose-100">
                    <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                    </svg>
                    Расход · #{item.id}
                  </span>
                  <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${operationMeta.className}`}>
                    {operationMeta.label}
                  </span>
                  {channelMeta && (
                    <span className={`inline-flex rounded-lg px-2 py-0.5 text-xs font-semibold ${channelMeta.className}`}>
                      {channelMeta.label}
                    </span>
                  )}
                  {item.sale_channel === 'drom' && (
                    <span className="inline-flex rounded-lg bg-purple-50 px-2 py-0.5 text-xs font-semibold text-purple-800 ring-1 ring-purple-100">
                      Drom
                    </span>
                  )}
                  <span className="text-sm text-gray-500">{formatStockOutDate(item.movement_date)}</span>
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
                      className="text-left text-base font-semibold text-gray-900 hover:text-rose-700 hover:underline"
                    >
                      {product.name || 'Без названия'}
                    </button>
                  ) : (
                    <h3 className="text-base font-semibold text-gray-900">{product.name || 'Без названия'}</h3>
                  )}
                  {product.internal_code && (
                    <p className="mt-1 font-mono text-xs text-gray-400">#{product.internal_code}</p>
                  )}
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-3 lg:flex-col lg:items-end">
                <div className="text-left lg:text-right">
                  <div className="text-xs font-medium text-gray-500">
                    {qty > 1 && unitPrice > 0 ? 'Сумма' : 'Цена / кол-во'}
                  </div>
                  <div className="text-xl font-bold tabular-nums text-gray-900">
                    {unitPrice > 0 ? formatStockOutMoney(qty > 1 ? lineTotal : unitPrice) : `${qty} шт.`}
                  </div>
                  {qty > 0 && unitPrice > 0 && (
                    <div className="text-xs text-gray-500">
                      {qty} шт. × {formatStockOutMoney(unitPrice)}
                    </div>
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

                <div ref={actionsPlacement.anchorRef} className="relative" data-stock-out-actions={item.id}>
                  <button
                    type="button"
                    onClick={() => setShowActions((v) => !v)}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
                    aria-expanded={showActions}
                  >
                    Действия
                    <svg
                      className={`h-4 w-4 text-gray-500 transition-transform ${showActions ? 'rotate-180' : ''}`}
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      aria-hidden
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                  {showActions && (
                    <div className={buildActionsDropdownMenuClassName(actionsPlacement.openUp, 'w-48 z-50')}>
                      <button
                        type="button"
                        onClick={() => {
                          onReturn(item);
                          setShowActions(false);
                        }}
                        className="flex w-full items-center gap-2 px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                      >
                        <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6"
                          />
                        </svg>
                        Вернуть на склад
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(item.id)}
        className="flex w-full items-center justify-between bg-rose-50/50 px-4 py-3 text-left sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-rose-500"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-rose-900">
          {isExpanded ? 'Скрыть детали' : 'Фото, описание и склад'}
        </span>
        <svg
          className={`h-5 w-5 text-rose-700 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
                <DetailBlock label="Дата операции">{formatStockOutDate(item.movement_date)}</DetailBlock>
                <DetailBlock label="Склад">{storageLabel}</DetailBlock>
                <DetailBlock label="Причина">{item.reason}</DetailBlock>
                <DetailBlock label="Ответственный">{getStockOutUserName(item)}</DetailBlock>
                {item.avito_order_id && (
                  <DetailBlock label="Заказ Авито">
                    <span className="font-mono">#{item.avito_order_id}</span>
                  </DetailBlock>
                )}
              </dl>

              {vehicles.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Автомобиль · {vehicles.length}
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
                          {[vehicle.generation, vehicle.engine, vehicle.transmission]
                            .filter(Boolean)
                            .join(' · ') || '—'}
                        </p>
                        {vehicle.vin && (
                          <p className="mt-1 font-mono text-xs text-gray-500">VIN {vehicle.vin}</p>
                        )}
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
