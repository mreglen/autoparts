export default function VinScanTriggerButton({
  onClick,
  disabled = false,
  className = '',
  label = 'Распознать VIN',
  compact = false,
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={`inline-flex items-center justify-center text-gray-500 transition hover:text-indigo-600 disabled:opacity-50 ${className}`}
    >
      <svg
        className={compact ? 'h-4 w-4' : 'h-5 w-5'}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M3 7h3l1.5-2h9L18 7h3a1 1 0 011 1v10a1 1 0 01-1 1H3a1 1 0 01-1-1V8a1 1 0 011-1z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 17a4 4 0 100-8 4 4 0 000 8z" />
      </svg>
      {!compact ? <span className="sr-only">{label}</span> : null}
    </button>
  );
}
