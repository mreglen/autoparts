/** ФИО: фамилия, имя, отчество (отчество опционально), кириллица, дефис в частях */
export const FULL_NAME_REGEX =
  /^[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?\s+[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?(?:\s+[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?)?$/;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function normalizeFullName(value) {
  return (value || '').replace(/\s+/g, ' ').trim();
}

export function validateFullName(value) {
  const normalized = normalizeFullName(value);
  if (!normalized) return 'Укажите ФИО';
  if (!FULL_NAME_REGEX.test(normalized)) {
    return 'Введите фамилию, имя и при необходимости отчество кириллицей (например: Иванов Иван Иванович)';
  }
  const parts = normalized.split(' ');
  if (parts.length < 2) return 'Укажите как минимум фамилию и имя';
  if (parts.some((part) => part.length < 2)) {
    return 'Каждая часть ФИО должна содержать не менее 2 букв';
  }
  return '';
}

export function normalizeEmail(value) {
  return (value || '').trim().toLowerCase();
}

/** Форматирование email при вводе: без пробелов, в нижнем регистре */
export function formatEmailInput(value) {
  return (value || '').replace(/\s+/g, '').toLowerCase();
}

export function validateEmail(value) {
  const raw = value || '';
  if (!raw.trim()) return 'Укажите email';
  if (/\s/.test(raw)) return 'Email не должен содержать пробелов';
  const email = normalizeEmail(raw);
  if (!EMAIL_REGEX.test(email)) return 'Неверный формат email (например: name@mail.ru)';
  return '';
}

export function formatPhoneFromRaw(phone) {
  if (!phone) return '';
  let digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('8')) digits = '7' + digits.slice(1);
  if (digits.startsWith('7')) digits = digits.slice(0, 11);
  else if (digits.length === 10) digits = '7' + digits;
  else return formatPhoneInput('+7' + digits.slice(0, 10));

  let formatted = '+7';
  if (digits.length > 1) formatted += ` (${digits.slice(1, 4)}`;
  if (digits.length > 4) formatted += `) ${digits.slice(4, 7)}`;
  if (digits.length > 7) formatted += `-${digits.slice(7, 9)}`;
  if (digits.length > 9) formatted += `-${digits.slice(9, 11)}`;
  return formatted;
}

export function formatPhoneInput(inputValue) {
  let digits = (inputValue || '').replace(/[^\d+]/g, '');
  if (digits.startsWith('8')) digits = '+7' + digits.slice(1);
  else if (digits.startsWith('7') && !digits.startsWith('+')) digits = '+7' + digits.slice(1);
  else if (digits === '+') digits = '+7';
  else if (!digits.startsWith('+7')) {
    if (!digits.startsWith('+')) digits = '';
  }

  const cleanDigits = digits.replace(/\D/g, '');
  if (cleanDigits.length > 11) digits = '+7' + cleanDigits.slice(1, 11);

  let formatted = digits;
  if (digits.startsWith('+7')) {
    const rest = digits.slice(2);
    if (rest.length === 0) formatted = '+7';
    else if (rest.length <= 3) formatted = `+7 (${rest}`;
    else if (rest.length <= 6) formatted = `+7 (${rest.slice(0, 3)}) ${rest.slice(3)}`;
    else if (rest.length <= 8) {
      formatted = `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6)}`;
    } else if (rest.length <= 10) {
      formatted = `+7 (${rest.slice(0, 3)}) ${rest.slice(3, 6)}-${rest.slice(6, 8)}-${rest.slice(8)}`;
    }
  }
  return formatted;
}

function getPhoneCursorPosition(formatted, digitsBeforeCursor) {
  if (!formatted) return 0;
  if (digitsBeforeCursor <= 0) {
    return formatted.startsWith('+7') ? 3 : 0;
  }

  let seen = 0;
  for (let i = 0; i < formatted.length; i += 1) {
    if (/\d/.test(formatted[i])) {
      seen += 1;
      if (seen >= digitsBeforeCursor) {
        return i + 1;
      }
    }
  }
  return formatted.length;
}

export function formatPhoneInputChange(inputValue, selectionStart = null) {
  const cursor = selectionStart ?? String(inputValue || '').length;
  const digitsBeforeCursor = String(inputValue || '')
    .slice(0, cursor)
    .replace(/\D/g, '').length;
  const formatted = formatPhoneInput(inputValue);
  const nextCursor = getPhoneCursorPosition(formatted, digitsBeforeCursor);

  return {
    value: formatted,
    selectionStart: nextCursor,
    selectionEnd: nextCursor,
  };
}

export function handlePhoneInputChange(event, setValue) {
  const input = event.target;
  const result = formatPhoneInputChange(input.value, input.selectionStart ?? input.value.length);
  const { selectionStart, selectionEnd } = result;
  setValue(result.value);
  const restoreCursor = () => {
    if (document.activeElement === input) {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  };
  requestAnimationFrame(() => requestAnimationFrame(restoreCursor));
}

export function validatePhone(value) {
  const pure = (value || '').replace(/\D/g, '');
  if (!pure) return 'Укажите номер телефона';
  if (pure.length !== 11 || !pure.startsWith('7')) {
    return 'Введите полный номер в формате +7 (___) ___-__-__';
  }
  return '';
}

export function validatePhoneOptional(value) {
  const pure = (value || '').replace(/\D/g, '');
  if (!pure) return '';
  return validatePhone(value);
}

export function isPhoneComplete(value) {
  const pure = (value || '').replace(/\D/g, '');
  return pure.length === 11 && pure.startsWith('7');
}
