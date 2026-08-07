import { useEffect, useRef } from 'react';

function ChevronIcon({ open }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="currentColor" viewBox="0 0 20 20" aria-hidden>
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function PillDropdown({
  value,
  onChange,
  options = [],
  placeholder = 'Выберите',
  disabled = false,
  ariaLabel,
  className = '',
  menuClassName = '',
  triggerClassName = '',
  prefix = null,
  fullWidth = true,
  isOpen = false,
  onOpenChange,
}) {
  const rootRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        onOpenChange?.(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onOpenChange]);

  const selected = options.find((option) => String(option.value) === String(value));
  const displayLabel = selected?.label || placeholder;
  const hasValue = value !== '' && value != null;

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) {
            onOpenChange?.(!isOpen);
          }
        }}
        className={`flex h-10 items-center justify-between gap-2 rounded-full border border-transparent bg-gray-100 px-4 text-left text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60 ${
          fullWidth ? 'w-full' : 'w-auto'
        } ${
          isOpen ? 'bg-white ring-2 ring-indigo-400/70' : ''
        } ${hasValue ? 'text-gray-900' : 'text-gray-500'} ${triggerClassName}`}
      >
        {prefix ? <span className="shrink-0 text-gray-400">{prefix}</span> : null}
        <span className="min-w-0 truncate">{displayLabel}</span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen && (
        <div
          role="listbox"
          aria-label={ariaLabel}
          className={`absolute left-0 z-40 mt-1.5 max-h-64 w-max min-w-full max-w-[min(100vw-2rem,22rem)] overflow-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg ${menuClassName}`}
        >
          {options.length === 0 ? (
            <div className="px-4 py-2.5 text-sm text-gray-500">Нет вариантов</div>
          ) : (
            options.map((option) => {
              const isSelected = String(option.value) === String(value);
              return (
                <button
                  key={`${option.value}-${option.label}`}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  disabled={option.disabled}
                  onClick={() => {
                    if (option.disabled) return;
                    onChange(option.value);
                    onOpenChange?.(false);
                  }}
                  className={`flex w-full items-start justify-between gap-3 px-4 py-2.5 text-left text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected ? 'bg-indigo-50 text-indigo-600' : 'text-gray-800'
                  }`}
                >
                  <span className="min-w-0 whitespace-normal break-words">{option.label}</span>
                  {isSelected ? <CheckIcon /> : null}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
