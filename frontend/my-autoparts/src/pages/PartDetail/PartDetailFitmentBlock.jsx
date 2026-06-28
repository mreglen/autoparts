import React, { useMemo } from 'react';
import { hasDonorDetails } from '../../utils/fitmentDisplay';
import { splitFitmentForDisplay } from '../../utils/mergeProductFitment';
import PartDetailDonorVehicleCard from './PartDetailDonorVehicleCard';
import PartDetailCompatibilityList from './PartDetailCompatibilityList';

function FitmentSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
      <div className="flex gap-2">
        <div className="h-16 w-40 animate-pulse rounded-xl bg-gray-100" />
        <div className="h-16 w-40 animate-pulse rounded-xl bg-gray-100" />
        <div className="hidden h-16 w-40 animate-pulse rounded-xl bg-gray-100 sm:block" />
      </div>
    </div>
  );
}

export default function PartDetailFitmentBlock({
  sellerVehicles = [],
  referenceVehicles = [],
  loading = false,
}) {
  const { donors, compatibility } = useMemo(
    () => splitFitmentForDisplay(sellerVehicles, referenceVehicles),
    [sellerVehicles, referenceVehicles],
  );

  const visibleDonors = donors.filter(hasDonorDetails);
  const hasContent = visibleDonors.length > 0 || compatibility.length > 0;

  if (loading && !hasContent) {
    return (
      <section className="border-b border-gray-200 py-5">
        <h2 className="text-xl font-semibold text-gray-900">Подходит для автомобилей</h2>
        <FitmentSkeleton />
      </section>
    );
  }

  if (!hasContent) return null;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white px-4 py-5 sm:px-5">
      <h2 className="text-xl font-semibold text-gray-900">Подходит для автомобилей</h2>

      {visibleDonors.length > 0 ? (
        <div className="mt-4 space-y-3">
          {visibleDonors.map((vehicle) => (
            <PartDetailDonorVehicleCard
              key={`${vehicle.brand}|${vehicle.model}|${vehicle.generation}|donor`}
              vehicle={vehicle}
            />
          ))}
        </div>
      ) : null}

      {compatibility.length > 0 ? (
        <PartDetailCompatibilityList vehicles={compatibility} />
      ) : null}
    </section>
  );
}
