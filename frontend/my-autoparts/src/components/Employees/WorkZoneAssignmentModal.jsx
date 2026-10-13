import { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/apiClient';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import EmptyState from '../UI/EmptyState';
import Toast from '../UI/Toast';

const NO_RIGHTS = { can_view: false, can_edit: false, can_caldav: false };

const RIGHT_LABELS = [
  { key: 'can_view', label: 'Просмотр' },
  { key: 'can_edit', label: 'Редактирование' },
  { key: 'can_caldav', label: 'CalDAV' },
];

function RightCheckbox({ label, checked, onChange }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-1.5 text-xs font-medium text-ink-soft">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
      />
      {label}
    </label>
  );
}

const WorkZoneAssignmentModal = ({ show, employee, orgId, onClose }) => {
  const [workZones, setWorkZones] = useState([]);
  const [zoneStates, setZoneStates] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show && orgId && employee) {
      reload();
    }
  }, [show, orgId, employee]);

  const reload = async () => {
    setLoading(true);
    setError('');
    try {
      const [zones, assigned] = await Promise.all([
        apiRequest('/autoservice/work-zones'),
        apiRequest(`/organizations/${orgId}/employee-cards/${employee.id}/work-zones`),
      ]);
      const assignedMap = {};
      (assigned || []).forEach((a) => {
        assignedMap[a.work_zone_id] = a;
      });
      const next = {};
      (zones || []).forEach((zone) => {
        const a = assignedMap[zone.id];
        next[zone.id] = a
          ? {
              can_view: Boolean(a.can_view),
              can_edit: Boolean(a.can_edit),
              can_caldav: Boolean(a.can_caldav),
            }
          : { ...NO_RIGHTS };
      });
      setWorkZones(zones || []);
      setZoneStates(next);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const setRight = (zoneId, right, value) => {
    setZoneStates((prev) => {
      const zone = prev[zoneId] || { ...NO_RIGHTS };
      const next = { ...zone, [right]: value };
      if (right === 'can_view' && !value) {
        next.can_edit = false;
        next.can_caldav = false;
      }
      if ((right === 'can_edit' || right === 'can_caldav') && value) {
        next.can_view = true;
      }
      return { ...prev, [zoneId]: next };
    });
  };

  const handleSave = async () => {
    if (!employee || !orgId) return;
    setSaving(true);
    setError('');

    try {
      const currentData = await apiRequest(
        `/organizations/${orgId}/employee-cards/${employee.id}/work-zones`,
      );
      const assignedMap = {};
      (currentData || []).forEach((a) => {
        assignedMap[a.work_zone_id] = a;
      });

      for (const zone of workZones) {
        const state = zoneStates[zone.id] || { ...NO_RIGHTS };
        const anyRight = state.can_view || state.can_edit || state.can_caldav;
        const assignment = assignedMap[zone.id];

        if (anyRight && !assignment) {
          await apiRequest(`/organizations/${orgId}/employee-cards/${employee.id}/work-zones`, {
            method: 'POST',
            body: JSON.stringify({ work_zone_id: zone.id, ...state }),
          });
        } else if (anyRight && assignment) {
          const changed =
            Boolean(assignment.can_view) !== state.can_view ||
            Boolean(assignment.can_edit) !== state.can_edit ||
            Boolean(assignment.can_caldav) !== state.can_caldav;
          if (changed) {
            await apiRequest(
              `/organizations/${orgId}/employee-cards/${employee.id}/work-zones/${assignment.id}`,
              { method: 'PATCH', body: JSON.stringify(state) },
            );
          }
        } else if (!anyRight && assignment) {
          await apiRequest(
            `/organizations/${orgId}/employee-cards/${employee.id}/work-zones/${assignment.id}`,
            { method: 'DELETE' },
          );
        }
      }

      onClose();
    } catch (err) {
      setError(err.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  if (!show || !employee) return null;

  const employeeName = [employee.last_name, employee.first_name].filter(Boolean).join(' ');
  const assignedCount = workZones.filter((zone) => {
    const state = zoneStates[zone.id];
    return state && (state.can_view || state.can_edit || state.can_caldav);
  }).length;

  return (
    <>
      <Modal
        open={show}
        onClose={onClose}
        size="md"
        title="Рабочие зоны сотрудника"
        footer={
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button variant="secondary" onClick={onClose} disabled={saving}>
              Отмена
            </Button>
            <Button onClick={handleSave} loading={saving} disabled={loading}>
              Сохранить
            </Button>
          </div>
        }
      >
        <p className="mb-4 text-sm text-ink-muted">{employeeName || 'Сотрудник'}</p>

        {loading ? (
          <div className="text-center py-8 text-sm text-ink-muted">Загрузка...</div>
        ) : error ? (
          <EmptyState illustration="error" title="Ошибка" description={error} />
        ) : !workZones || workZones.length === 0 ? (
          <EmptyState
            title="Нет рабочих зон"
            description="Сначала создайте рабочие зоны в настройках автосервиса"
          />
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {workZones.map((zone) => {
              const state = zoneStates[zone.id] || NO_RIGHTS;
              const anyRight = state.can_view || state.can_edit || state.can_caldav;
              return (
                <div
                  key={zone.id}
                  className={`flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-sg border p-3 transition-colors ${
                    anyRight
                      ? 'border-brand-400 bg-brand-50/70'
                      : 'border-line bg-surface hover:border-brand-200 hover:bg-surface-subtle'
                  }`}
                >
                  <span className="min-w-0 flex-1 basis-40 break-words text-sm font-medium text-ink">
                    {zone.name}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {RIGHT_LABELS.map(({ key, label }) => (
                      <RightCheckbox
                        key={key}
                        label={label}
                        checked={Boolean(state[key])}
                        onChange={(e) => setRight(zone.id, key, e.target.checked)}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {assignedCount > 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
            <Badge tone="brand">{assignedCount} назначено</Badge>
          </div>
        )}
      </Modal>

      {error && <Toast message={error} variant="error" onClose={() => setError('')} />}
    </>
  );
};

export default WorkZoneAssignmentModal;
