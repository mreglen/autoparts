import { useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

export default function InventoryCompleteStep({ session, report, onBack, onDone }) {
  const [applyAdjustments, setApplyAdjustments] = useState(true);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const totals = report?.totals || {};
  const hasDiscrepancies = (totals.surplus_count || 0) + (totals.shortage_count || 0) > 0;

  const handleComplete = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/inventory/sessions/${session.id}/complete`, {
        method: 'POST',
        body: JSON.stringify({
          apply_adjustments: applyAdjustments,
          notes: notes.trim() || null,
        }),
      });
      setResult(data);
    } catch (e) {
      setError(e?.message || 'Не удалось завершить инвентаризацию');
    } finally {
      setLoading(false);
    }
  };

  if (result) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-5 py-6">
          <h2 className="text-lg font-semibold text-emerald-900">Инвентаризация завершена</h2>
          <p className="text-sm text-emerald-800 mt-2">
            Сессия #{result.session_id} закрыта.
            {applyAdjustments
              ? ` Создано поступлений: ${result.stock_ins_created}, списаний: ${result.stock_outs_created}.`
              : ' Корректировки остатков не применялись.'}
          </p>
        </div>
        <button
          type="button"
          onClick={onDone}
          className="w-full sm:w-auto px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          Вернуться к списку
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Шаг 4. Завершение</h2>
        <p className="text-sm text-gray-600 mt-1">
          Подтвердите применение корректировок к остаткам склада.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-4 space-y-2 text-sm text-gray-700">
        <p>
          <span className="text-gray-500">Совпадений:</span>{' '}
          <span className="font-medium">{totals.match_count ?? 0}</span>
        </p>
        <p>
          <span className="text-gray-500">Излишки:</span>{' '}
          <span className="font-medium">{totals.surplus_count ?? 0}</span>
          {' '}(+{totals.surplus_qty ?? 0} шт.)
        </p>
        <p>
          <span className="text-gray-500">Недостачи:</span>{' '}
          <span className="font-medium">{totals.shortage_count ?? 0}</span>
          {' '}(−{totals.shortage_qty ?? 0} шт.)
        </p>
      </div>

      {hasDiscrepancies && (
        <label className="flex items-start gap-3 rounded-xl border border-gray-200 bg-white px-4 py-4 cursor-pointer">
          <input
            type="checkbox"
            checked={applyAdjustments}
            onChange={(e) => setApplyAdjustments(e.target.checked)}
            className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600"
          />
          <span>
            <span className="block text-sm font-medium text-gray-900">Применить корректировки остатков</span>
            <span className="block text-sm text-gray-600 mt-1">
              Излишки оформятся как поступления, недостачи — как списания со склада.
            </span>
          </span>
        </label>
      )}

      {!hasDiscrepancies && (
        <div className="rounded-lg border border-gray-200 bg-white px-4 py-3 text-sm text-gray-600">
          Расхождений нет — остатки менять не нужно.
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Комментарий (необязательно)</label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
          placeholder="Например: пересчёт после перемещения стеллажа"
        />
      </div>

      <div className="flex flex-col-reverse sm:flex-row sm:justify-between gap-3 pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={loading}
          className="px-4 py-2.5 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Назад
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={handleComplete}
          className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {loading ? 'Завершение…' : 'Подтвердить и завершить'}
        </button>
      </div>
    </div>
  );
}
