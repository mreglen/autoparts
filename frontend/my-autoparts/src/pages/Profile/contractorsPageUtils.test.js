import {
  buildContractorPayload,
  contractorFormFromApi,
  emptyContractorForm,
  formatContractorDefaults,
  formatContractorTypeCoverage,
  parseContractorSaveError,
  validateContractorForm,
} from './contractorsPageUtils';

describe('contractorsPageUtils', () => {
  it('buildContractorPayload trims fields and blanks empty requisites to null', () => {
    const payload = buildContractorPayload({
      ...emptyContractorForm(),
      name: '  Урал Стартер  ',
      phone: ' ',
      requisite_sets: {
        ...emptyContractorForm().requisite_sets,
        person_type_default: 'ie',
        ie_name: ' ИП Урал Стартер ',
        inn_ie: '6658004125',
      },
    });

    expect(payload.name).toBe('Урал Стартер');
    expect(payload.phone).toBeNull();
    expect(payload.note).toBeNull();
    expect(payload.requisite_sets.person_type_default).toBe('ie');
    expect(payload.requisite_sets.ie_name).toBe('ИП Урал Стартер');
    expect(payload.requisite_sets.inn_ie).toBe('6658004125');
    expect(payload.requisite_sets.legal_name).toBeNull();
    expect(payload.requisite_sets.kpp).toBeNull();
  });

  it('contractorFormFromApi turns nulls into empty strings for the form', () => {
    const form = contractorFormFromApi({
      name: 'Урал',
      phone: null,
      note: undefined,
      requisite_sets: { person_type_default: 'legal', legal_name: 'ООО «Урал»', inn_legal: '6658004125' },
    });

    expect(form.phone).toBe('');
    expect(form.note).toBe('');
    expect(form.requisite_sets.person_type_default).toBe('legal');
    expect(form.requisite_sets.legal_name).toBe('ООО «Урал»');
    expect(form.requisite_sets.email).toBe('');
  });

  it('validateContractorForm requires name and checks digits', () => {
    const form = {
      ...emptyContractorForm(),
      requisite_sets: { ...emptyContractorForm().requisite_sets, inn_legal: '12345', kpp: '123' },
    };
    expect(validateContractorForm(form)).toEqual({
      name: 'Наименование обязательно',
      inn_legal: 'ИНН: 10 или 12 цифр',
      kpp: 'КПП: 9 цифр',
    });
  });

  it('validateContractorForm rejects malformed email only', () => {
    const form = { ...emptyContractorForm(), name: 'Урал' };
    expect(validateContractorForm({ ...form, requisite_sets: { ...form.requisite_sets, email: 'nope' } }))
      .toEqual({ email: 'Неверный формат email' });
    expect(validateContractorForm({ ...form, requisite_sets: { ...form.requisite_sets, email: 'a@b.ru' } }))
      .toEqual({});
  });

  it('formatContractorDefaults shows the default set only', () => {
    const row = {
      requisite_sets: {
        person_type_default: 'legal',
        legal_name: 'ООО «Урал Стартер»',
        inn_legal: '6658004125',
        ind_name: 'Иванов И.И.',
      },
    };
    expect(formatContractorDefaults(row)).toBe('ООО «Урал Стартер» · ИНН 6658004125');
    expect(formatContractorDefaults({ requisite_sets: {} })).toBe('—');
  });

  it('formatContractorTypeCoverage lists filled sets', () => {
    expect(formatContractorTypeCoverage({
      requisite_sets: { ie_name: 'ИП Урал', inn_ie: '6658004125', legal_name: 'ООО Урал' },
    })).toBe('ИП, Юрлицо');
    expect(formatContractorTypeCoverage({ requisite_sets: {} })).toBe('Реквизиты не заполнены');
  });

  it('parseContractorSaveError maps a duplicate name onto the field', () => {
    expect(parseContractorSaveError('Подрядчик с таким наименованием уже есть')).toEqual({
      formError: '',
      fieldErrors: { name: 'Подрядчик с таким наименованием уже есть' },
    });
    expect(parseContractorSaveError('Нет доступа')).toEqual({
      formError: 'Нет доступа',
      fieldErrors: {},
    });
  });
});
