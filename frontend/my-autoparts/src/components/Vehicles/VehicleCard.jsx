import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useActionsDropdownPlacement } from '../../hooks/useActionsDropdownPlacement';
import { buildActionsDropdownMenuClassName } from '../../utils/actionsDropdownPlacement';

function DetailBlock({ label, children }) {
  return (
    <div className="rounded-xl border border-gray-200/80 bg-white px-3 py-2.5">
      <dt className="text-xs font-medium text-gray-500">{label}</dt>
      <dd className="mt-1 text-sm font-medium text-gray-900 whitespace-pre-wrap">{children || '—'}</dd>
    </div>
  );
}

export default function VehicleCard({ vehicle, storageLabel, isExpanded, onToggle }) {
  const [showActions, setShowActions] = useState(false);
  const actionsPlacement = useActionsDropdownPlacement(showActions, 56);

  useEffect(() => {
    if (!showActions) return undefined;
    const handleClickOutside = (event) => {
      if (!event.target.closest(`[data-vehicle-actions="${vehicle.id}"]`)) {
        setShowActions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActions, vehicle.id]);

  const headline = [vehicle.brand, vehicle.model].filter(Boolean).join(' ') || 'Без названия';
  const hasExtraDetails =
    Boolean(vehicle.description?.trim()) ||
    Boolean(vehicle.engine) ||
    Boolean(vehicle.vin) ||
    vehicle.mileage != null;

  return (
    <article
      className={`overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow ${
        isExpanded
          ? 'border-slate-300 shadow-md ring-1 ring-slate-200'
          : 'border-gray-200/80 hover:border-slate-200 hover:shadow'
      }`}
    >
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-800 ring-1 ring-slate-200">
                <svg className="h-3.5 w-3.5 text-slate-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
                  />
                </svg>
                {vehicle.brand || 'Марка не указана'}
              </span>
              {vehicle.generation && (
                <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                  {vehicle.generation}
                </span>
              )}
            </div>
            <h3 className="mt-2 text-base font-semibold text-gray-900">{headline}</h3>
            <p className="mt-1 text-sm text-gray-600 line-clamp-2" title={storageLabel || undefined}>
              {storageLabel || 'Склад не указан'}
            </p>
            {vehicle.engine && !isExpanded && (
              <p className="mt-1 text-xs text-gray-500">Двигатель: {vehicle.engine}</p>
            )}
          </div>

          <div className="relative shrink-0" data-vehicle-actions={vehicle.id}>
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
              <div className={buildActionsDropdownMenuClassName(actionsPlacement.placement)}>
                <Link
                  to={`/vehicles/edit/${vehicle.id}`}
                  onClick={() => setShowActions(false)}
                  className="block w-full px-4 py-2.5 text-left text-sm text-gray-700 hover:bg-gray-50"
                >
                  Редактировать
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        type="button"
        onClick={() => onToggle(vehicle.id)}
        className="flex w-full items-center justify-between bg-slate-50/80 px-4 py-3 text-left sm:px-5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-slate-500"
        aria-expanded={isExpanded}
      >
        <span className="text-sm font-medium text-slate-800">
          {isExpanded ? 'Скрыть детали' : hasExtraDetails ? 'Подробнее об автомобиле' : 'Описание и характеристики'}
        </span>
        <svg
          className={`h-5 w-5 text-slate-600 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
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
          <dl className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <DetailBlock label="Модель">{vehicle.model}</DetailBlock>
            <DetailBlock label="Поколение">{vehicle.generation}</DetailBlock>
            <DetailBlock label="Двигатель">{vehicle.engine}</DetailBlock>
            <DetailBlock label="VIN">{vehicle.vin}</DetailBlock>
            <DetailBlock label="Пробег">
              {vehicle.mileage != null ? `${Number(vehicle.mileage).toLocaleString('ru-RU')} км` : null}
            </DetailBlock>
            <DetailBlock label="Склад">{storageLabel}</DetailBlock>
            <div className="sm:col-span-2">
              <DetailBlock label="Описание">
                {vehicle.description?.trim() ? vehicle.description : null}
              </DetailBlock>
            </div>
          </dl>
        </div>
      )}
    </article>
  );
}

export function VehiclesEmptyState({ searchQuery, hasStorageFilter, onAdd }) {
  const isFiltered = Boolean(searchQuery?.trim()) || hasStorageFilter;

  return (
    <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-6 py-14 text-center shadow-sm">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-700">
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4"
          />
        </svg>
      </div>
      <h3 className="text-lg font-semibold text-gray-900">
        {isFiltered ? 'Ничего не найдено' : 'Автомобилей пока нет'}
      </h3>
      <p className="mx-auto mt-2 max-w-md text-sm text-gray-600">
        {searchQuery?.trim()
          ? `По запросу «${searchQuery.trim()}» совпадений нет. Попробуйте другую марку или модель.`
          : hasStorageFilter
            ? 'На выбранном складе автомобилей нет. Сбросьте фильтр или добавьте новый автомобиль.'
            : 'Добавьте автомобиль — он будет доступен при привязке запчастей и учёте на складе.'}
      </p>
      {!isFiltered && (
        <button
          type="button"
          onClick={onAdd}
          className="mt-6 inline-flex rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-medium text-white hover:bg-slate-900"
        >
          Добавить автомобиль
        </button>
      )}
    </div>
  );
}
