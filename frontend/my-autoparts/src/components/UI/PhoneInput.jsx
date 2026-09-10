import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';
import { formatPhoneInputChange } from '../../utils/contactValidation';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

const PhoneInput = forwardRef(function PhoneInput(
  { value, onChange, className = '', ...rest },
  ref,
) {
  const inputRef = useRef(null);
  const caretRef = useRef({ start: null, end: null });
  const caretTimerRef = useRef(null);

  useEffect(() => () => {
    window.clearTimeout(caretTimerRef.current);
  }, []);

  const setRef = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') {
      ref(el);
    } else if (ref) {
      // eslint-disable-next-line no-param-reassign
      ref.current = el;
    }
  };

  const applyCaret = (input, start, end) => {
    if (!input || document.activeElement !== input) return;
    try {
      input.setSelectionRange(start, end);
    } catch {
      // ignore
    }
  };

  const handleChange = (e) => {
    const input = e.target;
    const raw = input.value;
    const { value: formatted, selectionStart, selectionEnd } = formatPhoneInputChange(
      raw,
      input.selectionStart ?? raw.length,
    );

    caretRef.current = { start: selectionStart, end: selectionEnd };

    input.value = formatted;
    applyCaret(input, selectionStart, selectionEnd);

    window.clearTimeout(caretTimerRef.current);
    caretTimerRef.current = window.setTimeout(() => {
      if (inputRef.current && inputRef.current.value === formatted) {
        applyCaret(inputRef.current, selectionStart, selectionEnd);
      }
    }, 0);

    onChange(e);
  };

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || caretRef.current.start === null) return;
    applyCaret(input, caretRef.current.start, caretRef.current.end);
    caretRef.current = { start: null, end: null };
  }, [value]);

  return (
    <input
      ref={setRef}
      type="text"
      inputMode="tel"
      value={value ?? ''}
      onChange={handleChange}
      className={cx(className)}
      {...rest}
    />
  );
});

export default PhoneInput;
