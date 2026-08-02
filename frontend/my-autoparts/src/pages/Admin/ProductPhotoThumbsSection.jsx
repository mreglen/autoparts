import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

const DEFAULT_LIMIT = 500;

export default function ProductPhotoThumbsSection() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);
  const [mode, setMode] = useState('missing');
  const [limit, setLimit] = useState(String(DEFAULT_LIMIT));

  const loadStats = useCallback(async () => {
    const data = await apiRequest('/admin/photos/thumbs/stats');
    setStats(data || null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadStats();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить статистику превью');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadStats]);

  const runGenerate = async () => {
    const parsedLimit = Number.parseInt(limit, 10);
    if (!Number.isFinite(parsedLimit) || parsedLimit < 1 || parsedLimit > 5000) {
      setError('Лимит должен быть числом от 1 до 5000');
      return;
    }
    if (mode === 'force') {
      const ok = window.confirm(
        `Пересоздать превью для до ${parsedLimit} фото? Существующие *_thumb.webp будут перезаписаны.`,
      );
      if (!ok) return;
    } else {
      const ok = window.confirm(
        `Создать превью для до ${parsedLimit} фото без thumb_url?`,
      );
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/photos/thumbs/generate', {
        method: 'POST',
        body: JSON.stringify({
          mode,
          limit: parsedLimit,
          batch_size: 50,
        }),
      });
      setResult(res);
      await loadStats();
    } catch (e) {
      setError(e?.message || 'Не удалось запустить генерацию превью');
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
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Превью фото</h2>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Всего фото</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{stats?.total ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">С превью</p>
          <p className="mt-1 text-xl font-semibold text-emerald-900">{stats?.with_thumb ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Без превью</p>
          <p className="mt-1 text-xl font-semibold text-amber-900">{stats?.missing_thumb ?? '—'}</p>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
          <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Внешние URL</p>
          <p className="mt-1 text-xl font-semibold text-gray-900">{stats?.external_skipped ?? '—'}</p>
        </div>
      </div>

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-medium">Режим</span>
          <select
            value={mode}
            disabled={busy}
            onChange={(e) => setMode(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:w-64"
          >
            <option value="missing">Только недостающие</option>
            <option value="force">Пересоздать в батче</option>
          </select>
        </label>
        <label className="block text-sm text-gray-700">
          <span className="mb-1 block font-medium">Лимит за запуск</span>
          <input
            type="number"
            min={1}
            max={5000}
            value={limit}
            disabled={busy}
            onChange={(e) => setLimit(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:w-36"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={runGenerate}
            disabled={busy || (mode === 'missing' && !(stats?.missing_thumb > 0))}
            className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Выполняется…' : 'Создать превью'}
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

      {mode === 'missing' && stats?.missing_thumb === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-500">
          Локальных фото без превью не осталось. Внешние ссылки сюда не входят — сначала
          локализуйте их в блоке Avito при необходимости.
        </p>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">
            Результат ({result.mode === 'force' ? 'пересоздание' : 'недостающие'})
          </p>
          <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
            <li>Обработано: <span className="font-semibold">{result.processed}</span></li>
            <li>Создано: <span className="font-semibold">{result.created}</span></li>
            <li>Привязано с диска: <span className="font-semibold">{result.linked_existing_file}</span></li>
            <li>Пропущено: <span className="font-semibold">{result.skipped}</span></li>
            <li>Ошибок: <span className="font-semibold">{result.failed}</span></li>
          </ul>
          {Array.isArray(result.failures) && result.failures.length > 0 ? (
            <div className="mt-2">
              <p className="mb-1 font-medium text-gray-800">Примеры ошибок</p>
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
