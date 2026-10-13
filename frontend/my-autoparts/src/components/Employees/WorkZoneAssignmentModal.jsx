import { useState, useEffect } from 'react';
import { apiRequest } from '../../utils/apiClient';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import Badge from '../UI/Badge';
import EmptyState from '../UI/EmptyState';
import Toast from '../UI/Toast';

const WorkZoneAssignmentModal = ({ show, employee, orgId, onClose }) => {
  const [assignedZones, setAssignedZones] = useState([]);
  const [workZones, setWorkZones] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (show && orgId) {
      fetchWorkZones();
      fetchAssignedZones();
    }
  }, [show, orgId]);

  const fetchWorkZones = async () => {
    if (!orgId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest('/autoservice/work-zones');
      setWorkZones(data);
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const fetchAssignedZones = async () => {
    if (!employee || !orgId) return;
    setLoading(true);
    setError('');
    try {
      const data = await apiRequest(`/organizations/${orgId}/employee-cards/${employee.id}/work-zones`);
      setAssignedZones(data.map((z) => z.work_zone_id));
    } catch (err) {
      setError(err.message || 'Ошибка загрузки');
    } finally {
      setLoading(false);
    }
  };

  const toggleZone = (zoneId) => {
    setAssignedZones((prev) =>
      prev.includes(zoneId) ? prev.filter((id) => id !== zoneId) : [...prev, zoneId]
    );
  };

  const handleSave = async () => {
    if (!employee || !orgId) return;
    setSaving(true);
    setError('');

    try {
      const currentData = await apiRequest(`/organizations/${orgId}/employee-cards/${employee.id}/work-zones`);
      const currentIds = currentData.map((z) => z.work_zone_id);

      const toAdd = assignedZones.filter((id) => !currentIds.includes(id));
      const toRemove = currentIds.filter((id) => !assignedZones.includes(id));

      for (const zoneId of toAdd) {
        await apiRequest(`/organizations/${orgId}/employee-cards/${employee.id}/work-zones`, {
          method: 'POST',
          body: JSON.stringify({ work_zone_id: zoneId }),
        });
      }

      for (const assignment of currentData) {
        if (toRemove.includes(assignment.work_zone_id)) {
          await apiRequest(
            `/organizations/${orgId}/employee-cards/${employee.id}/work-zones/${assignment.id}`,
            { method: 'DELETE' }
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
            {workZones.map((zone) => (
              <label
                key={zone.id}
                className={`flex items-center justify-between rounded-sg border p-3 cursor-pointer transition-colors ${
                  assignedZones.includes(zone.id)
                    ? 'border-brand-400 bg-brand-50/70'
                    : 'border-line bg-surface hover:border-brand-200 hover:bg-surface-subtle'
                }`}
              >
                <span className="text-sm font-medium text-ink">{zone.name}</span>
                <input
                  type="checkbox"
                  checked={assignedZones.includes(zone.id)}
                  onChange={() => toggleZone(zone.id)}
                  className="h-4 w-4 rounded border-line text-brand-600 focus:ring-brand-500"
                />
              </label>
            ))}
          </div>
        )}

        {assignedZones.length > 0 && (
          <div className="mt-4 flex items-center gap-2 text-sm text-ink-muted">
            <Badge tone="brand">{assignedZones.length} назначено</Badge>
          </div>
        )}
      </Modal>

      {error && <Toast message={error} variant="error" onClose={() => setError('')} />}
    </>
  );
};

export default WorkZoneAssignmentModal;
