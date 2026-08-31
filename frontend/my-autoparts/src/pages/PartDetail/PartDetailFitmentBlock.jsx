import React, { useMemo } from 'react';
import { countGroupedFitmentRows, groupFitmentForDisplay, hasDonorDetails } from '../../utils/fitmentDisplay';
import { splitFitmentForDisplay } from '../../utils/mergeProductFitment';
import PartDetailDonorVehicleCard from './PartDetailDonorVehicleCard';
import PartDetailCompatibilityList from './PartDetailCompatibilityList';

function FitmentSkeleton() {
  return (
    <div className="mt-4 space-y-3">
      <div className="h-24 animate-pulse rounded-sg-lg bg-surface-subtle" />
      <div className="space-y-2">
        <div className="h-14 animate-pulse rounded-sg-lg bg-surface-subtle" />
        <div className="h-14 animate-pulse rounded-sg-lg bg-surface-subtle" />
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
  const groupedCount = useMemo(
    () => countGroupedFitmentRows(groupFitmentForDisplay(compatibility)),
    [compatibility],
  );
  const hasContent = visibleDonors.length > 0 || groupedCount > 0;

  if (loading && !hasContent) {
    return (
      <section>
        <h2 className="text-lg font-semibold text-ink">Подходит для автомобилей</h2>
        <p className="mt-1 text-sm text-ink-muted">Загружаем применимость…</p>
        <FitmentSkeleton />
      </section>
    );
  }

  if (!hasContent) return null;

  return (
    <section>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-semibold text-ink">Подходит для автомобилей</h2>
        {groupedCount > 0 ? (
          <span className="text-sm text-ink-muted">{groupedCount} модификаций</span>
        ) : null}
      </div>

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

      {groupedCount > 0 ? (
        <PartDetailCompatibilityList vehicles={compatibility} />
      ) : null}

      {loading && hasContent ? (
        <p className="mt-3 text-xs text-ink-muted">Обновляем справочную применимость…</p>
      ) : null}
    </section>
  );
}
