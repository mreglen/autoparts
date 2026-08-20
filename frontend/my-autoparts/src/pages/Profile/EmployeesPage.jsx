import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchEmployees,
  addEmployee as createEmployee,
  updateEmployee,
  deleteEmployee,
} from '../../redux/slices/OrganizationSlice';
import PermissionAssignmentModal from '../../components/Employees/PermissionAssignmentModal';
import {
  Badge,
  Button,
  ConfirmDialog,
  DataTable,
  EmptyState,
  FieldHint,
  FieldLabel,
  Input,
  Modal,
  PageHeader,
  SkeletonListCards,
} from '../../components/UI';
import {
  SettingsActionsDropdown,
  SettingsToggle,
} from '../Settings/settingsUi';
import { warehousePageClass } from '../../utils/warehouseListUi';

const emptyForm = {
  last_name: '',
  first_name: '',
  patronymic: '',
  email: '',
  phone: '',
  password: '',
  is_service_executor: false,
};

function InlineNotice({ tone = 'error', children, onClose }) {
  const tones = {
    success: 'border-success-100 bg-success-50 text-success-700',
    error: 'border-danger-100 bg-danger-50 text-danger-700',
    info: 'border-line bg-surface-subtle text-ink-soft',
  };
  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-sg border px-4 py-3 ${tones[tone] || tones.error}`}
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

function getEmployeeFullName(employee) {
  return `${employee.last_name || ''} ${employee.first_name || ''} ${employee.patronymic || ''}`.trim();
}

function getEmployeeInitials(employee) {
  return (employee.first_name?.[0] || employee.last_name?.[0] || '?').toUpperCase();
}

function EmployeeAvatar({ employee, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';
  return (
    <div
      className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100 ${sizeClass}`}
    >
      {getEmployeeInitials(employee)}
    </div>
  );
}

function EmployeeFormFields({
  formData,
  errors,
  onChange,
  passwordRequired,
  showAutoserviceToggle = false,
}) {
  const handleAutoserviceToggle = (event) => {
    onChange({
      target: {
        name: 'is_service_executor',
        type: 'checkbox',
        checked: event.target.checked,
      },
    });
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
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
            placeholder="Иванов"
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
            placeholder="Иван"
          />
          {errors.first_name ? <FieldHint error>{errors.first_name}</FieldHint> : null}
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="emp-patronymic">Отчество</FieldLabel>
        <Input
          id="emp-patronymic"
          type="text"
          name="patronymic"
          value={formData.patronymic}
          onChange={onChange}
          placeholder="Иванович"
        />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
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
            placeholder="name@company.ru"
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
            placeholder="+7 (999) 000-00-00"
          />
          {errors.phone ? <FieldHint error>{errors.phone}</FieldHint> : null}
        </div>
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
            passwordRequired ? 'Минимум 6 символов' : 'Новый пароль (если нужно изменить)'
          }
        />
        {errors.password ? <FieldHint error>{errors.password}</FieldHint> : null}
      </div>
      {showAutoserviceToggle ? (
        <SettingsToggle
          checked={Boolean(formData.is_service_executor)}
          onChange={handleAutoserviceToggle}
          label="Сотрудник автосервиса"
          description="Таких сотрудников можно указывать в заказ-нарядах как исполнителей работ."
        />
      ) : null}
    </div>
  );
}

