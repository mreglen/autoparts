import React from 'react';

/**
 * Desktop-only page heading. On mobile the title lives in MobileHeader.
 * Pass description only when it adds context beyond the title.
 */
export default function PageIntro({ title, description, className = '', titleClassName = '' }) {
  if (!title && !description) return null;

  return (
    <div className={`mb-4 max-md:hidden ${className}`}>
      {title ? (
        <h1 className={`text-2xl font-bold text-gray-900 sm:text-3xl ${titleClassName}`}>{title}</h1>
      ) : null}
      {description ? <p className="mt-1 max-w-2xl text-sm text-gray-500">{description}</p> : null}
    </div>
  );
}
