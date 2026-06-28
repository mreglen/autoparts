import React from 'react';

const TRUST_ITEMS = [
  {
    label: 'Доставка по России',
    icon: (
      <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10m10 0H4m10 0h2.586a1 1 0 01.707.293l2.414 2.414a1 1 0 01.293.707V18a1 1 0 01-1 1h-1M4 16h10" />
      </svg>
    ),
  },
  {
    label: 'Безопасная сделка',
    icon: (
      <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    label: 'Осмотр перед покупкой',
    icon: (
      <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
      </svg>
    ),
  },
  {
    label: 'Возврат по договорённости',
    icon: (
      <svg className="h-3.5 w-3.5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 10h10a8 8 0 018 8v2M3 10l6 6m-6-6l6-6" />
      </svg>
    ),
  },
];

export default function PartDetailTrustRow() {
  return (
    <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
      {TRUST_ITEMS.map((item) => (
        <span
          key={item.label}
          className="inline-flex items-center gap-1.5 rounded-lg border border-indigo-100 bg-indigo-50/50 px-2.5 py-1.5 text-xs font-medium text-gray-700"
        >
          {item.icon}
          {item.label}
        </span>
      ))}
    </div>
  );
}
