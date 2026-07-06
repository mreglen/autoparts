import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function StepRow({ step, onNavigate }) {
  const isDone = step.status === 'done';

  return (
    <div
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 ${
        isDone
          ? 'border-emerald-200 bg-emerald-50/60'
          : step.required
            ? 'border-gray-200 bg-white'
            : 'border-gray-100 bg-gray-50/80'
      }`}
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className={`font-medium ${isDone ? 'text-emerald-900' : 'text-gray-900'}`}>
            {step.title}
          </p>
          {step.required ? (
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
              Обязательно
            </span>
          ) : (
            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-600">
              Рекомендуется
            </span>
          )}
        </div>
        {step.hint ? (
          <p className="mt-1 text-xs text-gray-600">{step.hint}</p>
        ) : null}
      </div>
      <div className="shrink-0">
        {isDone ? (
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white" aria-label="Готово">
            ✓
          </span>
        ) : (
          <button
            type="button"
            onClick={() => onNavigate(step.url)}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-indigo-700"
          >
            Перейти
          </button>
        )}
      </div>
    </div>
  );
}

export default function SellerOnboardingPanel({ onboarding, loading }) {
  const navigate = useNavigate();
  const [expanded, setExpanded] = useState(true);
  const [showOptional, setShowOptional] = useState(
    () => localStorage.getItem('seller_onboarding_optional_collapsed') !== '1',
  );

  const { requiredSteps, optionalSteps, progressPercent } = useMemo(() => {
    if (!onboarding?.steps?.length) {
      return { requiredSteps: [], optionalSteps: [], progressPercent: 0 };
    }
    const required = onboarding.steps.filter((s) => s.required);
    const optional = onboarding.steps.filter((s) => !s.required);
    const total = onboarding.core_progress?.total || 1;
    const done = onboarding.core_progress?.done || 0;
    return {
      requiredSteps: required,
      optionalSteps: optional,
      progressPercent: Math.round((done / total) * 100),
    };
  }, [onboarding]);

  if (loading) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5 shadow-md">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-2 w-full animate-pulse rounded-full bg-gray-100" />
        <div className="mt-4 space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      </section>
    );
  }

  if (!onboarding?.steps?.length) return null;

  const coreCompleted = onboarding.core_completed;

  if (coreCompleted && !expanded) {
    return (
      <section className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-medium text-emerald-900">
            Кабинет настроен
            {onboarding.optional_pending > 0
              ? ` · ${onboarding.optional_pending} рекомендуемых шагов`
              : ''}
          </p>
          <button
            type="button"
            onClick={() => setExpanded(true)}
            className="text-sm font-medium text-emerald-800 hover:underline"
          >
            Показать чеклист
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white shadow-md overflow-hidden">
      <div className="border-b border-gray-100 px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Настройка кабинета</h2>
            <p className="mt-1 text-sm text-gray-600">
              {coreCompleted
                ? 'Обязательные шаги выполнены. Можно перейти к рекомендуемым.'
                : 'Пройдите шаги, чтобы начать продавать на площадке.'}
            </p>
          </div>
          {coreCompleted ? (
            <button
              type="button"
              onClick={() => setExpanded(false)}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Свернуть
            </button>
          ) : null}
        </div>
        <div className="mt-4">
          <div className="mb-1 flex justify-between text-xs text-gray-600">
            <span>Обязательные шаги</span>
            <span>
              {onboarding.core_progress?.done || 0}
              /
              {onboarding.core_progress?.total || 0}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-2 p-5">
        {requiredSteps.map((step) => (
          <StepRow key={step.id} step={step} onNavigate={navigate} />
        ))}

        {optionalSteps.length > 0 && (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                const next = !showOptional;
                setShowOptional(next);
                localStorage.setItem(
                  'seller_onboarding_optional_collapsed',
                  next ? '0' : '1',
                );
              }}
              className="mb-2 text-sm font-medium text-gray-600 hover:text-gray-900"
            >
              {showOptional ? 'Скрыть рекомендуемые' : 'Показать рекомендуемые'}
              {' '}
              ({optionalSteps.filter((s) => s.status === 'pending').length} осталось)
            </button>
            {showOptional
              ? optionalSteps.map((step) => (
                  <div key={step.id} className="mb-2 last:mb-0">
                    <StepRow step={step} onNavigate={navigate} />
                  </div>
                ))
              : null}
          </div>
        )}
      </div>
    </section>
  );
}
