import {
  CLIENT_PLACEHOLDERS,
  PERSON_TYPES,
  normalizePersonType,
  personTypeLabel,
  validateInn,
} from './autoserviceClientRequisites';

export {
  PERSON_TYPES,
  CLIENT_PLACEHOLDERS as PAYER_PLACEHOLDERS,
  normalizePersonType,
  personTypeLabel,
  validateInn,
};

export function payerDisplayName(payer) {
  const type = normalizePersonType(payer?.person_type);
  const name = String(payer?.name || '').trim();
  const legal = String(payer?.legal_name || '').trim();
  if (type === 'legal') return legal || name;
  if (type === 'ie') return legal || (name ? `ИП ${name}` : '');
  return name;
}

export function emptyPayerRequisites(payer) {
  return {
    name: payer?.name || '',
    email: payer?.email || '',
    person_type: normalizePersonType(payer?.person_type),
    legal_name: payer?.legal_name || '',
    address: payer?.address || '',
    inn: payer?.inn || '',
    kpp: payer?.kpp || '',
    ogrn: payer?.ogrn || '',
  };
}

export function payerRequisitesPayload(form) {
  const personType = normalizePersonType(form?.person_type);
  return {
    name: String(form?.name || '').trim(),
    email: String(form?.email || '').trim().toLowerCase() || null,
    person_type: personType,
    legal_name: String(form?.legal_name || '').trim() || null,
    address: String(form?.address || '').trim() || null,
    inn: String(form?.inn || '').trim() || null,
    kpp: personType === 'legal' ? String(form?.kpp || '').trim() || null : null,
    ogrn: personType === 'individual' ? null : String(form?.ogrn || '').trim() || null,
  };
}

export function validatePayerRequisites(form) {
  const name = String(form?.name || '').trim();
  const personType = normalizePersonType(form?.person_type);
  if (!name) {
    return personType === 'legal' ? 'Укажите ФИО контактного лица' : 'Укажите ФИО';
  }
  const innError = validateInn(form?.inn);
  if (innError) return innError;
  if (personType === 'legal' && !String(form?.legal_name || '').trim()) {
    return 'Укажите наименование организации';
  }
  return null;
}

export function payerSearchText(payer) {
  return [
    payerDisplayName(payer),
    payer?.name,
    payer?.legal_name,
    payer?.email,
    payer?.inn,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}
