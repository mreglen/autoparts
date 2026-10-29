export const REQUISITE_KINDS = ['individual', 'ie', 'legal'];

export const REQUISITE_SET_FIELDS = [
  'person_type_default',
  'ind_name',
  'ie_name',
  'legal_name',
  'inn_individual',
  'inn_ie',
  'inn_legal',
  'kpp',
  'ogrnip',
  'ogrn',
  'address',
  'email',
];

const NAME_FIELD_BY_KIND = {
  individual: 'ind_name',
  ie: 'ie_name',
  legal: 'legal_name',
};

const INN_FIELD_BY_KIND = {
  individual: 'inn_individual',
  ie: 'inn_ie',
  legal: 'inn_legal',
};

const DIGIT_FIELDS = {
  inn_individual: 12,
  inn_ie: 12,
  inn_legal: 12,
  kpp: 9,
  ogrnip: 15,
  ogrn: 15,
};

export function normalizeRequisiteKind(value) {
  return REQUISITE_KINDS.includes(value) ? value : 'individual';
}

export function emptyRequisiteSets() {
  return REQUISITE_SET_FIELDS.reduce((acc, field) => {
    acc[field] = field === 'person_type_default' ? 'individual' : '';
    return acc;
  }, {});
}

export function requisiteSetsFromApi(sets) {
  const source = sets || {};
  return REQUISITE_SET_FIELDS.reduce((acc, field) => {
    acc[field] = field === 'person_type_default'
      ? normalizeRequisiteKind(source[field])
      : String(source[field] ?? '');
    return acc;
  }, {});
}

export function requisiteSetsPayload(sets) {
  const source = sets || {};
  return REQUISITE_SET_FIELDS.reduce((acc, field) => {
    if (field === 'person_type_default') {
      acc[field] = normalizeRequisiteKind(source[field]);
      return acc;
    }
    const value = String(source[field] ?? '').trim();
    acc[field] = field in DIGIT_FIELDS ? value.replace(/\D/g, '') : value;
    acc[field] = acc[field] || null;
    return acc;
  }, {});
}

export function requisiteName(sets, kind) {
  return String(sets?.[NAME_FIELD_BY_KIND[kind]] || '').trim();
}

export function requisiteInn(sets, kind) {
  return String(sets?.[INN_FIELD_BY_KIND[kind]] || '').trim();
}

export function isRequisiteSetFilled(sets, kind) {
  return Boolean(requisiteName(sets, kind) || requisiteInn(sets, kind));
}

export function filledRequisiteKinds(sets) {
  return REQUISITE_KINDS.filter((kind) => isRequisiteSetFilled(sets, kind));
}

export function validateRequisiteSets(sets) {
  const errors = {};
  REQUISITE_KINDS.forEach((kind) => {
    const inn = requisiteInn(sets, kind);
    if (inn && inn.length !== 10 && inn.length !== 12) {
      errors[INN_FIELD_BY_KIND[kind]] = 'ИНН: 10 или 12 цифр';
    }
  });
  const kpp = String(sets?.kpp || '').trim();
  if (kpp && kpp.length !== 9) errors.kpp = 'КПП: 9 цифр';
  const ogrnip = String(sets?.ogrnip || '').trim();
  if (ogrnip && ogrnip.length !== 15) errors.ogrnip = 'ОГРНИП: 15 цифр';
  const ogrn = String(sets?.ogrn || '').trim();
  if (ogrn && ogrn.length !== 13) errors.ogrn = 'ОГРН: 13 цифр';
  const email = String(sets?.email || '').trim();
  if (email && !/\S+@\S+\.\S+/.test(email)) errors.email = 'Неверный формат email';
  return errors;
}

export function requisiteSetsChanged(a, b) {
  return REQUISITE_SET_FIELDS.some(
    (field) => String(a?.[field] || '').trim() !== String(b?.[field] || '').trim(),
  );
}
