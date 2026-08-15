import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchEmployees,
  addEmployee as createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../../redux/slices/OrganizationSlice';
import PermissionAssignmentModal from '../../components/Employees/PermissionAssignmentModal';
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import PageIntro from '../../components/PageIntro/PageIntro';
import {
  Badge,
  Button,
  Card,
  ConfirmDialog,
  EmptyState,
  FieldHint,
  FieldLabel,
  Input,
  Modal,
  Skeleton,
} from '../../components/UI';
import {
  warehouseListShellClass,
  warehousePageClass,
} from '../../utils/warehouseListUi';

const emptyForm = {
  last_name: '',
  first_name: '',
  patronymic: '',
  email: '',
  phone: '',
  password: '',
};

function InlineNotice({ tone = 'error', children, onClose }) {
  const tones = {
    success: 'border-success-100 bg-success-50 text-success-700',
    error: 'border-danger-100 bg-danger-50 text-danger-700',
  };
  return (
    <div
      className={`mb-4 flex items-start justify-between gap-3 rounded-sg border px-4 py-3 ${tones[tone] || tones.error}`}
      role="status"
    >
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100"
          aria-label="Закрыть"
        >
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function EmployeeFormFields({ formData, errors, onChange, passwordRequired }) {
  return (
    <div className="space-y-4">
      <div>
        <FieldLabel htmlFor="emp-last-name" required>
          Фамилия
        </FieldLabel>
        <Input
          id="emp-last-name"
          type="text"
          name="last_name"
          value={formData.last_name}
          onChange={onChange}
          error={Boolean(errors.last_name)}
          placeholder="Введите фамилию"
        />
        {errors.last_name ? <FieldHint error>{errors.last_name}</FieldHint> : null}
      </div>
      <div>
        <FieldLabel htmlFor="emp-first-name" required>
          Имя
        </FieldLabel>
        <Input
          id="emp-first-name"
          type="text"
          name="first_name"
          value={formData.first_name}
          onChange={onChange}
          error={Boolean(errors.first_name)}
          placeholder="Введите имя"
        />
        {errors.first_name ? <FieldHint error>{errors.first_name}</FieldHint> : null}
      </div>
      <div>
        <FieldLabel htmlFor="emp-patronymic">Отчество</FieldLabel>
        <Input
          id="emp-patronymic"
          type="text"
          name="patronymic"
          value={formData.patronymic}
          onChange={onChange}
          placeholder="Введите отчество"
        />
      </div>
      <div>
        <FieldLabel htmlFor="emp-email" required>
          Email
        </FieldLabel>
        <Input
          id="emp-email"
          type="email"
          name="email"
          value={formData.email}
          onChange={onChange}
          error={Boolean(errors.email)}
          placeholder="Введите email"
        />
        {errors.email ? <FieldHint error>{errors.email}</FieldHint> : null}
      </div>
      <div>
        <FieldLabel htmlFor="emp-phone" required>
          Телефон
        </FieldLabel>
        <Input
          id="emp-phone"
          type="tel"
          name="phone"
          value={formData.phone}
          onChange={onChange}
          error={Boolean(errors.phone)}
          placeholder="Введите телефон"
        />
        {errors.phone ? <FieldHint error>{errors.phone}</FieldHint> : null}
      </div>
      <div>
        <FieldLabel htmlFor="emp-password" required={passwordRequired}>
          Пароль
        </FieldLabel>
        <Input
          id="emp-password"
          type="password"
          name="password"
          value={formData.password}
          onChange={onChange}
          error={Boolean(errors.password)}
          placeholder={
            passwordRequired ? 'Введите пароль' : 'Новый пароль (если нужно изменить)'
          }
        />
        {errors.password ? <FieldHint error>{errors.password}</FieldHint> : null}
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { employees, loadingEmployees, employeesError } = useSelector(
    (state) => state.organization,
  );
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [openDropdownId, setOpenDropdownId] = useState(null);
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [employeeToDelete, setEmployeeToDelete] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [errors, setErrors] = useState({});
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (user?.organization_id) {
      dispatch(fetchEmployees(user.organization_id));
    }
  }, [dispatch, user]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (openDropdownId && !e.target.closest('.actions-popup-container')) {
        setOpenDropdownId(null);
      }
    };
    if (openDropdownId) {
      document.addEventListener('click', handleClickOutside);
    }
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openDropdownId]);

  const validateForm = (data, { requirePassword } = {}) => {
    const newErrors = {};
    if (!data.last_name?.trim()) newErrors.last_name = 'Фамилия обязательна';
    if (!data.first_name?.trim()) newErrors.first_name = 'Имя обязательно';
    if (!data.email?.trim()) newErrors.email = 'Email обязателен';
    else if (!/\S+@\S+\.\S+/.test(data.email)) newErrors.email = 'Неверный формат email';
    if (!data.phone?.trim()) newErrors.phone = 'Телефон обязателен';
    if (requirePassword && !data.password?.trim()) newErrors.password = 'Пароль обязателен';
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const resetForm = () => {
    setFormData(emptyForm);
    setErrors({});
    setFormError('');
    setEditingId(null);
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const openAddForm = () => {
    resetForm();
    setShowAddForm(true);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
    resetForm();
  };

  const closeEditForm = () => {
    setShowEditForm(false);
    resetForm();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData, { requirePassword: true })) return;
    setIsCreating(true);
    setFormError('');
    try {
      await dispatch(
        createEmployee({ orgId: user.organization_id, employeeData: formData }),
      ).unwrap();
      closeAddForm();
    } catch (error) {
      setFormError(
        typeof error === 'string'
          ? error
          : error?.message || 'Не удалось создать сотрудника',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const startEditing = (employee) => {
    setFormData({
      last_name: employee.last_name || '',
      first_name: employee.first_name || '',
      patronymic: employee.patronymic || '',
      email: employee.email || '',
      phone: employee.phone || '',
      password: '',
    });
    setEditingId(employee.id);
    setErrors({});
    setFormError('');
    setShowEditForm(true);
  };

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!validateForm(formData, { requirePassword: false })) return;
    setIsSaving(true);
    setFormError('');
    try {
      await dispatch(
        updateEmployee({
          orgId: user.organization_id,
          userId: editingId,
          updateData: formData,
        }),
      ).unwrap();
      closeEditForm();
    } catch (error) {
      setFormError(
        typeof error === 'string'
          ? error
          : error?.message || 'Не удалось обновить сотрудника',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const openPermissionModal = (employee) => {
    setSelectedEmployee(employee);
    setShowPermissionModal(true);
  };

  const openDeleteModal = (empId, empName) => {
    setEmployeeToDelete({ id: empId, name: empName });
    setShowDeleteModal(true);
  };

  const closeDeleteModal = () => {
    setShowDeleteModal(false);
    setEmployeeToDelete(null);
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setIsDeleting(true);
    try {
      await dispatch(
        deleteEmployee({ orgId: user.organization_id, userId: employeeToDelete.id }),
      ).unwrap();
      closeDeleteModal();
    } catch (error) {
      setFormError(
        typeof error === 'string'
          ? error
          : error?.message || 'Не удалось удалить сотрудника',
      );
      closeDeleteModal();
    } finally {
      setIsDeleting(false);
    }
  };

  const lastActionableEmployeeId = useMemo(() => {
    const actionable = (employees || []).filter((e) => e.id !== user?.id);
    return actionable.length > 0 ? actionable[actionable.length - 1].id : null;
  }, [employees, user?.id]);

  const renderEmployeeActions = (emp, fullName, containerExtraClass = '') => {
    if (emp.id === user?.id) return null;
    const isOpen = openDropdownId === emp.id;
    return (
      <ActionsDropdown
        containerClassName={`relative actions-popup-container actions-dropdown ${containerExtraClass}`.trim()}
        isOpen={isOpen}
        onOpenChange={(next) => setOpenDropdownId(next ? emp.id : null)}
        menuClassName="w-52 z-50"
        estimatedMenuHeight={200}
        preferOpenUp={emp.id === lastActionableEmployeeId}
      >
        <ActionsDropdownItem
          onClick={() => {
            startEditing(emp);
            setOpenDropdownId(null);
          }}
        >
          Редактировать
        </ActionsDropdownItem>
        <ActionsDropdownItem
          onClick={() => {
            openPermissionModal(emp);
            setOpenDropdownId(null);
          }}
        >
          Назначить права
        </ActionsDropdownItem>
        <ActionsDropdownItem
          danger
          className="border-t border-line"
          onClick={() => {
            openDeleteModal(emp.id, fullName);
            setOpenDropdownId(null);
          }}
        >
          Удалить
        </ActionsDropdownItem>
      </ActionsDropdown>
    );
  };

  const employeeCount = employees?.length ?? 0;

  return (
    <div className={`${warehousePageClass} min-w-0 space-y-4`}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <PageIntro
          title="Сотрудники"
          description={
            !loadingEmployees && !employeesError
              ? employeeCount > 0
                ? `${employeeCount} в организации`
                : 'Управление доступом'
              : 'Управление доступом'
          }
          className="mb-0"
        />
        <Button type="button" className="w-full sm:w-auto" onClick={openAddForm}>
          Добавить сотрудника
        </Button>
      </div>

      {formError && !showAddForm && !showEditForm ? (
        <InlineNotice tone="error" onClose={() => setFormError('')}>
          <p>{formError}</p>
        </InlineNotice>
      ) : null}

      {loadingEmployees ? (
        <div className="space-y-3">
          <Skeleton className="h-16 w-full rounded-sg-lg" />
          <Skeleton className="h-40 w-full rounded-sg-lg" />
        </div>
      ) : employeesError ? (
        <EmptyState
          illustration="error"
          title="Не удалось загрузить"
          description={employeesError}
        />
      ) : employees.length === 0 ? (
        <EmptyState
          illustration="empty"
          title="Сотрудников пока нет"
          description="Добавьте первого сотрудника и назначьте права доступа."
          actionLabel="Добавить сотрудника"
          onAction={openAddForm}
        />
      ) : (
        <>
          <div
            className={`hidden md:block ${warehouseListShellClass} ${
              openDropdownId ? 'overflow-visible' : 'overflow-hidden'
            }`}
          >
            <table className="min-w-full text-left text-sm">
              <thead className="border-b border-line bg-surface-subtle text-ink-soft">
                <tr>
                  <th className="px-4 py-3 font-medium">ФИО</th>
                  <th className="px-4 py-3 font-medium">Email</th>
                  <th className="px-4 py-3 font-medium">Телефон</th>
                  <th className="px-4 py-3 font-medium">Роль</th>
                  <th className="px-4 py-3 text-right font-medium">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {employees.map((emp) => {
                  const fullName =
                    `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
                  return (
                    <tr
                      key={emp.id}
                      className="bg-surface transition hover:bg-surface-subtle/60"
                    >
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-sm font-semibold text-brand-700 ring-1 ring-brand-100">
                            {(emp.first_name?.[0] || emp.last_name?.[0] || '?').toUpperCase()}
                          </div>
                          <div className="font-semibold text-ink">{fullName || '—'}</div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{emp.email}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-ink-soft">{emp.phone}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <Badge tone={emp.is_director ? 'success' : 'brand'}>
                          {emp.is_director ? 'Директор' : 'Сотрудник'}
                        </Badge>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        {renderEmployeeActions(emp, fullName)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="space-y-3 md:hidden">
            {employees.map((emp) => {
              const fullName =
                `${emp.last_name || ''} ${emp.first_name || ''} ${emp.patronymic || ''}`.trim();
              return (
                <Card key={emp.id} className="!p-4">
                  <div className="mb-3 flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-sg bg-brand-50 text-base font-semibold text-brand-700 ring-1 ring-brand-100">
                        {(emp.first_name?.[0] || emp.last_name?.[0] || '?').toUpperCase()}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="break-words font-semibold text-ink">{fullName || '—'}</h3>
                        <p className="mt-1 text-sm text-ink-muted">{emp.email}</p>
                        <p className="text-sm text-ink-muted">{emp.phone}</p>
                      </div>
                    </div>
                    <Badge tone={emp.is_director ? 'success' : 'brand'}>
                      {emp.is_director ? 'Директор' : 'Сотрудник'}
                    </Badge>
                  </div>
                  <div className="flex justify-end border-t border-line pt-3">
                    {renderEmployeeActions(emp, fullName)}
                  </div>
                </Card>
              );
            })}
          </div>
        </>
      )}

      <PermissionAssignmentModal
        show={showPermissionModal}
        employee={selectedEmployee}
        onClose={() => {
          setShowPermissionModal(false);
          setSelectedEmployee(null);
        }}
      />

      <Modal
        open={showAddForm}
        onClose={closeAddForm}
        title="Добавить сотрудника"
        size="md"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeAddForm} disabled={isCreating}>
              Отмена
            </Button>
            <Button type="submit" form="employee-add-form" loading={isCreating} disabled={isCreating}>
              {isCreating ? 'Создание…' : 'Добавить'}
            </Button>
          </div>
        )}
      >
        {formError && showAddForm ? (
          <p className="mb-3 text-sm text-danger-600">{formError}</p>
        ) : null}
        <form id="employee-add-form" onSubmit={handleSubmit}>
          <EmployeeFormFields
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
            passwordRequired
          />
        </form>
      </Modal>

      <Modal
        open={showEditForm}
        onClose={closeEditForm}
        title="Редактировать сотрудника"
        size="md"
        footer={(
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="secondary" onClick={closeEditForm} disabled={isSaving}>
              Отмена
            </Button>
            <Button type="submit" form="employee-edit-form" loading={isSaving} disabled={isSaving}>
              {isSaving ? 'Сохранение…' : 'Сохранить'}
            </Button>
          </div>
        )}
      >
        {formError && showEditForm ? (
          <p className="mb-3 text-sm text-danger-600">{formError}</p>
        ) : null}
        <form id="employee-edit-form" onSubmit={saveEdit}>
          <EmployeeFormFields
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
            passwordRequired={false}
          />
        </form>
      </Modal>

      <ConfirmDialog
        open={showDeleteModal && Boolean(employeeToDelete)}
        onClose={closeDeleteModal}
        onConfirm={confirmDelete}
        title="Удалить сотрудника?"
        message={`Вы уверены, что хотите удалить сотрудника «${employeeToDelete?.name || ''}»? Это действие нельзя отменить.`}
        confirmLabel="Удалить"
        danger
        loading={isDeleting}
      />
    </div>
  );
}
