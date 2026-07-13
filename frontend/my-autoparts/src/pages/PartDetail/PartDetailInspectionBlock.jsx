import React, { useState } from 'react';

const INSPECTION_STEPS_USED = [
  'Сверьте артикул и бренд с заказом и упаковкой.',
  'Осмотрите корпус, резьбу и посадочные места — без трещин и деформаций.',
  'Для б/у детали проверьте износ, следы ремонта и комплектность.',
  'При получении в ПВЗ или от курьера зафиксируйте повреждения упаковки на месте.',
  'Если деталь не соответствует описанию — свяжитесь с продавцом до установки на автомобиль.',
];

const INSPECTION_STEPS_NEW = [
  'Сверьте артикул и бренд с заказом и упаковкой.',
  'Осмотрите корпус, резьбу и посадочные места — без трещин и деформаций.',
  'Проверьте целостность упаковки и комплектацию новой детали.',
  'При получении в ПВЗ или от курьера зафиксируйте повреждения упаковки на месте.',
  'Если деталь не соответствует описанию — свяжитесь с продавцом до установки на автомобиль.',
];

export default function PartDetailInspectionBlock({ isNew = false }) {
  const [open, setOpen] = useState(false);
  const steps = isNew ? INSPECTION_STEPS_NEW : INSPECTION_STEPS_USED;

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <button
        type="button"
        className="flex w-full items-start justify-between gap-3 text-left"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
      >
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Как проверить запчасть при получении</h2>
          <p className="mt-1 text-sm text-gray-600">
            {isNew
              ? 'Краткий чеклист для новой детали перед установкой.'
              : 'Краткий чеклист для б/у детали перед установкой.'}
          </p>
        </div>
        <span className="mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gray-100 text-sm font-bold text-gray-600">
          {open ? '−' : '+'}
        </span>
      </button>
      {open ? (
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-relaxed text-gray-700">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      ) : null}
    </section>
  );
}
