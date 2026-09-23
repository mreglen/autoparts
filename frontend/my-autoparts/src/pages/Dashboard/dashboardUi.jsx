import React from 'react';
import { Link } from 'react-router-dom';
import { Card } from '../../components/UI';

export function getGreeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Доброе утро';
  if (hour < 18) return 'Добрый день';
  return 'Добрый вечер';
}

export function getFirstName(user) {
  const raw = (user?.name || user?.username || '').trim();
  if (!raw) return null;
  return raw.split(/\s+/)[0];
}

export function MetricCard({ label, value, hint, href, accent = 'brand', className = '' }) {
  const accents = {
    brand: {
      card: 'border-brand-100 bg-brand-50/50',
      value: 'text-brand-800',
    },
    success: {
      card: 'border-success-100 bg-success-50/50',
      value: 'text-success-700',
    },
    warning: {
      card: 'border-warning-100 bg-warning-50/50',
      value: 'text-warning-700',
    },
  };
  const tone = accents[accent] || accents.brand;

  const content = (
    <>
      <p className="text-sm font-medium text-ink-muted">{label}</p>
      <p className={`mt-2 text-xl font-bold tabular-nums tracking-tight sm:mt-3 sm:text-2xl lg:text-[1.75rem] ${tone.value}`}>
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs text-ink-faint sm:mt-2 sm:text-sm">{hint}</p> : null}
    </>
  );

  if (href) {
    return (
      <Card as={Link} to={href} hover padding="none" className={`block p-4 sm:p-5 lg:p-6 ${tone.card} ${className}`}>
        {content}
      </Card>
    );
  }
  return <Card padding="none" className={`p-4 sm:p-5 lg:p-6 ${tone.card} ${className}`}>{content}</Card>;
}

export const ACTION_TONES = {
  brand: 'bg-brand-50 text-brand-600',
  sky: 'bg-sky-50 text-sky-600',
  success: 'bg-success-50 text-success-600',
  accent: 'bg-accent-50 text-accent-600',
};

export function QuickAction({ label, description, href, icon, tone = 'brand' }) {
  return (
    <Card as={Link} to={href} hover padding="sm" className="flex items-center gap-3 max-lg:flex-col max-lg:items-start max-lg:gap-2.5">
      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${ACTION_TONES[tone] || ACTION_TONES.brand}`}>
        {icon}
      </span>
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-ink">{label}</span>
        <span className="mt-0.5 block text-xs text-ink-muted">{description}</span>
      </span>
    </Card>
  );
}