function EmployeeMobileRow({ employee, fullName, isSelf, onEdit, onPermissions, onDelete }) {
  return (
    <div className="flex gap-3 border-b border-line py-3 last:border-b-0">
      <EmployeeAvatar employee={employee} size="lg" />
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{fullName || '—'}</p>
            <p className="mt-0.5 truncate text-xs text-ink-muted">{employee.email}</p>
            <p className="truncate text-xs text-ink-muted">{employee.phone}</p>
          </div>
          {!isSelf ? (
            <SettingsActionsDropdown
              menuWidth="w-52"
              items={[
                { key: 'edit', label: 'Редактировать', onClick: onEdit },
                { key: 'permissions', label: 'Назначить права', onClick: onPermissions },
                {
                  key: 'delete',
                  label: 'Удалить',
                  danger: true,
                  onClick: onDelete,
                },
              ]}
            />
          ) : null}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          <Badge tone={employee.is_director ? 'success' : 'brand'}>
            {employee.is_director ? 'Директор' : 'Сотрудник'}
          </Badge>
          {employee.is_service_executor ? (
            <Badge tone="success">Автосервис</Badge>
          ) : null}
        </div>
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
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (user?.organization_id) {
      dispatch(fetchEmployees(user.organization_id));
    }
  }, [dispatch, user]);

  const showAutoserviceToggle = Boolean(user?.organization_is_autoservice);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return employees || [];
    return (employees || []).filter((employee) => {
      const fullName = getEmployeeFullName(employee).toLowerCase();
      return (
        fullName.includes(query)
        || String(employee.email || '').toLowerCase().includes(query)
        || String(employee.phone || '').toLowerCase().includes(query)
      );
    });
  }, [employees, searchQuery]);

  const stats = useMemo(() => {
    const list = employees || [];
    return {
      total: list.length,
      autoservice: list.filter((employee) => employee.is_service_executor).length,
    };
  }, [employees]);

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
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
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
      is_service_executor: Boolean(employee.is_service_executor),
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
      const payload = { ...formData };
      if (!payload.password?.trim()) {
        delete payload.password;
      }
      await dispatch(
        updateEmployee({
          orgId: user.organization_id,
          userId: editingId,
          updateData: payload,
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

  const buildActions = (employee, fullName) => {
    if (employee.id === user?.id) return null;
    return (
      <div className="flex justify-end">
        <SettingsActionsDropdown
          menuWidth="w-52"
          items={[
            {
              key: 'edit',
              label: 'Редактировать',
              onClick: () => startEditing(employee),
            },
            {
              key: 'permissions',
              label: 'Назначить права',
              onClick: () => openPermissionModal(employee),
            },
            {
              key: 'delete',
              label: 'Удалить',
              danger: true,
              onClick: () => openDeleteModal(employee.id, fullName),
            },
          ]}
        />
      </div>
    );
  };

  const tableColumns = useMemo(() => {
    const columns = [
      {
        key: 'name',
        label: 'Сотрудник',
        render: (employee) => {
          const fullName = getEmployeeFullName(employee);
          return (
            <div className="flex items-center gap-3">
              <EmployeeAvatar employee={employee} />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{fullName || '—'}</p>
                <p className="truncate text-xs text-ink-muted">{employee.email}</p>
              </div>
            </div>
          );
        },
      },
      {
        key: 'phone',
        label: 'Телефон',
        render: (employee) => (
          <span className="whitespace-nowrap text-ink-soft">{employee.phone || '—'}</span>
        ),
      },
      {
        key: 'role',
        label: 'Роль',
        render: (employee) => (
          <Badge tone={employee.is_director ? 'success' : 'brand'}>
            {employee.is_director ? 'Директор' : 'Сотрудник'}
          </Badge>
        ),
      },
    ];

    if (showAutoserviceToggle) {
      columns.push({
        key: 'autoservice',
        label: 'Автосервис',
        render: (employee) => (
          employee.is_service_executor ? (
            <Badge tone="success">Да</Badge>
          ) : (
            <span className="text-ink-muted">—</span>
          )
        ),
      });
    }

    columns.push({
      key: 'actions',
      label: '',
      render: (employee) => buildActions(employee, getEmployeeFullName(employee)),
    });

    return columns;
  }, [showAutoserviceToggle, user?.id]);

  const pageSubtitle = loadingEmployees
    ? 'Загрузка списка…'
    : employeesError
      ? 'Управление доступом сотрудников'
      : stats.total > 0
        ? `${stats.total} в организации${showAutoserviceToggle ? ` · ${stats.autoservice} в автосервисе` : ''}`
        : 'Добавьте сотрудников и назначьте права доступа';

  return (
    <div className={`${warehousePageClass} w-full min-w-0 space-y-6`}>
      <PageHeader
        title="Сотрудники"
        subtitle={pageSubtitle}
        action={(
          <Button type="button" className="w-full sm:w-auto" onClick={openAddForm}>
            Добавить сотрудника
          </Button>
        )}
      />

      {showAutoserviceToggle && !loadingEmployees && !employeesError ? (
        <InlineNotice tone="info">
          Отметьте сотрудников автосервиса — только они доступны для выбора исполнителей в заказ-нарядах.
        </InlineNotice>
      ) : null}

      {formError && !showAddForm && !showEditForm ? (
        <InlineNotice tone="error" onClose={() => setFormError('')}>
          <p>{formError}</p>
        </InlineNotice>
      ) : null}

      {!loadingEmployees && !employeesError && stats.total > 0 ? (
        <div className="space-y-3">
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Поиск по имени, email или телефону"
            className="h-10 w-full rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
          />
          {searchQuery.trim() ? (
            <p className="text-sm text-ink-muted">
              Найдено: {filteredEmployees.length}
            </p>
          ) : null}
        </div>
      ) : null}

      {loadingEmployees ? (
        <SkeletonListCards count={3} />
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
      ) : filteredEmployees.length === 0 ? (
        <EmptyState
          illustration="search"
          title="Никого не нашли"
          description="Попробуйте изменить запрос поиска."
        />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={tableColumns} rows={filteredEmployees} />
          </div>
          <div className="md:hidden">
            {filteredEmployees.map((employee) => {
              const fullName = getEmployeeFullName(employee);
              return (
                <EmployeeMobileRow
                  key={employee.id}
                  employee={employee}
                  fullName={fullName}
                  isSelf={employee.id === user?.id}
                  onEdit={() => startEditing(employee)}
                  onPermissions={() => openPermissionModal(employee)}
                  onDelete={() => openDeleteModal(employee.id, fullName)}
                />
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
          <InlineNotice tone="error">{formError}</InlineNotice>
        ) : null}
        <form id="employee-add-form" onSubmit={handleSubmit} className="mt-4">
          <EmployeeFormFields
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
            passwordRequired
            showAutoserviceToggle={showAutoserviceToggle}
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
          <InlineNotice tone="error">{formError}</InlineNotice>
        ) : null}
        <form id="employee-edit-form" onSubmit={saveEdit} className="mt-4">
          <EmployeeFormFields
            formData={formData}
            errors={errors}
            onChange={handleInputChange}
            passwordRequired={false}
            showAutoserviceToggle={showAutoserviceToggle}
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
