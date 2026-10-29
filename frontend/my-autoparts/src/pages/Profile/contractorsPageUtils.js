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

export function emptyContractorForm() {
  return {
    name: '',
    phone: '',
    note: '',
    requisite_sets: emptyRequisiteSets(),
  };
}

export function contractorFormFromApi(row) {
  return {
    name: row?.name || '',
    phone: row?.phone || '',
    note: row?.note || '',
    requisite_sets: requisiteSetsFromApi(row?.requisite_sets),
  };
}

export function buildContractorPayload(form) {
  return {
    name: String(form?.name || '').trim(),
    phone: String(form?.phone || '').trim() || null,
    note: String(form?.note || '').trim() || null,
    requisite_sets: requisiteSetsPayload(form?.requisite_sets),
  };
}

export function validateContractorForm(form) {
  const errors = {};
  if (!String(form?.name || '').trim()) {
    errors.name = 'Наименование обязательно';
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
