import {
  emptyRequisiteSets,
  filledRequisiteKinds,
  isRequisiteSetFilled,
  requisiteSetsFromApi,
  requisiteSetsPayload,
  validateRequisiteSets,
} from './requisiteSets';

describe('requisiteSets', () => {
  it('normalizes an API payload into form strings', () => {
    const sets = requisiteSetsFromApi({ person_type_default: 'wrong', legal_name: 'ООО «Урал»', kpp: null });
    expect(sets.person_type_default).toBe('individual');
    expect(sets.legal_name).toBe('ООО «Урал»');
    expect(sets.kpp).toBe('');
    expect(sets.address).toBe('');
  });

  it('builds a payload with digits cleaned and blanks as null', () => {
    const sets = {
      ...emptyRequisiteSets(),
      person_type_default: 'legal',
      legal_name: '  ООО «Урал» ',
      inn_legal: '66-58 004125',
      address: '  ',
    };
    const payload = requisiteSetsPayload(sets);
    expect(payload.person_type_default).toBe('legal');
    expect(payload.legal_name).toBe('ООО «Урал»');
    expect(payload.inn_legal).toBe('6658004125');
    expect(payload.address).toBeNull();
    expect(payload.ogrnip).toBeNull();
  });

  it('reports which kinds are filled', () => {
    const sets = { ...emptyRequisiteSets(), ie_name: 'ИП Урал', inn_legal: '6658004125' };
    expect(isRequisiteSetFilled(sets, 'ie')).toBe(true);
    expect(isRequisiteSetFilled(sets, 'individual')).toBe(false);
    expect(filledRequisiteKinds(sets)).toEqual(['ie', 'legal']);
  });

  it('validates digit lengths per field', () => {
    expect(validateRequisiteSets({ ...emptyRequisiteSets(), ogrnip: '123', ogrn: '1234567890123' })).toEqual({
      ogrnip: 'ОГРНИП: 15 цифр',
    });
    expect(validateRequisiteSets({
      ...emptyRequisiteSets(),
      inn_ie: '123456789012',
      kpp: '123456789',
      ogrn: '1026605000000',
      email: 'ok@mail.ru',
    })).toEqual({});
  });
});
