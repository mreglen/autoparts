import { useCallback, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

export default function InventoryCountStep({ session, onBack, onNext }) {
  const [lines, setLines] = useState(session?.count_lines || []);
  const [search, setSearch] = useState('');
  const [savingLineId, setSavingLineId] = useState(null);
  const [error, setError] = useState(null);

  const filteredLines = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return lines;
    return lines.filter((line) => {
      const hay = `${line.product_article || ''} ${line.product_name || ''} ${line.product_brand || ''}`.toLowerCase();
      return hay.includes(q);
    });
  }, [lines, search]);

  const stats = useMemo(() => {
    const total = lines.length;
    const counted = lines.filter((l) => l.line_status === 'counted' || l.line_status === 'skipped').length;
    return { total, counted, pending: total - counted };
  }, [lines]);

  const saveLine = useCallback(async (lineId, countedQty) => {
    setSavingLineId(lineId);
    setError(null);
    try {
      const updated = await apiRequest(`/inventory/sessions/${session.id}/lines/${lineId}`, {
        method: 'PATCH',
        body: JSON.stringify({ counted_qty: Number(countedQty), line_status: 'counted' }),
      });
      setLines(updated.count_lines || []);
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить количество');
    } finally {
      setSavingLineId(null);
    }
  }, [session.id]);

  const markAsExpected = async (line) => {
    await saveLine(line.id, line.expected_qty);
  };

  const handleNext = () => {
    if (stats.pending > 0) {
      setError(`Осталось неподсчитанных позиций: ${stats.pending}`);
      return;
    }
    onNext({ ...session, count_lines: lines, lines_counted: stats.counted, lines_pending: stats.pending });
  };

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Шаг 2. Подсчёт</h2>
        <p className="text-sm text-gray-600 mt-1">
          Введите фактическое количество по каждой позиции. Учтено: {stats.counted} из {stats.total}.
        </p>
      </div>

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по артикулу или названию"
        className="w-full h-10 px-3 border border-gray-300 rounded-lg text-sm"
      />

      <div className="border border-gray-200 rounded-xl overflow-hidden">
        <div className="hidden md:grid md:grid-cols-12 gap-2 px-4 py-2 bg-gray-50 text-xs font-medium text-gray-500 uppercase">
          <div className="col-span-4">Товар</div>
          <div className="col-span-2 text-right">Учёт</div>
          <div className="col-span-2 text-right">Факт</div>
          <div className="col-span-4 text-right">Действия</div>
        </div>
        <div className="divide-y divide-gray-100 max-h-[420px] overflow-y-auto">
          {filteredLines.map((line) => (
            <CountLineRow
              key={line.id}
              line={line}
              saving={savingLineId === line.id}
              onSave={saveLine}
              onMatchExpected={() => markAsExpected(line)}
            />
          ))}
          {filteredLines.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-gray-500">Нет позиций</div>
          )}
        </div>
      </div>

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
          onClick={handleNext}
          className="px-4 py-2.5 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700"
        >
          К отчёту расхождений
        </button>
      </div>
    </div>
  );
}

function CountLineRow({ line, saving, onSave, onMatchExpected }) {
  const [value, setValue] = useState(line.counted_qty ?? '');

  const isCounted = line.line_status === 'counted' || line.line_status === 'skipped';

  return (
    <div className="px-4 py-3 md:grid md:grid-cols-12 md:gap-2 md:items-center">
      <div className="md:col-span-4 min-w-0">
        <p className="text-sm font-mono text-gray-900 truncate">{line.product_article || '—'}</p>
        <p className="text-sm text-gray-600 truncate">{line.product_name || '—'}</p>
      </div>
      <div className="mt-2 md:mt-0 md:col-span-2 md:text-right text-sm text-gray-700">
        <span className="md:hidden text-gray-500 mr-2">Учёт:</span>
        {line.expected_qty}
      </div>
      <div className="mt-2 md:mt-0 md:col-span-2 md:text-right">
        <input
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="w-full md:w-24 min-h-11 px-2 border border-gray-300 rounded-lg text-sm text-right max-md:text-base"
        />
      </div>
      <div className="mt-2 md:mt-0 md:col-span-4 flex flex-wrap justify-end gap-2">
        <button
          type="button"
          disabled={saving}
          onClick={() => onSave(line.id, value)}
          className="inline-flex min-h-11 items-center justify-center px-3 text-xs font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
        >
          {saving ? '…' : 'Сохранить'}
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={onMatchExpected}
          className="inline-flex min-h-11 items-center justify-center px-3 text-xs font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50"
        >
          Как в учёте
        </button>
        {isCounted && (
          <span className="px-2 py-1 text-xs rounded-full bg-emerald-100 text-emerald-800 self-center">
            Учтено
          </span>
        )}
      </div>
    </div>
  );
}
