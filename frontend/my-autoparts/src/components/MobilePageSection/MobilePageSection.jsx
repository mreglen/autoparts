import React from 'react';

/**
 * Card-style section for long forms (mobile + desktop).
 */
export default function MobilePageSection({ title, children, className = '' }) {
  return (
    <section className={`rounded-2xl bg-white p-4 ring-1 ring-gray-200/80 sm:p-5 ${className}`}>
      {title ? (
        <h2 className="mb-4 text-base font-bold text-gray-900">{title}</h2>
      ) : null}
      <div className="space-y-4">{children}</div>
    </section>
  );
}
