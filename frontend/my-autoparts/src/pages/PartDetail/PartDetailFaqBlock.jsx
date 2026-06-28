import React, { useState } from 'react';
import { buildProductFaqItems } from '../../utils/partDetailFaq';

export default function PartDetailFaqBlock({
  brand,
  article,
  partTypeName,
  isNew = false,
  city,
  fitmentText,
  inStock = true,
}) {
  const items = buildProductFaqItems({
    brand,
    article,
    partTypeName,
    isNew,
    city,
    fitmentText,
    inStock,
  });
  const [openIndex, setOpenIndex] = useState(0);

  if (!items.length) return null;

  return (
    <section className="border-b border-gray-200 py-6">
      <h2 className="text-xl font-semibold text-gray-900">Частые вопросы</h2>
      <div className="mt-4 divide-y divide-gray-200 rounded-xl border border-gray-200 bg-white">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-gray-900 hover:bg-gray-50"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <span className="shrink-0 text-gray-400" aria-hidden="true">
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen ? (
                <div className="px-4 pb-4 text-sm leading-relaxed text-gray-600">
                  {item.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
