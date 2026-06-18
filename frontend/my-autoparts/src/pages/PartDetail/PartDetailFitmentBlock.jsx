import React from 'react';
import NewPartVehicleCompatibilityStrip from '../AutoParts/NewParts/NewPartVehicleCompatibilityStrip';

function FitmentCard({ vehicle }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
      <div className="mb-3 flex items-center border-b border-gray-200 pb-3">
        <span className="text-sm font-bold text-gray-900">
          {vehicle.brand} {vehicle.model}
        </span>
      </div>
      <div className="space-y-1.5 text-xs">
        {vehicle.generation ? (
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Поколение</span>
            <span className="font-semibold text-gray-900">{vehicle.generation}</span>
          </div>
        ) : null}
        {vehicle.engine ? (
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Двигатель</span>
            <span className="font-semibold text-gray-900">{vehicle.engine}</span>
          </div>
        ) : null}
        {vehicle.transmission ? (
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">КПП</span>
            <span className="font-semibold text-gray-900">{vehicle.transmission}</span>
          </div>
        ) : null}
        {vehicle.vin ? (
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">VIN</span>
            <span className="max-w-[150px] truncate font-semibold text-gray-900">{vehicle.vin}</span>
          </div>
        ) : null}
        {vehicle.mileage ? (
          <div className="flex justify-between gap-3">
            <span className="text-gray-500">Пробег</span>
            <span className="font-semibold text-gray-900">
              {Number(vehicle.mileage).toLocaleString('ru-RU')} км
            </span>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function PartDetailFitmentBlock({ vehicles = [], loading = false }) {
  const list = Array.isArray(vehicles) ? vehicles.filter(Boolean) : [];
  if (loading && list.length === 0) {
    return (
      <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-bold text-gray-900">Подходит для автомобилей</h2>
        <p className="mt-2 text-sm text-gray-500">Загрузка применимости…</p>
      </section>
    );
  }
  if (!list.length) return null;

  const useDetailedCards = list.length <= 3 && list.some(
    (vehicle) => vehicle.engine || vehicle.transmission || vehicle.vin || vehicle.mileage,
  );

  return (
    <section className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900">Подходит для автомобилей</h2>
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
