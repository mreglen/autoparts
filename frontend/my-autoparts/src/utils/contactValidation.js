import { flushSync } from 'react-dom';

/** ФИО: фамилия, имя, отчество (отчество опционально), кириллица, дефис в частях */
export const FULL_NAME_REGEX =
  /^[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?\s+[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?(?:\s+[А-ЯЁа-яё]+(?:-[А-ЯЁа-яё]+)?)?$/;

export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

/** Нормализует введённые цифры к формату 7XXXXXXXXXX (макс. 11 цифр). */
function normalizePhoneDigits(digits) {
  let d = String(digits || '').replace(/\D/g, '');
  if (!d) return '';
  if (d.startsWith('8')) {
    d = `7${d.slice(1)}`;
  } else if (!d.startsWith('7')) {
    d = `7${d}`;
  }
  return d.slice(0, 11);
}

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
  return formatPhoneInput(phone);
}

export function formatPhoneInput(inputValue) {
  const digits = normalizePhoneDigits(inputValue);
  if (!digits) return '';

  const national = digits.slice(1);
  if (national.length === 0) return '+7';

  let formatted = '+7';
  if (national.length <= 3) formatted += ` (${national}`;
  else if (national.length <= 6) formatted += ` (${national.slice(0, 3)}) ${national.slice(3)}`;
  else if (national.length <= 8) {
    formatted += ` (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6)}`;
  } else {
    formatted += ` (${national.slice(0, 3)}) ${national.slice(3, 6)}-${national.slice(6, 8)}-${national.slice(8)}`;
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
  const raw = String(inputValue || '');
  const cursor = selectionStart ?? raw.length;
  const digitsBeforeCursor = normalizePhoneDigits(raw.slice(0, cursor).replace(/\D/g, '')).length;
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
  const { selectionStart, selectionEnd, value } = result;

  flushSync(() => {
    setValue(value);
  });

  if (document.activeElement === input) {
    try {
      input.setSelectionRange(selectionStart, selectionEnd);
    } catch {
      // type="tel" on some browsers may reject selection updates
    }
  }
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
