import React from 'react';
import { PERIOD_OPTIONS } from './analyticsFormatters';

export function ErrorBanner({ message, onDismiss }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
      <span>{message}</span>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="shrink-0 text-red-400 hover:text-red-600">
          ×
        </button>
      )}
    </div>
  );
}

export function LoadingState({ label = 'Загрузка…' }) {
  return (
    <div className="flex items-center justify-center py-16">
      <p className="text-sm text-gray-400">{label}</p>
    </div>
  );
}

export function StatCard({ label, value, accent = 'indigo' }) {
  const accents = {
    indigo: 'border-indigo-100 bg-indigo-50/40',
    emerald: 'border-emerald-100 bg-emerald-50/40',
    amber: 'border-amber-100 bg-amber-50/40',
  };
  return (
    <div
      className={`rounded-xl border px-4 py-4 shadow-sm ${accents[accent] || accents.indigo}`}
    >
      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums text-gray-900">{value}</p>
    </div>
  );
}

export function Section({ title, subtitle, action, children, className = '' }) {
  return (
    <section
      className={`overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm ${className}`.trim()}
    >
      {(title || action) && (
        <div className="flex flex-wrap items-start justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            {title && <h2 className="text-sm font-semibold text-gray-900">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-gray-500">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  );
}

export function PeriodPills({ value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
      {PERIOD_OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
            value === option.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function DataTable({ columns, rows, empty = 'Нет данных', onRowClick, rowKey, rowClassName }) {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-gray-100 bg-gray-50/80 text-xs text-gray-500">
            {columns.map((col) => (
              <th
                key={col.key}
                className={`px-3 py-2 font-medium ${col.align === 'right' ? 'text-right' : 'text-left'}`}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-50">
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-gray-400">
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row) => (
              <tr
                key={rowKey(row)}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                className={[
                  onRowClick ? 'cursor-pointer hover:bg-indigo-50/60' : '',
                  rowClassName ? rowClassName(row) : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={`px-3 py-2 text-gray-800 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}
                  >
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

export function TabSwitcher({ tabs, value, onChange }) {
  return (
    <div className="inline-flex rounded-xl border border-gray-200 bg-gray-50 p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
            value === tab.id
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
