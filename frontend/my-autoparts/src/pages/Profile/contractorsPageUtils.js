import {
  filledRequisiteKinds,
  normalizeRequisiteKind,
  emptyRequisiteSets,
  requisiteName,
  requisiteInn,
  requisiteSetsFromApi,
  requisiteSetsPayload,
  validateRequisiteSets,
} from '../../utils/requisiteSets';
import { personTypeLabel } from '../../utils/autoserviceClientRequisites';

export const CONTRACTOR_TABLE_COLUMNS = ['Подрядчик', 'Реквизиты по умолчанию', 'Типы в документах', 'Статус'];

export const CONTRACTOR_SALARY_TYPES = [
  { id: 'fixed', label: 'Фиксированная сумма (₽)' },
  { id: 'percent_work', label: 'Процент от работы (%)' },
];

export function emptyContractorForm() {
  return {
    name: '',
    phone: '',
    note: '',
    salary_type: 'fixed',
    salary_amount: '',
    work_percent: '',
    requisite_sets: emptyRequisiteSets(),
  };
}

export function contractorFormFromApi(row) {
  return {
    name: row?.name || '',
    phone: row?.phone || '',
    note: row?.note || '',
    salary_type: row?.salary_type || 'fixed',
    salary_amount: row?.salary_amount ? String(row.salary_amount) : '',
    work_percent: row?.work_percent ? String(row.work_percent) : '',
    requisite_sets: requisiteSetsFromApi(row?.requisite_sets),
  };
}

export function buildContractorPayload(form) {
  return {
    name: String(form?.name || '').trim(),
    phone: String(form?.phone || '').trim() || null,
    note: String(form?.note || '').trim() || null,
    salary_type: form?.salary_type || 'fixed',
    salary_amount: form?.salary_type === 'fixed' ? Number(form?.salary_amount || 0) : null,
    work_percent: form?.salary_type === 'percent_work' ? Number(form?.work_percent || 0) : null,
    requisite_sets: requisiteSetsPayload(form?.requisite_sets),
  };
}

export function validateContractorForm(form) {
  const errors = {};
  if (!String(form?.name || '').trim()) {
    errors.name = 'Наименование обязательно';
  }
  if (form?.salary_type === 'fixed' && form?.salary_amount !== '' && form?.salary_amount != null
      && (Number.isNaN(Number(form.salary_amount)) || Number(form.salary_amount) < 0)) {
    errors.salary_amount = 'Укажите сумму не меньше 0';
  }
  if (form?.salary_type === 'percent_work' && form?.work_percent !== '' && form?.work_percent != null
      && (Number.isNaN(Number(form.work_percent)) || Number(form.work_percent) < 0 || Number(form.work_percent) > 100)) {
    errors.work_percent = 'Процент от 0 до 100';
  }
  Object.assign(errors, validateRequisiteSets(form?.requisite_sets));
  return errors;
}

export function parseContractorSaveError(error) {
  const message = typeof error === 'string' ? error : error?.message || error?.detail || '';
  const nameConflict = /таким наименованием|уже есть/i.test(message);
  if (nameConflict) {
    return {
      formError: '',
      fieldErrors: { name: 'Подрядчик с таким наименованием уже есть' },
    };
  }
  return {
    formError: message || 'Не удалось сохранить подрядчика',
    fieldErrors: {},
  };
}

export function formatContractorDefaults(row) {
  const sets = row?.requisite_sets || {};
  const kind = normalizeRequisiteKind(sets.person_type_default);
  const name = requisiteName(sets, kind);
  const inn = requisiteInn(sets, kind);
  if (!name && !inn) return '—';
  return [name || personTypeLabel(kind), inn && `ИНН ${inn}`].filter(Boolean).join(' · ');
}

export function formatContractorTypeCoverage(row) {
  const kinds = filledRequisiteKinds(row?.requisite_sets || {});
  if (!kinds.length) return 'Реквизиты не заполнены';
  return kinds.map(personTypeLabel).join(', ');
}

export function formatContractorAmount(value) {
  const amount = Number(value || 0);
  return `${amount.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₽`;
}

export function formatContractorPayment(row) {
  if (row?.salary_type === 'percent_work') {
    const percent = Number(row?.work_percent || 0);
    return percent > 0 ? `${percent}%` : '—';
  }
  const amount = Number(row?.salary_amount || 0);
  return amount > 0 ? formatContractorAmount(amount) : '—';
}
