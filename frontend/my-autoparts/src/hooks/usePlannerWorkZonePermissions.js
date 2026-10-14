import { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../utils/apiClient';

/**
 * Права текущего пользователя на рабочие зоны планировщика.
 * Загружает GET /autoservice/planner/employee-work-zones и возвращает
 * мапу work_zone_id -> { can_view, can_edit, can_caldav }.
 */
export function usePlannerWorkZonePermissions(enabled = true) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await apiRequest('/autoservice/planner/employee-work-zones');
      setData(response);
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить права на рабочие зоны');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (enabled) load();
  }, [enabled, load]);

  const fullAccess = Boolean(data?.full_access);
  const zonePermissions = useMemo(() => {
    const map = {};
    (data?.zones || []).forEach((zone) => {
      map[zone.work_zone_id] = zone;
    });
    return map;
  }, [data]);

  const canEditZone = useCallback(
    (zoneId) => fullAccess || Boolean(zonePermissions[zoneId ?? null]?.can_edit),
    [fullAccess, zonePermissions],
  );

  const anyEditable =
    fullAccess || Object.values(zonePermissions).some((zone) => zone?.can_edit);

  return {
    permissions: data,
    loading,
    loaded: data !== null,
    error,
    reload: load,
    fullAccess,
    zonePermissions,
    canEditZone,
    anyEditable,
  };
}

export default usePlannerWorkZonePermissions;
