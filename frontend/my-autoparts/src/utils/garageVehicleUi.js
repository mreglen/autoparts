export function formatGarageVehicleLabel(vehicle) {
  if (!vehicle) return '';
  const title = [vehicle.make, vehicle.model].filter(Boolean).join(' ');
  const details = [vehicle.year, vehicle.plate, vehicle.vin].filter(Boolean);
  const suffix = details.length ? ` · ${details.join(' · ')}` : '';
  const label = `${title}${suffix}`.trim();
  return label || `Авто #${vehicle.id}`;
}

export function garageVehicleSearchText(vehicle) {
  if (!vehicle) return '';
  return [
    vehicle.make,
    vehicle.model,
    vehicle.year,
    vehicle.plate,
    vehicle.vin,
    vehicle.color,
    vehicle.notes,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
