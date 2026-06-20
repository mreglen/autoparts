import React from 'react';
import {
  buildDonorLabel,
  buildVehicleSubtitle,
  buildVehicleTitle,
  hasDonorDetails,
} from '../../utils/fitmentDisplay';

export default function PartDetailDonorVehicleCard({ vehicle }) {
  if (!vehicle || !hasDonorDetails(vehicle)) return null;

  const title = buildDonorLabel(vehicle) || buildVehicleTitle(vehicle);
  const subtitle = buildVehicleSubtitle(vehicle);

  return (
    <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Снята с автомобиля</p>
      <p className="mt-1 text-lg font-semibold leading-snug text-gray-900">{title}</p>
      {subtitle && subtitle !== title ? (
        <p className="mt-1 text-sm text-gray-600">{subtitle}</p>
      ) : null}
    </div>
  );
}
