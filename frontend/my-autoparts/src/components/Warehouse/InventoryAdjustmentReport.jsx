import { useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import {
  ADJUSTMENT_KIND_LABELS,
  ADJUSTMENT_KIND_STYLES,
} from '../../utils/inventoryAccess';

export default function InventoryAdjustmentReport({ session, onBack, onNext }) {
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    apiRequest(`/inventory/sessions/${session.id}/adjustment-report`, { method: 'GET' })
      .then((data) => {
        if (active) setReport(data);
      })
      .catch((e) => {
        if (active) setError(e?.message || 'Не удалось загрузить отчёт');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [session.id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</div>
        <button type="button" onClick={onBack} className="text-sm text-indigo-600 hover:underline">
          ← Назад к подсчёту
        </button>
      </div>
    );
  }

  const totals = report?.totals || {};
  const rows = (report?.rows || []).filter((row) => row.adjustment_kind !== 'match');

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Шаг 3. Отчёт расхождений</h2>
        <p className="text-sm text-gray-600 mt-1">
          Проверьте излишки и недостачи перед применением корректировок остатков.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Совпадает" value={totals.match_count ?? 0} />
        <StatCard label="Излишки" value={totals.surplus_count ?? 0} hint={`+${totals.surplus_qty ?? 0} шт.`} />
        <StatCard label="Недостачи" value={totals.shortage_count ?? 0} hint={`−${totals.shortage_qty ?? 0} шт.`} />
        <StatCard label="Не подсчитано" value={totals.lines_pending ?? 0} />
      </div>

      {!report?.can_complete && report?.blocking_reason && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {report.blocking_reason}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-6 text-center text-sm text-emerald-800">
          Расхождений нет — все позиции совпадают с учётом.
        </div>
      ) : (
        <div className="border border-gray-200 rounded-xl overflow-hidden">
          <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
            <div className="col-span-4">Товар</div>
            <div className="col-span-2 text-right">Учёт</div>
            <div className="col-span-2 text-right">Факт</div>
            <div className="col-span-2 text-right">Δ</div>
            <div className="col-span-2">Тип</div>
          </div>
          <div className="divide-y divide-gray-100 max-h-[360px] overflow-y-auto">
            {rows.map((row) => (
              <div key={row.line_id} className="px-4 py-3 md:grid md:grid-cols-12 md:gap-2 md:items-center text-sm">
                <div className="md:col-span-4 min-w-0">
                  <p className="font-mono text-gray-900 truncate">{row.product_article || '—'}</p>
                  <p className="text-gray-600 truncate">{row.product_name || '—'}</p>
                </div>
                <div className="mt-1 md:mt-0 md:col-span-2 md:text-right text-gray-700">{row.expected_qty}</div>
                <div className="md:col-span-2 md:text-right text-gray-900 font-medium">{row.counted_qty}</div>
                <div className="md:col-span-2 md:text-right font-medium">
                  {row.delta_qty > 0 ? `+${row.delta_qty}` : row.delta_qty}
                </div>
                <div className="md:col-span-2 mt-1 md:mt-0">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${ADJUSTMENT_KIND_STYLES[row.adjustment_kind] || ''}`}>
                    {ADJUSTMENT_KIND_LABELS[row.adjustment_kind] || row.adjustment_kind}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={!report?.can_complete}
          onClick={() => onNext(report)}
          className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          Завершить инвентаризацию
        </button>
      </div>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white px-4 py-3">
      <p className="text-xs text-gray-500">{label}</p>
      <p className="text-xl font-semibold text-gray-900 tabular-nums">{value}</p>
      {hint && <p className="text-xs text-gray-500 mt-0.5">{hint}</p>}
    </div>
  );
}
