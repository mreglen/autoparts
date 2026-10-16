export const UNASSIGNED_ZONE_FILTER_VALUE = 'none';

export function buildOrderZoneFilterOptions(workZones) {
  return [
    ...(workZones || []).map((zone) => ({ value: zone.id, label: zone.name })),
    { value: UNASSIGNED_ZONE_FILTER_VALUE, label: 'Не назначено' },
  ];
}
