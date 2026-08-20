export const emptyForm = {
  last_name: '',
  first_name: '',
  patronymic: '',
  email: '',
  phone: '',
  position: '',
  comment: '',
  is_service_executor: false,
  salary_type: 'percent_work',
  salary_amount: '0',
  work_percent: '50',
};

export function getEmployeeFullName(employee) {
  return `${employee.last_name || ''} ${employee.first_name || ''} ${employee.patronymic || ''}`.trim();
}

export function formatPayroll(employee) {
  if (!employee.is_service_executor) return '—';
  if (employee.salary_type === 'fixed') {
    return `Фикс · ${Number(employee.salary_amount || 0).toLocaleString('ru-RU')} ₽`;
  }
  return `% от работ · ${employee.work_percent ?? 50}%`;
}

export function formatAccountStatus(employee) {
  if (employee.user_id || employee.account_status === 'linked') {
    return { label: 'Аккаунт создан', tone: 'success' };
  }
  if (employee.email) {
    return { label: 'Можно создать аккаунт', tone: 'brand' };
  }
  return { label: 'Без аккаунта', tone: 'neutral' };
}

export function buildPayload(formData) {
  const payload = {
    last_name: formData.last_name.trim(),
    first_name: formData.first_name.trim(),
    patronymic: formData.patronymic?.trim() || null,
    phone: formData.phone?.trim() || null,
    email: formData.email?.trim() || null,
    position: formData.position?.trim() || null,
    comment: formData.comment?.trim() || null,
    is_service_executor: Boolean(formData.is_service_executor),
  };
  if (payload.is_service_executor) {
    payload.salary_type = formData.salary_type;
    payload.salary_amount = Number(formData.salary_amount) || 0;
    payload.work_percent = Number(formData.work_percent) || 50;
  }
  return payload;
}

export function validateEmployeeForm(data) {
  const errors = {};
  if (!data.last_name?.trim()) errors.last_name = 'Фамилия обязательна';
  if (!data.first_name?.trim()) errors.first_name = 'Имя обязательно';
  if (data.email?.trim() && !/\S+@\S+\.\S+/.test(data.email)) errors.email = 'Неверный формат email';
  return errors;
}

export const EMPLOYEE_TABLE_COLUMNS = ['Сотрудник', 'Контакты', 'Оплата', 'Аккаунт'];

export function parseEmployeeSaveError(error) {
  const message = typeof error === 'string' ? error : error?.message || '';
  const emailConflict = /другую почту|таким email|email уже/i.test(message);
  if (emailConflict) {
    return {
      formError: 'Попробуйте использовать другую почту',
      fieldErrors: { email: 'Попробуйте использовать другую почту' },
    };
  }
  return {
    formError: message || 'Не удалось сохранить сотрудника',
    fieldErrors: {},
  };
}

export function canCreateEmployeeAccount(employee) {
  return Boolean(employee.email && !employee.user_id && employee.account_status !== 'linked');
}
