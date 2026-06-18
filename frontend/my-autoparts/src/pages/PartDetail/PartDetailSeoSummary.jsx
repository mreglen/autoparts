import React from 'react';

export default function PartDetailSeoSummary({ summary }) {
  const text = String(summary || '').trim();
  if (!text) return null;

  return (
    <p className="mt-2 text-sm leading-relaxed text-gray-600">
      {text}
    </p>
  );
}
