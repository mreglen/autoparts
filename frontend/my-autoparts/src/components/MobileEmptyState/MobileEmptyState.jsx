import React from 'react';

export default function MobileEmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon,
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-gray-200 bg-gray-50 px-4 py-10 text-center md:py-12">
      {icon ? <div className="mb-3 text-gray-400">{icon}</div> : null}
      {title ? <p className="text-base font-semibold text-gray-900">{title}</p> : null}
      {description ? <p className="mt-1 max-w-sm text-sm text-gray-600">{description}</p> : null}
      {actionLabel && onAction ? (
        <button
          type="button"
          onClick={onAction}
          className="mt-4 min-h-11 rounded-lg bg-indigo-600 px-4 text-sm font-semibold text-white active:bg-indigo-700"
        >
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
