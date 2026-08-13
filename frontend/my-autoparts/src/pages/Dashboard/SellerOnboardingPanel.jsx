import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Card, SectionHeader, Skeleton } from '../../components/UI';

function StepRow({ step, onNavigate }) {
  const isDone = step.status === 'done';

  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div className="min-w-0 flex-1">
        <p className={`text-sm font-medium ${isDone ? 'text-ink-faint line-through' : 'text-ink'}`}>
          {step.title}
        </p>
        {!isDone && step.hint ? (
          <p className="mt-0.5 text-xs text-ink-muted">{step.hint}</p>
        ) : null}
      </div>
      {isDone ? (
        <Badge tone="success">Готово</Badge>
      ) : (
        <Button size="sm" onClick={() => onNavigate(step.url)}>
          Перейти
        </Button>
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
      <Card padding="md">
        <Skeleton className="h-5 w-40" />
        <div className="mt-4 space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  if (!onboarding?.steps?.length || allRequiredDone) return null;

  return (
    <Card padding="none" className="border-brand-100 bg-brand-50/30">
      <div className="px-5 pb-3 pt-5 sm:px-6">
        <SectionHeader
          title="Первые шаги"
          subtitle="Настройте магазин, чтобы начать продажи"
          action={(
            <span className="text-xs font-semibold tabular-nums text-brand-700">
              {onboarding.core_progress?.done || 0}/{onboarding.core_progress?.total || 0}
            </span>
          )}
        />
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
          <div
            className="h-full rounded-full bg-brand-600 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
      </div>

      <div className="divide-y divide-gray-100 px-5 sm:px-6">
        {requiredSteps.map((step) => (
          <StepRow key={step.id} step={step} onNavigate={navigate} />
        ))}
      </div>

      {optionalSteps.length > 0 && (
        <div className="rounded-b-sg-lg bg-surface-subtle px-5 py-3 sm:px-6">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-ink-muted">По желанию</p>
          <div className="divide-y divide-gray-100">
            {optionalSteps.map((step) => (
              <StepRow key={step.id} step={step} onNavigate={navigate} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
