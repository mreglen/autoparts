import { useState, useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchPermissions,
  fetchEmployeePermissions,
  saveEmployeePermissions,
} from '../../redux/slices/OrganizationSlice';

const PermissionAssignmentModal = ({ show, employee, onClose }) => {
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
    if (show && employee) {
      dispatch(fetchPermissions());
      dispatch(fetchEmployeePermissions(employee.id));
    }
  }, [show, employee, dispatch]);

  useEffect(() => {
    if (employee && employeePermissions[employee.id]) {
      setLocalPermissions(employeePermissions[employee.id]);
    } else if (show && employee) {
      setLocalPermissions([]);
    }
  }, [employee, employeePermissions, show]);

  const sortedPermissions = useMemo(
    () => [...(permissions || [])].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ru')),
    [permissions]
  );

  const togglePermission = (permissionId) => {
    setLocalPermissions((prev) =>
      prev.includes(permissionId)
        ? prev.filter((id) => id !== permissionId)
        : [...prev, permissionId]
    );
  };

  const handleSelectAll = () => {
    setLocalPermissions(sortedPermissions.map((p) => p.id));
  };

  const handleClearAll = () => {
    setLocalPermissions([]);
  };

  const handleSave = async () => {
    if (!employee) return;

    const resultAction = await dispatch(
      saveEmployeePermissions({
        employeeId: employee.id,
        permissionIds: localPermissions,
      })
    );

    if (saveEmployeePermissions.fulfilled.match(resultAction)) {
      onClose();
    } else {
      alert('Ошибка при сохранении прав: ' + (resultAction.payload || 'Неизвестная ошибка'));
    }
  };

  const isLoading = loadingPermissions || loadingEmployeePermissions;
  const isSaving = savingEmployeePermissions;

  if (!show || !employee) return null;

  const employeeName = [employee.last_name, employee.first_name].filter(Boolean).join(' ');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Права доступа</h3>
            <p className="mt-1 text-sm text-gray-500">{employeeName || 'Сотрудник'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-16">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gray-100">
                <svg
                  className="h-8 w-8 animate-spin text-indigo-600"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
              </div>
              <p className="text-sm text-gray-600">Загрузка прав доступа...</p>
            </div>
          ) : permissionsError ? (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{permissionsError}</p>
          ) : sortedPermissions.length === 0 ? (
            <p className="text-center text-sm text-gray-500 py-8">Нет доступных прав</p>
          ) : (
            <>
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-gray-600">
                  Выбрано:{' '}
                  <span className="font-semibold text-gray-900">{localPermissions.length}</span>
                  {' '}
                  из {sortedPermissions.length}
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    disabled={isSaving}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Выбрать все
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    disabled={isSaving}
                    className="rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-50 disabled:opacity-50"
                  >
                    Снять все
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sortedPermissions.map((permission) => {
                  const checked = localPermissions.includes(permission.id);
                  return (
                    <label
                      key={permission.id}
                      className={`relative flex cursor-pointer flex-col gap-2 rounded-xl border-2 p-4 transition-all duration-200 ${
                        checked
                          ? 'border-indigo-500 bg-indigo-50/60 shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50/80'
                      } ${isSaving ? 'pointer-events-none opacity-60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        className="sr-only"
                        checked={checked}
                        onChange={() => togglePermission(permission.id)}
                        disabled={isSaving}
                      />
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-sm font-medium leading-snug text-gray-900">
                          {permission.name}
                        </span>
                        <span
                          className={`flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors ${
                            checked
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : 'border-gray-300 bg-white'
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
                        <span className="font-mono text-xs text-gray-500">{permission.code}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            </>
          )}
        </div>

        <div className="flex flex-col-reverse gap-3 border-t border-gray-100 bg-gray-50/50 px-6 py-4 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50"
            disabled={isSaving}
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSave}
            className={`rounded-lg px-4 py-2.5 text-sm font-medium text-white transition-colors ${
              isSaving ? 'cursor-not-allowed bg-gray-400' : 'bg-indigo-600 hover:bg-indigo-700'
            }`}
            disabled={isSaving || isLoading}
          >
            {isSaving ? 'Сохранение...' : 'Сохранить права'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PermissionAssignmentModal;
