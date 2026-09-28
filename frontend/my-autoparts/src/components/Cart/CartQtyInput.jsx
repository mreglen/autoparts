import { useState } from 'react';

/**
 * Editable quantity field for cart steppers.
 * Digits only; committing an empty value resolves to 0.
 */
export default function CartQtyInput({ value, maxQty, onCommit, disabled, className = '' }) {
  const [draft, setDraft] = useState(null);

  const commit = () => {
    const raw = draft;
    setDraft(null);
    if (raw == null) return;
    const digits = String(raw).replace(/\D/g, '');
    if (!digits) {
      onCommit?.(0);
      return;
    }
    let next = parseInt(digits, 10);
    if (Number.isFinite(maxQty) && maxQty > 0 && next > maxQty) next = maxQty;
    onCommit?.(next);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      pattern="[0-9]*"
      autoComplete="off"
      aria-label="Количество"
      className={className}
      value={draft ?? String(value)}
      disabled={disabled}
      onFocus={(e) => {
        setDraft(String(value));
        e.target.select();
      }}
      onChange={(e) => setDraft(e.target.value.replace(/\D/g, ''))}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter') e.currentTarget.blur();
      }}
      onClick={(e) => e.stopPropagation()}
    />
  );
}
