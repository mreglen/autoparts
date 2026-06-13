import React from 'react';
import NewPartHorizontalScroll from './NewPartHorizontalScroll';

function formatVehicleTitle(vehicle) {
  return [vehicle?.brand, vehicle?.model].filter(Boolean).join(' ').trim() || 'Авто';
}

function formatVehicleMeta(vehicle) {
  return [vehicle?.generation, vehicle?.engine, vehicle?.transmission].filter(Boolean).join(' · ');
}

export default function NewPartVehicleCompatibilityStrip({ vehicles, className = '' }) {
  const list = Array.isArray(vehicles) ? vehicles.filter(Boolean) : [];
  if (!list.length) return null;

  return (
    <div className={className}>
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
        Совместимость · {list.length}
      </p>
      <NewPartHorizontalScroll hint="Листайте совместимость →" showHint={list.length > 1}>
        <div className="flex gap-2 pb-0.5 pr-1">
          {list.map((vehicle) => {
            const key = vehicle.id || `${vehicle.brand}|${vehicle.model}|${vehicle.generation}|${vehicle.engine}`;
            const meta = formatVehicleMeta(vehicle);
            return (
              <div
                key={key}
                className="w-[11.5rem] shrink-0 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:w-[13rem]"
              >
                <p className="text-sm font-semibold leading-snug text-gray-900">
                  {formatVehicleTitle(vehicle)}
                </p>
                {meta ? (
                  <p className="mt-1 line-clamp-2 text-xs text-gray-500">{meta}</p>
                ) : null}
              </div>
            );
          })}
        </div>
      </NewPartHorizontalScroll>
    </div>
  );
}
