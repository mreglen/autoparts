import React from 'react';

/**
 * Card-style section for long forms (mobile + desktop).
 */
export default function MobilePageSection({ title, headerAction, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5 ${className}`}>
      {title ? (
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-gray-900">{title}</h2>
          {headerAction ? <div className="shrink-0">{headerAction}</div> : null}
        </div>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
