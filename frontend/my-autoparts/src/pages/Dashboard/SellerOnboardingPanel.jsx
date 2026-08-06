import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

function StepRow({ step, onNavigate }) {
  const isDone = step.status === 'done';

  return (
    <div className="flex items-center justify-between gap-4 border-b border-brand-50 py-3 last:border-0">
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${isDone ? 'text-ink-faint line-through' : 'text-ink'}`}>
          {step.title}
        </p>
        {!isDone && step.hint ? (
          <p className="mt-0.5 text-xs text-ink-muted">{step.hint}</p>
        ) : null}
      </div>
      {isDone ? (
        <span className="shrink-0 text-xs font-medium text-success-600">Готово</span>
      ) : (
        <button
          type="button"
          onClick={() => onNavigate(step.url)}
          className="shrink-0 rounded-sg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700"
        >
          Перейти
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
      <div className="rounded-sg-lg border border-brand-50 bg-surface p-5 shadow-sg">
        <div className="h-5 w-40 animate-pulse rounded-sg bg-brand-50" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-10 animate-pulse rounded-sg bg-brand-50" />
          ))}
        </div>
      </div>
    );
  }

  if (!onboarding?.steps?.length || allRequiredDone) return null;

  return (
    <div className="rounded-sg-lg border border-brand-50 bg-surface shadow-sg">
      <div className="px-5 pb-3 pt-5">
        <div className="flex items-baseline justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-ink">Первые шаги</h2>
            <p className="mt-0.5 text-sm text-ink-muted">Настройте магазин, чтобы начать продажи</p>
          </div>
          <span className="text-xs font-semibold tabular-nums text-brand-700">
            {onboarding.core_progress?.done || 0}/{onboarding.core_progress?.total || 0}
          </span>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-brand-50">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
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
        <div className="rounded-b-sg-lg border-t border-brand-50 bg-surface-muted px-5 py-3">
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-ink-muted">По желанию</p>
          {optionalSteps.map((step) => (
            <StepRow key={step.id} step={step} onNavigate={navigate} />
          ))}
        </div>
      )}
    </div>
  );
}
