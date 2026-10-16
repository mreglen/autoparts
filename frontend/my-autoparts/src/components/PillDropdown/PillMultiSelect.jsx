import { useEffect, useRef, useState } from 'react';

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

export default function PillMultiSelect({
  values = [],
  onChange,
  options = [],
  placeholder = 'Выберите',
  disabled = false,
  ariaLabel,
  className = '',
  triggerClassName = '',
}) {
  const rootRef = useRef(null);
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) return undefined;

    const handleClickOutside = (event) => {
      if (!rootRef.current?.contains(event.target)) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  const selectedLabels = options
    .filter((option) => values.some((value) => String(value) === String(option.value)))
    .map((option) => option.label);
  const displayLabel = selectedLabels.length === 0
    ? placeholder
    : selectedLabels.length === 1
      ? selectedLabels[0]
      : `${selectedLabels.length} выбрано`;

  const toggle = (optionValue) => {
    const isOn = values.some((value) => String(value) === String(optionValue));
    onChange(
      isOn
        ? values.filter((value) => String(value) !== String(optionValue))
        : [...values, optionValue],
    );
  };

  return (
    <div ref={rootRef} className={`relative min-w-0 ${className}`}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        onClick={() => {
          if (!disabled) setIsOpen((open) => !open);
        }}
        className={`flex h-10 w-full items-center justify-between gap-2 rounded-full border border-transparent bg-gray-100 px-4 text-left text-sm transition hover:bg-gray-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500/30 disabled:cursor-not-allowed disabled:opacity-60 ${
          isOpen ? 'bg-white ring-2 ring-indigo-400/70' : ''
        } ${selectedLabels.length ? 'text-gray-900' : 'text-gray-500'} ${triggerClassName}`}
      >
        <span className="min-w-0 truncate">{displayLabel}</span>
        <ChevronIcon open={isOpen} />
      </button>

      {isOpen ? (
        <div
          role="listbox"
          aria-multiselectable
          aria-label={ariaLabel}
          className="absolute left-0 z-40 mt-1.5 max-h-[min(24rem,70dvh)] w-max min-w-full max-w-[min(100vw-2rem,22rem)] overflow-auto rounded-xl border border-gray-200 bg-white py-1.5 shadow-lg"
        >
          {options.length === 0 ? (
            <div className="px-4 py-2.5 text-sm text-gray-500">Нет вариантов</div>
          ) : (
            options.map((option) => {
              const checked = values.some((value) => String(value) === String(option.value));
              return (
                <label
                  key={`${option.value}-${option.label}`}
                  className="flex cursor-pointer items-center gap-2.5 px-4 py-1.5 text-left text-sm text-gray-800 transition hover:bg-gray-50"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(option.value)}
                    className="h-4 w-4 shrink-0 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span className="min-w-0 whitespace-normal break-words">{option.label}</span>
                </label>
              );
            })
          )}
        </div>
      ) : null}
    </div>
  );
}
