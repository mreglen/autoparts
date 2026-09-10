import { forwardRef, useLayoutEffect, useRef } from 'react';
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

  const setRef = (el) => {
    inputRef.current = el;
    if (typeof ref === 'function') {
      ref(el);
    } else if (ref) {
      // eslint-disable-next-line no-param-reassign
      ref.current = el;
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
    if (document.activeElement === input) {
      try {
        input.setSelectionRange(selectionStart, selectionEnd);
      } catch {
        // ignore
      }
    }

    onChange(e);
  };

  useLayoutEffect(() => {
    const input = inputRef.current;
    if (!input || caretRef.current.start === null) return;
    if (document.activeElement === input) {
      try {
        input.setSelectionRange(caretRef.current.start, caretRef.current.end);
      } catch {
        // type="tel" / text on some browsers may reject selection updates
      }
    }
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
