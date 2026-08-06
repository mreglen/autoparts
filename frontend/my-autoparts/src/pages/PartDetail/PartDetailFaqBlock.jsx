import React, { useState } from 'react';
import { Card } from '../../components/UI';
import { buildProductFaqItems } from '../../utils/partDetailFaq';

export default function PartDetailFaqBlock({
  brand,
  article,
  partTypeName,
  isNew = false,
  city,
  fitmentText,
  inStock = true,
  items: itemsProp = null,
}) {
  const items = itemsProp?.length
    ? itemsProp
    : buildProductFaqItems({
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
    <Card as="section" padding="sm" className="sm:p-5">
      <h2 className="text-lg font-semibold text-ink">Частые вопросы</h2>
      <div className="mt-4 divide-y divide-line-soft rounded-sg-lg border border-line-soft">
        {items.map((item, index) => {
          const isOpen = openIndex === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                className="flex w-full items-start justify-between gap-3 px-4 py-3.5 text-left text-sm font-medium text-ink transition-colors hover:bg-surface-muted"
                onClick={() => setOpenIndex(isOpen ? -1 : index)}
                aria-expanded={isOpen}
              >
                <span>{item.question}</span>
                <span
                  className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    isOpen ? 'bg-brand-100 text-brand-700' : 'bg-surface-subtle text-ink-muted'
                  }`}
                  aria-hidden="true"
                >
                  {isOpen ? '−' : '+'}
                </span>
              </button>
              {isOpen ? (
                <div className="px-4 pb-4 text-sm leading-relaxed text-ink-muted">
                  {item.answer}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
