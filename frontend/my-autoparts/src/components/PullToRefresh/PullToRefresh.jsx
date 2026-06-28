import React from 'react';
import usePullToRefresh from '../../hooks/usePullToRefresh';

export default function PullToRefresh() {
  const { distance, refreshing, threshold, isActive } = usePullToRefresh();

  if (!isActive || (distance <= 0 && !refreshing)) {
    return null;
  }

  const progress = Math.min(distance / threshold, 1);
  const ready = distance >= threshold;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 z-30 flex justify-center lg:hidden"
      style={{ top: 'calc(env(safe-area-inset-top, 0px) + 3.75rem)' }}
      aria-live="polite"
      aria-hidden={distance <= 0 && !refreshing}
    >
      <div
        className="flex flex-col items-center"
        style={{
          transform: `translateY(${Math.min(distance * 0.6, 40)}px)`,
          transition: refreshing ? undefined : 'transform 80ms ease-out',
        }}
      >
        <div
          className={`flex h-9 w-9 items-center justify-center rounded-full border bg-white shadow-md ${
            ready || refreshing ? 'border-indigo-200 text-indigo-600' : 'border-gray-200 text-gray-400'
          }`}
        >
          {refreshing ? (
            <svg
              className="h-4 w-4 animate-spin"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg
              className="h-4 w-4 transition-transform duration-100"
              style={{ transform: `rotate(${progress * 180}deg)` }}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="2.5"
              aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          )}
        </div>
        {(ready || refreshing) && (
          <span className="mt-1.5 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-medium text-gray-600 shadow-sm">
            {refreshing ? 'Обновление…' : 'Отпустите для обновления'}
          </span>
        )}
      </div>
    </div>
  );
}
