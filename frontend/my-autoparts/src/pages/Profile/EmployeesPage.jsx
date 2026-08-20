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
import ActionsDropdown, { ActionsDropdownItem } from '../../components/ActionsDropdown/ActionsDropdown';
import {
  Button,
  ConfirmDialog,
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
import { SettingsToggle } from '../Settings/settingsUi';
import { warehousePageClass } from '../../utils/warehouseListUi';
import {
  buildPayload,
  emptyForm,
  formatAccountStatus,
  formatPayroll,
  getEmployeeFullName,
  validateEmployeeForm,
  parseEmployeeSaveError,
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

const ACCOUNT_STATUS_STYLES = {
  success: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
  brand: 'bg-indigo-50 text-indigo-700 ring-indigo-600/20',
  neutral: 'bg-gray-100 text-gray-600 ring-gray-500/20',
};

function EmployeeAccountBadge({ employee }) {
  const status = formatAccountStatus(employee);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset ${
        ACCOUNT_STATUS_STYLES[status.tone] || ACCOUNT_STATUS_STYLES.neutral
      }`}
    >
      {status.label}
    </span>
  );
}

function EmployeeActionsMenu({
  employee,
  fullName,
  creatingAccountId,
  onEdit,
  onPermissions,
  onCreateAccount,
  onDelete,
  showLabel = true,
}) {
  const canCreateAccount = employee.email && !employee.user_id && employee.account_status !== 'linked';
  const accountLoading = creatingAccountId === employee.id;

  return (
    <ActionsDropdown
      menuClassName="w-56 z-50"
      estimatedMenuHeight={canCreateAccount ? 180 : 140}
      showLabel={showLabel}
      buttonClassName="inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1"
    >
      <ActionsDropdownItem onClick={onEdit}>Редактировать</ActionsDropdownItem>
      <ActionsDropdownItem onClick={onPermissions}>Назначить права</ActionsDropdownItem>
      {canCreateAccount ? (
        <ActionsDropdownItem disabled={accountLoading} onClick={onCreateAccount}>
          {accountLoading ? 'Создание…' : 'Создать аккаунт'}
        </ActionsDropdownItem>
      ) : null}
      <ActionsDropdownItem danger onClick={onDelete}>Удалить</ActionsDropdownItem>
    </ActionsDropdown>
  );
}

function EmployeeMobileCard({
  employee,
  creatingAccountId,
  onEdit,
  onPermissions,
  onCreateAccount,
  onDelete,
}) {
  const fullName = getEmployeeFullName(employee);

  return (
    <div className="border-b border-gray-100 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-2">
        <button type="button" onClick={onEdit} className="min-w-0 flex-1 text-left">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-900">{fullName || '—'}</span>
            <EmployeeAccountBadge employee={employee} />
          </div>
          {employee.position ? (
            <p className="mt-1 truncate text-sm text-gray-500">{employee.position}</p>
          ) : null}
          <p className="mt-0.5 truncate text-sm text-gray-500">{employee.phone || '—'}</p>
          {employee.email ? (
            <p className="mt-0.5 truncate text-xs text-gray-500">{employee.email}</p>
          ) : null}
          {employee.is_service_executor ? (
            <p className="mt-1 text-xs text-gray-500">{formatPayroll(employee)}</p>
          ) : null}
        </button>
        <div className="shrink-0">
          <EmployeeActionsMenu
            employee={employee}
            fullName={fullName}
            creatingAccountId={creatingAccountId}
            onEdit={onEdit}
            onPermissions={onPermissions}
            onCreateAccount={onCreateAccount}
            onDelete={onDelete}
            showLabel={false}
          />
        </div>
      </div>
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
      const parsed = parseEmployeeSaveError(error);
      setFormError(parsed.formError);
      if (Object.keys(parsed.fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...parsed.fieldErrors }));
      }
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
      const parsed = parseEmployeeSaveError(error);
      setFormError(parsed.formError);
      if (Object.keys(parsed.fieldErrors).length) {
        setErrors((prev) => ({ ...prev, ...parsed.fieldErrors }));
      }
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

  const getEmployeeActions = (employee) => {
    const fullName = getEmployeeFullName(employee);
    return {
      onEdit: () => startEditing(employee),
      onPermissions: () => {
        setSelectedEmployee(employee);
        setShowPermissionModal(true);
      },
      onCreateAccount: () => handleCreateAccount(employee),
      onDelete: () => {
        setEmployeeToDelete({ id: employee.id, name: fullName });
        setShowDeleteModal(true);
      },
    };
  };

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
          <div className="hidden md:block min-w-0">
            <table className="min-w-full table-fixed divide-y divide-gray-200 text-sm">
              <thead>
                <tr className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <th className="py-3 pr-3">Сотрудник</th>
                  <th className="py-3 pr-3">Контакты</th>
                  <th className="w-40 py-3 pr-3">Оплата</th>
                  <th className="w-44 py-3 pr-3">Аккаунт</th>
                  <th className="w-28 py-3 text-right">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredEmployees.map((employee) => {
                  const fullName = getEmployeeFullName(employee);
                  const actions = getEmployeeActions(employee);
                  return (
                    <tr
                      key={employee.id}
                      className="group cursor-pointer transition-colors hover:bg-gray-50/70"
                      onClick={(e) => {
                        if (e.target.closest('.actions-dropdown')) return;
                        startEditing(employee);
                      }}
                    >
                      <td className="py-3 pr-3 align-middle">
                        <div className="font-medium text-gray-900">{fullName || '—'}</div>
                        {employee.position ? (
                          <div className="mt-0.5 text-xs text-gray-500">{employee.position}</div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 align-middle">
                        {employee.phone ? (
                          <div className="font-medium text-gray-900">{employee.phone}</div>
                        ) : (
                          <div className="text-gray-500">—</div>
                        )}
                        {employee.email ? (
                          <div className="mt-0.5 text-xs text-gray-500">{employee.email}</div>
                        ) : null}
                      </td>
                      <td className="py-3 pr-3 align-middle text-gray-600">{formatPayroll(employee)}</td>
                      <td className="py-3 pr-3 align-middle">
                        <EmployeeAccountBadge employee={employee} />
                      </td>
                      <td className="py-3 text-right align-middle">
                        <EmployeeActionsMenu
                          employee={employee}
                          fullName={fullName}
                          creatingAccountId={creatingAccountId}
                          {...actions}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="md:hidden">
            {filteredEmployees.map((employee) => {
              const actions = getEmployeeActions(employee);
              return (
                <EmployeeMobileCard
                  key={employee.id}
                  employee={employee}
                  creatingAccountId={creatingAccountId}
                  {...actions}
                />
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
