import { useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  fetchEmployees,
  addEmployee as createEmployee,
  updateEmployee,
  deleteEmployee,
  createEmployeeAccount,
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
  Select,
  SkeletonListCards,
  Textarea,
} from '../../components/UI';
import { SettingsActionsDropdown, SettingsToggle } from '../Settings/settingsUi';
import { warehousePageClass } from '../../utils/warehouseListUi';
import {
  buildPayload,
  emptyForm,
  formatAccountStatus,
  formatPayroll,
  getEmployeeFullName,
  validateEmployeeForm,
} from './employeesPageUtils';

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
        <button type="button" onClick={onClose} className="shrink-0 rounded-md p-1 opacity-70 hover:opacity-100" aria-label="Закрыть">
          <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>
      ) : null}
    </div>
  );
}

function getEmployeeInitials(employee) {
  return (employee.first_name?.[0] || employee.last_name?.[0] || '?').toUpperCase();
}

function EmployeeAvatar({ employee, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'h-12 w-12 text-base' : 'h-10 w-10 text-sm';
  return (
    <div className={`flex shrink-0 items-center justify-center rounded-xl bg-brand-50 font-semibold text-brand-700 ring-1 ring-brand-100 ${sizeClass}`}>
      {getEmployeeInitials(employee)}
    </div>
  );
}

function EmployeeFormFields({ formData, errors, onChange, showAutoserviceToggle = false }) {
  const handleAutoserviceToggle = (event) => {
    onChange({
      target: { name: 'is_service_executor', type: 'checkbox', checked: event.target.checked },
    });
  };

  return (
    <div className="space-y-4">
      {showAutoserviceToggle ? (
        <SettingsToggle
          checked={Boolean(formData.is_service_executor)}
          onChange={handleAutoserviceToggle}
          label="Сотрудник автосервиса"
          description="Таких сотрудников можно указывать в заказ-нарядах как исполнителей работ."
        />
      ) : null}

      {showAutoserviceToggle && formData.is_service_executor ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor="emp-salary-type">Тип оплаты</FieldLabel>
            <Select
              id="emp-salary-type"
              name="salary_type"
              value={formData.salary_type}
              onChange={onChange}
            >
              <option value="percent_work">% от работ</option>
              <option value="fixed">Фикс в месяц</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor="emp-salary-value">
              {formData.salary_type === 'fixed' ? 'Сумма, ₽' : 'Процент, %'}
            </FieldLabel>
            <Input
              id="emp-salary-value"
              type="number"
              min={0}
              max={formData.salary_type === 'percent_work' ? 100 : undefined}
              name={formData.salary_type === 'fixed' ? 'salary_amount' : 'work_percent'}
              value={formData.salary_type === 'fixed' ? formData.salary_amount : formData.work_percent}
              onChange={onChange}
            />
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="emp-last-name" required>Фамилия</FieldLabel>
          <Input id="emp-last-name" name="last_name" value={formData.last_name} onChange={onChange} error={Boolean(errors.last_name)} placeholder="Иванов" />
          {errors.last_name ? <FieldHint error>{errors.last_name}</FieldHint> : null}
        </div>
        <div>
          <FieldLabel htmlFor="emp-first-name" required>Имя</FieldLabel>
          <Input id="emp-first-name" name="first_name" value={formData.first_name} onChange={onChange} error={Boolean(errors.first_name)} placeholder="Иван" />
          {errors.first_name ? <FieldHint error>{errors.first_name}</FieldHint> : null}
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="emp-patronymic">Отчество</FieldLabel>
        <Input id="emp-patronymic" name="patronymic" value={formData.patronymic} onChange={onChange} placeholder="Иванович" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor="emp-phone">Телефон</FieldLabel>
          <Input id="emp-phone" type="tel" name="phone" value={formData.phone} onChange={onChange} error={Boolean(errors.phone)} placeholder="+7 (999) 000-00-00" />
          {errors.phone ? <FieldHint error>{errors.phone}</FieldHint> : null}
        </div>
        <div>
          <FieldLabel htmlFor="emp-email">Email</FieldLabel>
          <Input id="emp-email" type="email" name="email" value={formData.email} onChange={onChange} error={Boolean(errors.email)} placeholder="name@company.ru" />
          {errors.email ? <FieldHint error>{errors.email}</FieldHint> : null}
          <FieldHint>Необязательно. Нужен для создания аккаунта и отправки пароля.</FieldHint>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor="emp-position">Должность</FieldLabel>
        <Input id="emp-position" name="position" value={formData.position} onChange={onChange} placeholder="Механик" />
      </div>
      <div>
        <FieldLabel htmlFor="emp-comment">Комментарий</FieldLabel>
        <Textarea id="emp-comment" name="comment" value={formData.comment} onChange={onChange} rows={3} placeholder="Заметки о сотруднике" />
      </div>
    </div>
  );
}

export default function EmployeesPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { employees, loadingEmployees, employeesError } = useSelector((state) => state.organization);
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
  const [creatingAccountId, setCreatingAccountId] = useState(null);
  const [formError, setFormError] = useState('');
  const [notice, setNotice] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const orgId = user?.organization_id;
  const showAutoserviceToggle = Boolean(user?.organization_is_autoservice);

  useEffect(() => {
    if (orgId) dispatch(fetchEmployees(orgId));
  }, [dispatch, orgId]);

  const filteredEmployees = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    if (!query) return employees || [];
    return (employees || []).filter((employee) => {
      const fullName = getEmployeeFullName(employee).toLowerCase();
      return (
        fullName.includes(query)
        || String(employee.email || '').toLowerCase().includes(query)
        || String(employee.phone || '').toLowerCase().includes(query)
        || String(employee.position || '').toLowerCase().includes(query)
      );
    });
  }, [employees, searchQuery]);

  const stats = useMemo(() => ({
    total: employees?.length ?? 0,
    autoservice: (employees || []).filter((e) => e.is_service_executor).length,
  }), [employees]);

  const validateForm = (data) => {
    const newErrors = validateEmployeeForm(data);
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
    setFormData((prev) => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm(formData)) return;
    setIsCreating(true);
    setFormError('');
    try {
      await dispatch(createEmployee({ orgId, employeeData: buildPayload(formData) })).unwrap();
      setShowAddForm(false);
      resetForm();
      setNotice('Сотрудник добавлен');
    } catch (error) {
      setFormError(typeof error === 'string' ? error : error?.message || 'Не удалось создать сотрудника');
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
      position: employee.position || '',
      comment: employee.comment || '',
      is_service_executor: Boolean(employee.is_service_executor),
      salary_type: employee.salary_type || 'percent_work',
      salary_amount: String(employee.salary_amount ?? 0),
      work_percent: String(employee.work_percent ?? 50),
    });
    setEditingId(employee.id);
    setErrors({});
    setFormError('');
    setShowEditForm(true);
  };

  const saveEdit = async (e) => {
    e?.preventDefault?.();
    if (!validateForm(formData)) return;
    setIsSaving(true);
    setFormError('');
    try {
      await dispatch(updateEmployee({ orgId, cardId: editingId, updateData: buildPayload(formData) })).unwrap();
      setShowEditForm(false);
      resetForm();
      setNotice('Изменения сохранены');
    } catch (error) {
      setFormError(typeof error === 'string' ? error : error?.message || 'Не удалось обновить сотрудника');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateAccount = async (employee) => {
    setCreatingAccountId(employee.id);
    setNotice('');
    try {
      const result = await dispatch(createEmployeeAccount({ orgId, cardId: employee.id })).unwrap();
      await dispatch(fetchEmployees(orgId));
      setNotice(result.message || 'Аккаунт создан');
    } catch (error) {
      setFormError(typeof error === 'string' ? error : error?.message || 'Не удалось создать аккаунт');
    } finally {
      setCreatingAccountId(null);
    }
  };

  const confirmDelete = async () => {
    if (!employeeToDelete) return;
    setIsDeleting(true);
    try {
      await dispatch(deleteEmployee({ orgId, cardId: employeeToDelete.id })).unwrap();
      setShowDeleteModal(false);
      setEmployeeToDelete(null);
    } catch (error) {
      setFormError(typeof error === 'string' ? error : error?.message || 'Не удалось удалить сотрудника');
      setShowDeleteModal(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const buildActions = (employee, fullName) => {
    const canCreateAccount = employee.email && !employee.user_id && employee.account_status !== 'linked';
    const items = [
      { key: 'edit', label: 'Редактировать', onClick: () => startEditing(employee) },
      { key: 'permissions', label: 'Назначить права', onClick: () => { setSelectedEmployee(employee); setShowPermissionModal(true); } },
    ];
    if (canCreateAccount) {
      items.push({
        key: 'account',
        label: creatingAccountId === employee.id ? 'Создание…' : 'Создать аккаунт',
        onClick: () => handleCreateAccount(employee),
        disabled: creatingAccountId === employee.id,
      });
    }
    items.push({
      key: 'delete',
      label: 'Удалить',
      danger: true,
      onClick: () => { setEmployeeToDelete({ id: employee.id, name: fullName }); setShowDeleteModal(true); },
    });
    return (
      <div className="flex justify-end">
        <SettingsActionsDropdown menuWidth="w-56" items={items} />
      </div>
    );
  };

  const tableColumns = useMemo(() => [
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
              {employee.position ? <p className="truncate text-xs text-ink-muted">{employee.position}</p> : null}
            </div>
          </div>
        );
      },
    },
    {
      key: 'contacts',
      label: 'Контакты',
      render: (employee) => (
        <div className="min-w-0 text-sm text-ink-soft">
          {employee.phone ? <p className="truncate">{employee.phone}</p> : null}
          {employee.email ? <p className="truncate text-xs text-ink-muted">{employee.email}</p> : <span className="text-ink-muted">—</span>}
        </div>
      ),
    },
    {
      key: 'payroll',
      label: 'Оплата',
      render: (employee) => <span className="text-sm text-ink-soft">{formatPayroll(employee)}</span>,
    },
    {
      key: 'account',
      label: 'Аккаунт',
      render: (employee) => {
        const status = formatAccountStatus(employee);
        return <Badge tone={status.tone}>{status.label}</Badge>;
      },
    },
    {
      key: 'actions',
      label: '',
      render: (employee) => buildActions(employee, getEmployeeFullName(employee)),
    },
  ], [creatingAccountId, orgId]);

  const pageSubtitle = loadingEmployees
    ? 'Загрузка списка…'
    : stats.total > 0
      ? `${stats.total} в организации${showAutoserviceToggle ? ` · ${stats.autoservice} в автосервисе` : ''}`
      : 'Карточки сотрудников без обязательного email и пароля';

  return (
    <div className={`${warehousePageClass} w-full min-w-0 space-y-6`}>
      <PageHeader
        title="Сотрудники"
        subtitle={pageSubtitle}
        action={<Button type="button" className="w-full sm:w-auto" onClick={() => { resetForm(); setShowAddForm(true); }}>Добавить сотрудника</Button>}
      />

      {notice ? <InlineNotice tone="success" onClose={() => setNotice('')}>{notice}</InlineNotice> : null}
      {formError && !showAddForm && !showEditForm ? <InlineNotice tone="error" onClose={() => setFormError('')}>{formError}</InlineNotice> : null}

      {!loadingEmployees && stats.total > 0 ? (
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Поиск по имени, email, телефону или должности"
          className="h-10 w-full rounded-full border-0 bg-gray-100 px-4 text-sm text-gray-900 outline-none placeholder:text-gray-400 focus:bg-white focus:ring-2 focus:ring-brand-500/20"
        />
      ) : null}

      {loadingEmployees ? (
        <SkeletonListCards count={3} />
      ) : employeesError ? (
        <EmptyState illustration="error" title="Не удалось загрузить" description={employeesError} />
      ) : employees.length === 0 ? (
        <EmptyState illustration="empty" title="Сотрудников пока нет" description="Добавьте карточку сотрудника. Email и аккаунт можно указать позже." actionLabel="Добавить сотрудника" onAction={() => { resetForm(); setShowAddForm(true); }} />
      ) : filteredEmployees.length === 0 ? (
        <EmptyState illustration="search" title="Никого не нашли" description="Попробуйте изменить запрос поиска." />
      ) : (
        <>
          <div className="hidden md:block">
            <DataTable columns={tableColumns} rows={filteredEmployees} />
          </div>
          <div className="md:hidden divide-y divide-line">
            {filteredEmployees.map((employee) => {
              const fullName = getEmployeeFullName(employee);
              const account = formatAccountStatus(employee);
              return (
                <div key={employee.id} className="flex gap-3 py-3">
                  <EmployeeAvatar employee={employee} size="lg" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink">{fullName || '—'}</p>
                        {employee.position ? <p className="text-xs text-ink-muted">{employee.position}</p> : null}
                        <p className="mt-1 text-xs text-ink-muted">{employee.phone || '—'}</p>
                        <p className="text-xs text-ink-muted">{employee.email || '—'}</p>
                      </div>
                      {buildActions(employee, fullName)}
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Badge tone={account.tone}>{account.label}</Badge>
                      {employee.is_service_executor ? <Badge tone="success">{formatPayroll(employee)}</Badge> : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      <PermissionAssignmentModal
        show={showPermissionModal}
        employee={selectedEmployee}
        orgId={orgId}
        onClose={() => { setShowPermissionModal(false); setSelectedEmployee(null); }}
      />

      <Modal open={showAddForm} onClose={() => { setShowAddForm(false); resetForm(); }} title="Добавить сотрудника" size="md"
        footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => { setShowAddForm(false); resetForm(); }} disabled={isCreating}>Отмена</Button><Button type="submit" form="employee-add-form" loading={isCreating}>Добавить</Button></div>}>
        {formError && showAddForm ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
        <form id="employee-add-form" onSubmit={handleSubmit} className="mt-4">
          <EmployeeFormFields formData={formData} errors={errors} onChange={handleInputChange} showAutoserviceToggle={showAutoserviceToggle} />
        </form>
      </Modal>

      <Modal open={showEditForm} onClose={() => { setShowEditForm(false); resetForm(); }} title="Редактировать сотрудника" size="md"
        footer={<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end"><Button type="button" variant="secondary" onClick={() => { setShowEditForm(false); resetForm(); }} disabled={isSaving}>Отмена</Button><Button type="submit" form="employee-edit-form" loading={isSaving}>Сохранить</Button></div>}>
        {formError && showEditForm ? <InlineNotice tone="error">{formError}</InlineNotice> : null}
        <form id="employee-edit-form" onSubmit={saveEdit} className="mt-4">
          <EmployeeFormFields formData={formData} errors={errors} onChange={handleInputChange} showAutoserviceToggle={showAutoserviceToggle} />
        </form>
      </Modal>

      <ConfirmDialog open={showDeleteModal && Boolean(employeeToDelete)} onClose={() => { setShowDeleteModal(false); setEmployeeToDelete(null); }} onConfirm={confirmDelete}
        title="Удалить сотрудника?" message={`Вы уверены, что хотите удалить «${employeeToDelete?.name || ''}»?`} confirmLabel="Удалить" danger loading={isDeleting} />
    </div>
  );
}
