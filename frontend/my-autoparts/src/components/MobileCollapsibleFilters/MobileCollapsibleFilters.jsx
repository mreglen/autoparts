import React, { useState } from 'react';

export default function MobileCollapsibleFilters({ title = 'Фильтры', defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="md:contents">
      <div className="mb-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex min-h-11 w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-4 text-base font-semibold text-gray-900 shadow-sm"
          aria-expanded={open}
        >
          <span>{title}</span>
          <svg
            className={`h-5 w-5 text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
      <div className={open ? 'md:block' : 'hidden md:block'}>{children}</div>
    </div>
  );
}
