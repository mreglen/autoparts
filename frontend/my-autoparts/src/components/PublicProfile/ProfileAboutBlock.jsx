import React from 'react';

export default function ProfileAboutBlock({ description, organizationName }) {
  const text = (description || '').trim();
  if (!text) return null;

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 sm:p-8">
      <h2 className="text-xl font-bold text-gray-900">
        {organizationName ? `О ${organizationName}` : 'О продавце'}
      </h2>
      <p className="mt-4 whitespace-pre-line text-base leading-8 text-gray-700">{text}</p>
    </section>
  );
}
