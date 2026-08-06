import React from 'react';
import { Card } from '../../components/UI';
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
    <Card padding="sm" className="border-accent-100 sm:p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-accent-700">Снята с автомобиля</p>
      <p className="mt-1 text-lg font-semibold leading-snug text-ink">{title}</p>
      {subtitle && subtitle !== title ? (
        <p className="mt-1 text-sm text-ink-muted">{subtitle}</p>
      ) : null}
    </Card>
  );
}
