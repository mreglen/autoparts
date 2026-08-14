import React from 'react';

const fieldClass =
  'h-10 w-full rounded-full border border-transparent bg-gray-100 px-4 pr-10 text-sm text-gray-900 shadow-none transition hover:bg-gray-50 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-0';

/**
 * Instant-filter search that keeps mobile keyboard open:
 * stable DOM, no submit, clear button always mounted.
 */
export default function AutoserviceLiveSearchField({
  value,
  onChange,
  placeholder,
  ariaLabel,
}) {
  return (
    <form
      role="search"
      className="relative min-w-0 flex-1"
      onSubmit={(e) => e.preventDefault()}
    >
      <input
        type="text"
        inputMode="search"
        enterKeyHint="search"
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        className={fieldClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
      />
      <button
        type="button"
        tabIndex={value ? 0 : -1}
        onMouseDown={(e) => e.preventDefault()}
        onTouchStart={(e) => e.preventDefault()}
        onClick={() => onChange('')}
        className={`absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600 ${
          value ? '' : 'invisible pointer-events-none'
        }`}
        aria-label="Очистить поиск"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </form>
  );
}
