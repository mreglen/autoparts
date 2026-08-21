import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPermissions,
  fetchEmployeePermissions,
  saveEmployeePermissions,
} from '../../redux/slices/OrganizationSlice';
import { groupPermissionsForGrid } from './permissionGridGroups';
import { Badge, Button, Card, EmptyState, Modal, Skeleton } from '../UI';

function PermissionTile({ permission, checked, disabled, onToggle }) {
  return (
    <label
      className={`flex min-h-[88px] cursor-pointer flex-col justify-between rounded-sg border p-3 transition-all duration-150 ${
        checked
          ? 'border-brand-400 bg-brand-50/70 shadow-sg-sm'
          : 'border-line bg-surface hover:border-brand-200 hover:bg-surface-subtle'
      } ${disabled ? 'pointer-events-none opacity-60' : ''}`}
    >
      <input
        type="checkbox"
        className="sr-only"
        checked={checked}
        onChange={onToggle}
        disabled={disabled}
      />
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug text-ink">{permission.name}</span>
        <span
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
            checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface'
          }`}
        >
          {checked && (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </span>
      </div>
      {permission.code && (
        <span className="mt-2 truncate font-mono text-[11px] text-ink-muted" title={permission.code}>
          {permission.code}
        </span>
      )}
    </label>
  );
}

function PermissionGridSkeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 3 }).map((_, groupIndex) => (
        <Card key={`sk-group-${groupIndex}`} padding="sm">
          <Skeleton className="mb-4 h-4 w-40" />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((__, tileIndex) => (
              <Skeleton key={`sk-tile-${groupIndex}-${tileIndex}`} className="h-[88px] rounded-sg" />
            ))}
          </div>
        </Card>
      ))}
    </div>
  );
}

const PermissionAssignmentModal = ({ show, employee, orgId, onClose }) => {
  const dispatch = useDispatch();
  const [localPermissions, setLocalPermissions] = useState([]);

  const {
    permissions,
    loadingPermissions,
    employeePermissions,
    loadingEmployeePermissions,
    savingEmployeePermissions,
    permissionsError,
  } = useSelector((state) => state.organization);

  useEffect(() => {
    if (show && employee && orgId) {
      dispatch(fetchPermissions());
      dispatch(fetchEmployeePermissions({ orgId, cardId: employee.id }));
    }
  }, [show, employee, orgId, dispatch]);

  useEffect(() => {
    if (employee && employeePermissions[employee.id]) {
      setLocalPermissions(employeePermissions[employee.id]);
    } else if (show && employee) {
      setLocalPermissions([]);
    }
  }, [employee, employeePermissions, show]);

  const permissionGroups = useMemo(
    () => groupPermissionsForGrid(permissions),
    [permissions],
  );

  const totalCount = useMemo(
    () => permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0),
    [permissionGroups],
  );

  const togglePermission = (permissionId) => {
    setLocalPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId],
    );
  };

  const toggleGroup = (groupPermissionIds, selectAll) => {
    setLocalPermissions((prev) => {
      if (selectAll) {
        return [...new Set([...prev, ...groupPermissionIds])];
      }
      return prev.filter((id) => !groupPermissionIds.includes(id));
    });
  };

  const handleSelectAll = () => {
    const allIds = permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.id));
    setLocalPermissions(allIds);
  };

  const handleClearAll = () => {
    setLocalPermissions([]);
  };

  const handleSave = async () => {
    if (!employee || !orgId) return;

    const resultAction = await dispatch(
      saveEmployeePermissions({
        orgId,
        cardId: employee.id,
        permissionIds: localPermissions,
      }),
    );

    if (saveEmployeePermissions.fulfilled.match(resultAction)) {
      onClose();
    } else {
      alert(`Ошибка при сохранении прав: ${resultAction.payload || 'Неизвестная ошибка'}`);
    }
  };

  const isLoading = loadingPermissions || loadingEmployeePermissions;
  const isSaving = savingEmployeePermissions;

  if (!employee) return null;

  const employeeName = [employee.last_name, employee.first_name].filter(Boolean).join(' ');

  return (
    <Modal
      open={show}
      onClose={onClose}
      size="xl"
      className="max-h-[92vh]"
      title={
        <div>
          <h2 className="text-base font-semibold text-ink">Права доступа</h2>
          <p className="mt-0.5 text-sm text-ink-muted">{employeeName || 'Сотрудник'}</p>
        </div>
      }
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={isLoading}>
            Сохранить права
          </Button>
        </>
      }
    >
      {isLoading ? (
        <PermissionGridSkeleton />
      ) : permissionsError ? (
        <EmptyState
          illustration="error"
          title="Не удалось загрузить права"
          description={permissionsError}
        />
      ) : totalCount === 0 ? (
        <EmptyState
          title="Нет доступных прав"
          description="Каталог прав пока пуст. Обратитесь к администратору."
        />
      ) : (
        <>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-sg border border-line bg-surface-subtle px-4 py-3">
            <Badge tone="brand">
              Выбрано {localPermissions.length} из {totalCount}
            </Badge>
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={handleSelectAll} disabled={isSaving}>
                Выбрать все
              </Button>
              <Button size="sm" variant="secondary" onClick={handleClearAll} disabled={isSaving}>
                Снять все
              </Button>
            </div>
          </div>

          <div className="space-y-5">
            {permissionGroups.map((group) => {
              const groupIds = group.permissions.map((permission) => permission.id);
              const selectedInGroup = groupIds.filter((id) => localPermissions.includes(id)).length;
              const allInGroup = selectedInGroup === groupIds.length && groupIds.length > 0;

              return (
                <Card key={group.id} padding="sm">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-line pb-3">
                    <div>
                      <h4 className="text-sm font-semibold text-ink">{group.title}</h4>
                      {group.description ? (
                        <p className="mt-0.5 text-xs text-ink-muted">{group.description}</p>
                      ) : null}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge tone="neutral">
                        {selectedInGroup}/{groupIds.length}
                      </Badge>
                      <Button
                        size="sm"
                        variant="secondary"
                        disabled={isSaving}
                        onClick={() => toggleGroup(groupIds, !allInGroup)}
                      >
                        {allInGroup ? 'Снять раздел' : 'Весь раздел'}
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {group.permissions.map((permission) => (
                      <PermissionTile
                        key={permission.id}
                        permission={permission}
                        checked={localPermissions.includes(permission.id)}
                        disabled={isSaving}
                        onToggle={() => togglePermission(permission.id)}
                      />
                    ))}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}
    </Modal>
  );
};

export default PermissionAssignmentModal;
