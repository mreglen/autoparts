import { FieldHint, FieldLabel, Input, Textarea } from '../UI';
import { formatPhoneInput } from '../../utils/contactValidation';
import {
  CLIENT_PLACEHOLDERS,
  PERSON_TYPES,
  normalizePersonType,
} from '../../utils/autoserviceClientRequisites';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export default function AutoserviceClientRequisitesFields({
  form,
  onChange,
  isGuest = true,
  disabled = false,
  idPrefix = 'client-req',
}) {
  const personType = normalizePersonType(form?.person_type);
  const lockIdentity = !isGuest;
  const setField = (name, value) => onChange?.({ ...form, [name]: value });

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Тип</FieldLabel>
        <div className="grid grid-cols-3 gap-1 rounded-lg border border-gray-200 bg-gray-50 p-1">
          {PERSON_TYPES.map((item) => {
            const active = personType === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => setField('person_type', item.id)}
                className={cx(
                  'rounded-md px-2 py-2 text-sm font-medium transition',
                  active
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900',
                  disabled ? 'cursor-not-allowed opacity-60' : '',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className={personType === 'legal' ? 'sm:col-span-2' : ''}>
          <FieldLabel htmlFor={`${idPrefix}-name`}>ФИО</FieldLabel>
          <Input
            id={`${idPrefix}-name`}
            value={form?.name || ''}
            onChange={(e) => setField('name', e.target.value)}
            placeholder={CLIENT_PLACEHOLDERS.name}
            disabled={disabled || lockIdentity}
            maxLength={120}
          />
          {lockIdentity ? (
            <FieldHint>Из аккаунта клиента — изменить нельзя</FieldHint>
          ) : null}
        </div>
        <div>
          <FieldLabel htmlFor={`${idPrefix}-phone`}>Телефон</FieldLabel>
          <Input
            id={`${idPrefix}-phone`}
            type="tel"
            value={form?.phone || ''}
            onChange={(e) => setField('phone', formatPhoneInput(e.target.value))}
            placeholder={CLIENT_PLACEHOLDERS.phone}
            disabled={disabled || lockIdentity}
          />
        </div>
      </div>

      {personType === 'legal' ? (
        <div>
          <FieldLabel htmlFor={`${idPrefix}-legal-name`}>Наименование организации</FieldLabel>
          <Input
            id={`${idPrefix}-legal-name`}
            value={form?.legal_name || ''}
            onChange={(e) => setField('legal_name', e.target.value)}
            placeholder={CLIENT_PLACEHOLDERS.legal_name}
            disabled={disabled}
            maxLength={255}
          />
        </div>
      ) : null}

      {personType === 'ie' ? (
        <div>
          <FieldLabel htmlFor={`${idPrefix}-legal-name`}>Наименование ИП</FieldLabel>
          <Input
            id={`${idPrefix}-legal-name`}
            value={form?.legal_name || ''}
            onChange={(e) => setField('legal_name', e.target.value)}
            placeholder={CLIENT_PLACEHOLDERS.legal_name_ie}
            disabled={disabled}
            maxLength={255}
          />
          <FieldHint>Если пусто, в документах будет «ИП» и ФИО</FieldHint>
        </div>
      ) : null}

      <div>
        <FieldLabel htmlFor={`${idPrefix}-address`}>
          {personType === 'legal' ? 'Юридический адрес' : 'Адрес'}
        </FieldLabel>
        <Textarea
          id={`${idPrefix}-address`}
          rows={2}
          value={form?.address || ''}
          onChange={(e) => setField('address', e.target.value)}
          placeholder={CLIENT_PLACEHOLDERS.address}
          disabled={disabled}
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${idPrefix}-inn`}>ИНН</FieldLabel>
          <Input
            id={`${idPrefix}-inn`}
            inputMode="numeric"
            value={form?.inn || ''}
            onChange={(e) => setField('inn', e.target.value.replace(/\D/g, '').slice(0, 12))}
            placeholder={
              personType === 'legal' ? CLIENT_PLACEHOLDERS.inn_legal : CLIENT_PLACEHOLDERS.inn_individual
            }
            disabled={disabled}
          />
        </div>
        {personType === 'legal' ? (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-kpp`}>КПП</FieldLabel>
            <Input
              id={`${idPrefix}-kpp`}
              inputMode="numeric"
              value={form?.kpp || ''}
              onChange={(e) => setField('kpp', e.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder={CLIENT_PLACEHOLDERS.kpp}
              disabled={disabled}
            />
          </div>
        ) : null}
        {personType === 'legal' ? (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-ogrn`}>ОГРН</FieldLabel>
            <Input
              id={`${idPrefix}-ogrn`}
              inputMode="numeric"
              value={form?.ogrn || ''}
              onChange={(e) => setField('ogrn', e.target.value.replace(/\D/g, '').slice(0, 13))}
              placeholder={CLIENT_PLACEHOLDERS.ogrn}
              disabled={disabled}
            />
          </div>
        ) : null}
        {personType === 'ie' ? (
          <div>
            <FieldLabel htmlFor={`${idPrefix}-ogrn`}>ОГРНИП</FieldLabel>
            <Input
              id={`${idPrefix}-ogrn`}
              inputMode="numeric"
              value={form?.ogrn || ''}
              onChange={(e) => setField('ogrn', e.target.value.replace(/\D/g, '').slice(0, 15))}
              placeholder={CLIENT_PLACEHOLDERS.ogrnip}
              disabled={disabled}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
