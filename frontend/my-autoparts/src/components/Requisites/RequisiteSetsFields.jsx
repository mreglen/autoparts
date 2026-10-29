import { FieldHint, FieldLabel, Input, NumericInput, PhoneInput, Textarea } from '../UI';
import { PERSON_TYPES, CLIENT_PLACEHOLDERS } from '../../utils/autoserviceClientRequisites';
import { normalizeRequisiteKind } from '../../utils/requisiteSets';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function SetBlock({ title, hint, children }) {
  return (
    <div className="rounded-sg-sm border border-line bg-surface-subtle/60 p-3">
      <div className="mb-3 flex flex-wrap items-baseline gap-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h4>
        {hint ? <span className="text-xs text-ink-muted">{hint}</span> : null}
      </div>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

export default function RequisiteSetsFields({
  sets,
  onChange,
  errors = {},
  disabled = false,
  idPrefix = 'req',
  showContacts = false,
  onPhoneChange,
  phoneValue = '',
}) {
  const defaultKind = normalizeRequisiteKind(sets?.person_type_default);
  const setField = (name, value) => onChange?.({ ...sets, [name]: value });

  const textField = (name, label, placeholder, extra) => (
    <div className={extra?.span ? 'sm:col-span-2' : ''}>
      <FieldLabel htmlFor={`${idPrefix}-${name}`}>{label}</FieldLabel>
      <Input
        id={`${idPrefix}-${name}`}
        value={sets?.[name] || ''}
        onChange={(e) => setField(name, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
        maxLength={255}
        error={Boolean(errors[name])}
      />
      {errors[name] ? <FieldHint error>{errors[name]}</FieldHint> : null}
    </div>
  );

  const digitField = (name, label, maxLength, placeholder) => (
    <div className="sm:max-w-[220px]">
      <FieldLabel htmlFor={`${idPrefix}-${name}`}>{label}</FieldLabel>
      <NumericInput
        id={`${idPrefix}-${name}`}
        maxLength={maxLength}
        value={sets?.[name] || ''}
        onChange={(e) => setField(name, e.target.value)}
        placeholder={placeholder}
        disabled={disabled}
      />
      {errors[name] ? <FieldHint error>{errors[name]}</FieldHint> : null}
    </div>
  );

  return (
    <div className="space-y-4">
      <div>
        <FieldLabel>Тип по умолчанию для документов</FieldLabel>
        <div className="grid grid-cols-3 gap-1 rounded-sg-sm border border-line bg-surface-muted p-1">
          {PERSON_TYPES.map((item) => {
            const active = defaultKind === item.id;
            return (
              <button
                key={item.id}
                type="button"
                disabled={disabled}
                onClick={() => setField('person_type_default', item.id)}
                className={cx(
                  'rounded-md px-2 py-2 text-sm font-medium transition',
                  active ? 'bg-surface text-ink shadow-sm' : 'text-ink-muted hover:text-ink',
                  disabled ? 'cursor-not-allowed opacity-60' : '',
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
        <FieldHint>Реквизиты есть для каждого типа — при печати тип выбирается разово.</FieldHint>
      </div>

      {showContacts ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor={`${idPrefix}-phone`}>Телефон</FieldLabel>
            <PhoneInput
              id={`${idPrefix}-phone`}
              value={phoneValue}
              onChange={(e) => onPhoneChange?.(e.target.value)}
              placeholder={CLIENT_PLACEHOLDERS.phone}
              disabled={disabled}
            />
          </div>
          <div>
            <FieldLabel htmlFor={`${idPrefix}-email`}>Email</FieldLabel>
            <Input
              id={`${idPrefix}-email`}
              type="email"
              autoComplete="email"
              value={sets?.email || ''}
              onChange={(e) => setField('email', e.target.value)}
              placeholder={CLIENT_PLACEHOLDERS.email}
              disabled={disabled}
              maxLength={255}
              error={Boolean(errors.email)}
            />
            {errors.email ? <FieldHint error>{errors.email}</FieldHint> : null}
          </div>
        </div>
      ) : null}

      <SetBlock title="Физлицо">
        {textField('ind_name', 'ФИО', CLIENT_PLACEHOLDERS.name, { span: true })}
        {digitField('inn_individual', 'ИНН', 12, '12 цифр')}
      </SetBlock>

      <SetBlock title="ИП" hint="Если наименование пусто, в документах будет «ИП» и ФИО">
        {textField('ie_name', 'Наименование ИП', 'ИП Иванов Иван Иванович', { span: true })}
        {digitField('inn_ie', 'ИНН', 12, '12 цифр')}
        {digitField('ogrnip', 'ОГРНИП', 15, CLIENT_PLACEHOLDERS.ogrnip)}
      </SetBlock>

      <SetBlock title="Юрлицо">
        {textField('legal_name', 'Наименование организации', CLIENT_PLACEHOLDERS.legal_name, { span: true })}
        {digitField('inn_legal', 'ИНН', 12, '10 цифр')}
        {digitField('kpp', 'КПП', 9, CLIENT_PLACEHOLDERS.kpp)}
        {digitField('ogrn', 'ОГРН', 13, CLIENT_PLACEHOLDERS.ogrn)}
      </SetBlock>

      <div>
        <FieldLabel htmlFor={`${idPrefix}-address`}>Адрес</FieldLabel>
        <Textarea
          id={`${idPrefix}-address`}
          rows={2}
          value={sets?.address || ''}
          onChange={(e) => setField('address', e.target.value)}
          placeholder={CLIENT_PLACEHOLDERS.address}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
