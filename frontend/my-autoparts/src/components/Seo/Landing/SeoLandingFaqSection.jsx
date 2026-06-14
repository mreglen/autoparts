import React from 'react';

export default function SeoLandingFaqSection({ faqItems }) {
  if (!faqItems?.length) return null;
  return (
    <section className="mb-6 rounded-2xl border border-gray-200 bg-white/90 p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-base font-semibold text-gray-900 sm:text-lg">Частые вопросы</h2>
      <div className="space-y-2">
        {faqItems.map((item) => (
          <details
            key={item.question}
            className="group rounded-xl border border-gray-100 bg-gray-50/80 open:bg-white open:shadow-sm"
          >
            <summary className="cursor-pointer list-none px-4 py-3 text-sm font-medium text-gray-900 min-h-[44px] flex items-center sm:text-base [&::-webkit-details-marker]:hidden">
              <span className="flex-1 pr-2">{item.question}</span>
              <span className="text-indigo-500 transition group-open:rotate-180" aria-hidden="true">
                ▾
              </span>
            </summary>
            <div className="border-t border-gray-100 px-4 pb-4 pt-2 text-sm leading-relaxed text-gray-700 sm:text-base">
              {item.answer}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
