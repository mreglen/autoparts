import React from 'react';
import NewPartVehicleCompatibilityStrip from '../AutoParts/NewParts/NewPartVehicleCompatibilityStrip';

function FitmentCard({ vehicle }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 border-b border-gray-200 pb-2 text-sm font-semibold text-gray-900">
        {vehicle.brand} {vehicle.model}
      </div>
      <dl className="space-y-1 text-xs">
        {vehicle.generation ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Поколение</dt>
            <dd className="font-medium text-gray-900">{vehicle.generation}</dd>
          </div>
        ) : null}
        {vehicle.engine ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Двигатель</dt>
            <dd className="font-medium text-gray-900">{vehicle.engine}</dd>
          </div>
        ) : null}
        {vehicle.transmission ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">КПП</dt>
            <dd className="font-medium text-gray-900">{vehicle.transmission}</dd>
          </div>
        ) : null}
        {vehicle.vin ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">VIN</dt>
            <dd className="max-w-[150px] truncate font-medium text-gray-900">{vehicle.vin}</dd>
          </div>
        ) : null}
        {vehicle.mileage ? (
          <div className="flex justify-between gap-3">
            <dt className="text-gray-500">Пробег</dt>
            <dd className="font-medium text-gray-900">
              {Number(vehicle.mileage).toLocaleString('ru-RU')} км
            </dd>
          </div>
        ) : null}
      </dl>
    </div>
  );
}

export default function PartDetailFitmentBlock({ vehicles = [], loading = false }) {
  const list = Array.isArray(vehicles) ? vehicles.filter(Boolean) : [];
  if (loading && list.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
        <h2 className="text-base font-semibold text-gray-900">Подходит для автомобилей</h2>
        <p className="mt-2 text-sm text-gray-500">Загрузка применимости…</p>
      </section>
    );
  }
  if (!list.length) return null;

  const useDetailedCards = list.length <= 3 && list.some(
    (vehicle) => vehicle.engine || vehicle.transmission || vehicle.vin || vehicle.mileage,
  );

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-gray-900">Подходит для автомобилей</h2>
      <p className="mt-1 text-xs text-gray-500">
        Справочная информация. Перед покупкой уточните совместимость у продавца.
      </p>
      {useDetailedCards ? (
        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
          {list.map((vehicle) => (
            <FitmentCard
              key={`${vehicle.brand}|${vehicle.model}|${vehicle.generation}|${vehicle.engine}`}
              vehicle={vehicle}
            />
          ))}
        </div>
      ) : (
        <NewPartVehicleCompatibilityStrip vehicles={list} className="mt-4" />
      )}
    </section>
  );
}
