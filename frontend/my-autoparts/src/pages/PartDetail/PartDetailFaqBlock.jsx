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
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <h2 className="text-lg font-semibold text-gray-900">Частые вопросы</h2>
      <div className="mt-4 divide-y divide-gray-100 rounded-xl border border-gray-100">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-gray-900 transition-colors hover:bg-gray-50"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isOpen ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-500'
                  }`}
                  aria-hidden="true"
                >
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
