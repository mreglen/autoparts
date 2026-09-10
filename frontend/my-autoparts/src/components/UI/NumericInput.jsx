import { forwardRef, useEffect, useLayoutEffect, useRef } from 'react';

function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

function isDecimalMode(mode) {
  return mode === 'decimal';
}

function sanitizeValue(raw, { mode, maxLength }) {
  let text = String(raw ?? '');
  if (isDecimalMode(mode)) {
    text = text.replace(/,/g, '.').replace(/[^0-9.]/g, '');
    const firstDot = text.indexOf('.');
    if (firstDot !== -1) {
      text = text.slice(0, firstDot + 1) + text.slice(firstDot + 1).replace(/\./g, '');
    }
  } else {
    text = text.replace(/\D/g, '');
  }
  if (maxLength && text.length > maxLength) {
    text = text.slice(0, maxLength);
  }
  return text;
}

const NumericInput = forwardRef(function NumericInput(
  { value, onChange, mode = 'numeric', maxLength, className = '', ...rest },
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
    const start = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? 0;
    const sanitized = sanitizeValue(raw, { mode, maxLength });

    const diff = raw.length - sanitized.length;
    const nextStart = Math.max(0, start - diff);
    const nextEnd = Math.max(0, end - diff);
    caretRef.current = { start: nextStart, end: nextEnd };

    input.value = sanitized;
    applyCaret(input, nextStart, nextEnd);

    window.clearTimeout(caretTimerRef.current);
    caretTimerRef.current = window.setTimeout(() => {
      if (inputRef.current && inputRef.current.value === sanitized) {
        applyCaret(inputRef.current, nextStart, nextEnd);
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
      inputMode={isDecimalMode(mode) ? 'decimal' : 'numeric'}
      value={value ?? ''}
      onChange={handleChange}
      maxLength={maxLength}
      className={cx(className)}
      {...rest}
    />
  );
});

export default NumericInput;
