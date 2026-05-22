import React from 'react';

/**
 * Card-style grouping on mobile only; desktop stays flat (no extra chrome).
 */
export default function MobilePageSection({ title, children, className = '' }) {
  return (
    <section
      className={`mb-4 max-md:rounded-xl max-md:border max-md:border-gray-100 max-md:bg-gray-50/90 max-md:p-4 md:mb-0 md:border-0 md:bg-transparent md:p-0 ${className}`}
    >
      {title ? (
        <h2 className="mb-3 text-lg font-semibold text-gray-900 md:hidden">{title}</h2>
      ) : null}
      <div className="space-y-4 md:space-y-6">{children}</div>
    </section>
  );
}
