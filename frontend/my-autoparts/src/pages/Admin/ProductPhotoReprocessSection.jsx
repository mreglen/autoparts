import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest, API_LONG_REQUEST_TIMEOUT_MS } from '../../utils/apiClient';

const DEFAULT_LIMIT = 50;

export default function ProductPhotoReprocessSection() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));
  const [onlyTemp, setOnlyTemp] = useState(true);

  const loadStats = useCallback(async () => {
    const data = await apiRequest('/admin/photos/reprocess/stats');
    setStats(data || null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadStats();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить статистику обработки фото');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStats]);

  const runReprocess = async () => {
    const parsedLimit = Number.parseInt(limit, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) {
      setError('Лимит должен быть числом от 1 до 500');
      return;
    }
    const ok = window.confirm(
      onlyTemp
        ? `Поставить в очередь Celery до ${parsedLimit} фото из /temp/ для повторной обработки?`
        : `Поставить в очередь до ${parsedLimit} незавершённых фото (нужен файл в temp)?`,
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/photos/reprocess', {
        method: 'POST',
        body: JSON.stringify({
          limit: parsedLimit,
          only_temp: onlyTemp,
        }),
        timeoutMs: API_LONG_REQUEST_TIMEOUT_MS,
      });
      setResult(res);
      await loadStats();
    } catch (e) {
      setError(e?.message || 'Не удалось запустить повторную обработку');
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-gray-500">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Повторная обработка фото</h2>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Всего фото</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{stats?.total_photos ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">В /temp/</p>
          <p className="mt-1 text-xl font-semibold text-amber-900">{stats?.temp_url ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-orange-700">Не завершены</p>
          <p className="mt-1 text-xl font-semibold text-orange-900">{stats?.unfinished_status ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-indigo-700">Кандидаты</p>
          <p className="mt-1 text-xl font-semibold text-indigo-900">{stats?.reprocess_candidates ?? '—'}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-medium">Лимит за запуск</span>
          <input
            type="number"
            min={1}
            max={500}
            value={limit}
            disabled={busy}
            onChange={(e) => setLimit(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:w-36"
          />
        </label>
        <label className="flex items-center gap-2 text-sm text-gray-700 sm:mb-2">
          <input
            type="checkbox"
            className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            checked={onlyTemp}
            disabled={busy}
            onChange={(e) => setOnlyTemp(e.target.checked)}
          />
          Только URL в /temp/ (рекомендуется)
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runReprocess}
            disabled={busy || !(stats?.temp_url > 0 || (!onlyTemp && stats?.reprocess_candidates > 0))}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Ставим в очередь…' : 'Обработать заново'}
          </button>
          <button
            type="button"
            onClick={async () => {
              setError(null);
              try {
                await loadStats();
              } catch (e) {
                setError(e?.message || 'Не удалось обновить статистику');
              }
            }}
            disabled={busy}
            className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Обновить статистику
          </button>
        </div>
      </div>

      {stats?.temp_url === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Фото в /temp/ не найдено. Если есть «не завершены» без temp — оригинал уже удалён, их
          можно только перезагрузить вручную.
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Результат постановки в очередь</p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
            <li>Просмотрено: <span className="font-semibold">{result.processed}</span></li>
            <li>В Celery: <span className="font-semibold">{result.queued}</span></li>
            <li>Пропущено: <span className="font-semibold">{result.skipped}</span></li>
            <li>Ошибок: <span className="font-semibold">{result.failed}</span></li>
          </ul>
          {result.queued > 0 ? (
            <p className="text-xs text-gray-500">
              Обработка идёт в фоне (Celery). Через минуту обновите статистику и блок превью.
            </p>
          ) : null}
          {Array.isArray(result.failures) && result.failures.length > 0 ? (
            <div className="mt-2">
              <p className="mb-1 font-medium text-gray-800">Примеры пропусков/ошибок</p>
              <ul className="max-h-40 space-y-1 overflow-auto font-mono text-xs text-gray-600">
                {result.failures.slice(0, 15).map((f) => (
                  <li key={`${f.photo_id}-${f.reason}`}>
                    #{f.photo_id}: {f.reason}
                    {f.photo_url ? ` — ${f.photo_url}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
