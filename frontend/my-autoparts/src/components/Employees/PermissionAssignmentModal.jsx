import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPermissions,
  fetchEmployeePermissions,
  saveEmployeePermissions,
} from '../../redux/slices/OrganizationSlice';
import { groupPermissionsForGrid } from './permissionGridGroups';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import Card from '../UI/Card';
import Badge from '../UI/Badge';
import EmptyState from '../UI/EmptyState';
import { Skeleton } from '../UI/Skeleton';

function formatPermissionError(error) {
  if (!error) return '';
  if (typeof error === 'string') return error;
  if (typeof error === 'object' && error.message) return String(error.message);
  return 'Не удалось загрузить права';
}

function asPermissionIds(value) {
  if (!Array.isArray(value)) return [];
  return value
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id));
}

function PermissionTile({ permission, checked, disabled, onToggle }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-pressed={checked}
      onClick={onToggle}
      className={`flex min-h-[88px] w-full flex-col justify-between rounded-sg border p-3 text-left transition-all duration-150 ${
        checked
          ? 'border-brand-400 bg-brand-50/70 shadow-sg-sm'
          : 'border-line bg-surface hover:border-brand-200 hover:bg-surface-subtle'
      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-sm font-medium leading-snug text-ink">{permission.name}</span>
        <span
          className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 ${
            checked ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface'
          }`}
        >
          {checked ? (
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          ) : null}
        </span>
      </div>
      {permission.code ? (
        <span className="mt-2 truncate font-mono text-[11px] text-ink-muted" title={permission.code}>
          {permission.code}
        </span>
      ) : null}
    </button>
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
      setLocalPermissions(asPermissionIds(employeePermissions[employee.id]));
    } else if (show && employee) {
      setLocalPermissions([]);
    }
  }, [employee, employeePermissions, show]);

  const permissionGroups = useMemo(
    () => groupPermissionsForGrid(Array.isArray(permissions) ? permissions : []),
    [permissions],
  );

  const totalCount = useMemo(
    () => permissionGroups.reduce((sum, group) => sum + group.permissions.length, 0),
    [permissionGroups],
  );

  const togglePermission = (permissionId) => {
    const id = Number(permissionId);
    setLocalPermissions((prev) => {
      const current = asPermissionIds(prev);
      return current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];
    });
  };

  const toggleGroup = (groupPermissionIds, selectAll) => {
    const ids = asPermissionIds(groupPermissionIds);
    setLocalPermissions((prev) => {
      const current = asPermissionIds(prev);
      if (selectAll) {
        return [...new Set([...current, ...ids])];
      }
      return current.filter((id) => !ids.includes(id));
    });
  };

  const handleSelectAll = () => {
    const allIds = asPermissionIds(
      permissionGroups.flatMap((group) => group.permissions.map((permission) => permission.id)),
    );
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
      alert(`Ошибка при сохранении прав: ${formatPermissionError(resultAction.payload) || 'Неизвестная ошибка'}`);
    }
  };

  if (!show || !employee) return null;

  const isLoading = loadingPermissions || loadingEmployeePermissions;
  const isSaving = savingEmployeePermissions;
  const employeeName = [employee.last_name, employee.first_name].filter(Boolean).join(' ');
  const errorMessage = formatPermissionError(permissionsError);

  return (
    <Modal
      open={show}
      onClose={onClose}
      size="xl"
      className="relative z-10 max-h-[92vh] text-ink"
      title="Права доступа"
      footer={(
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onClose} disabled={isSaving}>
            Отмена
          </Button>
          <Button onClick={handleSave} loading={isSaving} disabled={isLoading}>
            Сохранить права
          </Button>
        </div>
      )}
    >
      <p className="mb-4 text-sm text-ink-muted">{employeeName || 'Сотрудник'}</p>

      {isLoading ? (
        <PermissionGridSkeleton />
      ) : errorMessage ? (
        <EmptyState
          illustration="error"
          title="Не удалось загрузить права"
          description={errorMessage}
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

          <div className="space-y-5 pb-1">
            {permissionGroups.map((group) => {
              const groupIds = asPermissionIds(group.permissions.map((permission) => permission.id));
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
                        checked={localPermissions.includes(Number(permission.id))}
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
