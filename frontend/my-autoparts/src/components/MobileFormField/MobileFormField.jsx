import React, { useId } from 'react';

/**
 * Consistent label + control stack with 44px touch target on mobile inputs.
 * Pass the actual control as `children` (input, select, textarea).
 */
export default function MobileFormField({
  label,
  htmlFor,
  required,
  error,
  hint,
  children,
  className = '',
}) {
  const errorId = useId();
  const hintId = useId();

  return (
    <div className={`space-y-1 ${className}`}>
      {label ? (
        <label htmlFor={htmlFor} className="block text-sm font-medium text-gray-800">
          {label}
          {required ? <span className="text-red-600"> *</span> : null}
        </label>
      ) : null}
      <div className="max-md:[&_input:not([type=checkbox]):not([type=radio])]:min-h-11 max-md:[&_input:not([type=checkbox]):not([type=radio])]:text-base max-md:[&_select]:min-h-11 max-md:[&_select]:text-base max-md:[&_textarea]:min-h-11 max-md:[&_textarea]:text-base">
        {children}
      </div>
      {hint ? <p id={hintId} className="text-xs text-gray-500">{hint}</p> : null}
      {error ? <p id={errorId} className="text-sm text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
