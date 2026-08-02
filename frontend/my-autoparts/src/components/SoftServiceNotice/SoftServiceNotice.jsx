import React from 'react';

const COPY = {
  unavailable: {
    title: 'Сервис временно недоступен',
    body:
      'Простите, сейчас поиск автомобиля временно не работает. Попробуйте позже или заполните данные вручную.',
  },
  not_found: {
    title: 'Автомобиль не найден',
    body:
      'Не удалось определить автомобиль по этому номеру. Проверьте данные или заполните поля вручную.',
  },
};

function SoftServiceNotice({ variant = 'unavailable', onRetry, className = '' }) {
  const copy = COPY[variant] || COPY.unavailable;
  const tone =
    variant === 'not_found'
      ? 'border-gray-200 bg-white'
      : 'border-amber-200/80 bg-amber-50/80';

  return (
    <div
      role="status"
      className={`rounded-xl border px-4 py-3 shadow-sm sm:px-5 sm:py-4 ${tone} ${className}`.trim()}
    >
      <div className="flex gap-3">
        <div className="mt-0.5 shrink-0 text-amber-700/80" aria-hidden>
          <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z"
            />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-gray-900">{copy.title}</p>
          <p className="mt-1 text-sm leading-relaxed text-gray-600">{copy.body}</p>
          {typeof onRetry === 'function' ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-3 text-sm font-medium text-indigo-600 hover:text-indigo-800"
            >
              Попробовать снова
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

export default SoftServiceNotice;
