import React from 'react';
import { formatNumber, FUNNEL_LABELS } from './analyticsFormatters';
import { Section } from './AnalyticsUi';

export default function FunnelSection({ funnel }) {
  const steps = funnel?.steps || [];
  if (!steps.length) {
    return (
      <Section title="Воронка конверсий" subtitle="Нет данных за период">
        <p className="px-4 py-8 text-center text-sm text-gray-400">События ещё не зафиксированы</p>
      </Section>
    );
  }

  return (
    <Section title="Воронка конверсий" subtitle="От просмотра карточки до заказа">
      <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        {steps.map((step, index) => (
          <div
            key={step.event_type}
            className="rounded-xl border border-gray-100 bg-gradient-to-b from-white to-gray-50/80 p-4"
          >
            <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
              {index + 1}. {FUNNEL_LABELS[step.event_type] || step.event_type}
            </p>
            <p className="mt-2 text-2xl font-bold tabular-nums text-gray-900">
              {formatNumber(step.count)}
            </p>
            {step.conversion_rate != null && index > 0 ? (
              <p className="mt-1 text-xs text-indigo-600">
                {step.conversion_rate}% от предыдущего шага
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}
