import React from 'react';

const cardClass =
  'mb-6 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm sm:p-6 prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-a:text-indigo-600';

export default function SeoLandingContentBlock({ title, html, children }) {
  if (!html && !children) return null;
  return (
    <section className={cardClass}>
      {title ? (
        <h2 className="mb-3 text-base font-semibold text-gray-900 not-prose sm:text-lg">{title}</h2>
      ) : null}
      {html ? <div dangerouslySetInnerHTML={{ __html: html }} /> : null}
      {children}
    </section>
  );
}
