import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

function StepRow({ step, onNavigate }) {
  const isDone = step.status === 'done';

  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-gray-100 last:border-0">
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${isDone ? 'text-gray-400 line-through' : 'text-gray-900'}`}>
          {step.title}
        </p>
        {!isDone && step.hint ? (
          <p className="mt-0.5 text-xs text-gray-500">{step.hint}</p>
        ) : null}
      </div>
      {isDone ? (
        <span className="shrink-0 text-xs text-gray-400">Готово</span>
      ) : (
        <button
          type="button"
          onClick={() => onNavigate(step.url)}
          className="shrink-0 text-xs font-medium text-indigo-600 hover:text-indigo-800"
        >
          Перейти →
        </button>
      )}
    </div>
  );
}

export default function SellerOnboardingPanel({ onboarding, loading }) {
  const navigate = useNavigate();

  const { requiredSteps, optionalSteps, progressPercent, allRequiredDone } = useMemo(() => {
    if (!onboarding?.steps?.length) {
      return { requiredSteps: [], optionalSteps: [], progressPercent: 0, allRequiredDone: false };
    }
    const required = onboarding.steps.filter((s) => s.required);
    const optional = onboarding.steps.filter((s) => !s.required);
    const total = onboarding.core_progress?.total || 1;
    const done = onboarding.core_progress?.done || 0;
    return {
      requiredSteps: required,
      optionalSteps: optional.filter((s) => s.status !== 'done'),
      progressPercent: Math.round((done / total) * 100),
      allRequiredDone: required.length > 0 && required.every((s) => s.status === 'done'),
    };
  }, [onboarding]);

  if (loading) {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <div className="h-5 w-40 animate-pulse rounded bg-gray-100" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded bg-gray-50" />
          ))}
        </div>
      </div>
    );
  }

  if (!onboarding?.steps?.length || allRequiredDone) return null;

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="px-5 pt-5 pb-3">
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-base font-semibold text-gray-900">Первые шаги</h2>
          <span className="text-xs tabular-nums text-gray-500">
            {onboarding.core_progress?.done || 0}/{onboarding.core_progress?.total || 0}
          </span>
        </div>
        <div className="mt-3 h-1 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-indigo-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="px-5 pb-4">
        {requiredSteps.map((step) => (
          <StepRow key={step.id} step={step} onNavigate={navigate} />
        ))}
      </div>

      {optionalSteps.length > 0 && (
        <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50 rounded-b-lg">
          <p className="text-xs text-gray-500 mb-2">По желанию</p>
          {optionalSteps.map((step) => (
            <StepRow key={step.id} step={step} onNavigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}
