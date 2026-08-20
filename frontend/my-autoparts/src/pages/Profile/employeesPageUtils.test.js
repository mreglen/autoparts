import {
  buildPayload,
  canCreateEmployeeAccount,
  EMPLOYEE_TABLE_COLUMNS,
  emptyForm,
  formatAccountStatus,
  formatPayroll,
  parseEmployeeSaveError,
  validateEmployeeForm,
} from './employeesPageUtils';

describe('employeesPageUtils', () => {
  it('buildPayload omits password and allows empty email', () => {
    const payload = buildPayload({
      ...emptyForm,
      last_name: 'Иванов',
      first_name: 'Иван',
      email: '',
    });

    expect(payload).toEqual({
      last_name: 'Иванов',
      first_name: 'Иван',
      patronymic: null,
      phone: null,
      email: null,
      position: null,
      comment: null,
      is_service_executor: false,
    });
    expect(payload).not.toHaveProperty('password');
  });

  it('validateEmployeeForm does not require email', () => {
    const errors = validateEmployeeForm({
      ...emptyForm,
      last_name: 'Иванов',
      first_name: 'Иван',
      email: '',
    });

    expect(errors).toEqual({});
  });

  it('buildPayload includes payroll fields only for autoservice executor', () => {
    const payload = buildPayload({
      ...emptyForm,
      last_name: 'Иванов',
      first_name: 'Иван',
      is_service_executor: true,
      salary_type: 'percent_work',
      work_percent: '0',
    });

    expect(payload.is_service_executor).toBe(true);
    expect(payload.salary_type).toBe('percent_work');
    expect(payload.work_percent).toBe(50);
  });

  it('formatPayroll shows percent and fixed variants', () => {
    expect(formatPayroll({ is_service_executor: false })).toBe('—');
    expect(formatPayroll({ is_service_executor: true, salary_type: 'percent_work', work_percent: 50 })).toBe('% от работ · 50%');
    expect(formatPayroll({ is_service_executor: true, salary_type: 'fixed', salary_amount: 40000 })).toMatch(/Фикс · 40.?000 ₽/);
  });

  it('parseEmployeeSaveError maps email conflict to friendly message', () => {
    const parsed = parseEmployeeSaveError('Попробуйте использовать другую почту');
    expect(parsed.formError).toBe('Попробуйте использовать другую почту');
    expect(parsed.fieldErrors.email).toBe('Попробуйте использовать другую почту');
  });

  it('canCreateEmployeeAccount is true only when email exists and account is missing', () => {
    expect(canCreateEmployeeAccount({ email: 'a@b.ru', user_id: null, account_status: 'no_account' })).toBe(true);
    expect(canCreateEmployeeAccount({ email: '', user_id: null, account_status: 'no_account' })).toBe(false);
    expect(canCreateEmployeeAccount({ email: 'a@b.ru', user_id: 5, account_status: 'linked' })).toBe(false);
  });

  it('formatAccountStatus reflects account lifecycle', () => {
    expect(formatAccountStatus({ email: null, user_id: null, account_status: 'no_account' }).label).toBe('Без аккаунта');
    expect(formatAccountStatus({ email: 'a@b.ru', user_id: null, account_status: 'no_account' }).label).toBe('Можно создать аккаунт');
    expect(formatAccountStatus({ email: 'a@b.ru', user_id: 1, account_status: 'linked' }).label).toBe('Аккаунт создан');
  });

  it('table columns exclude role and autoservice', () => {
    expect(EMPLOYEE_TABLE_COLUMNS).toEqual(['Сотрудник', 'Контакты', 'Оплата', 'Аккаунт']);
    expect(EMPLOYEE_TABLE_COLUMNS).not.toContain('Роль');
    expect(EMPLOYEE_TABLE_COLUMNS).not.toContain('Автосервис');
  });
});
