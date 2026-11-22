import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import Toast from '../../components/UI/Toast';

const POLL_MS = 10000;

function statusLabel(status) {
  switch (status) {
    case 'running':
      return 'Сборка выполняется…';
    case 'ok':
      return 'Последняя сборка успешна';
    case 'error':
      return 'Последняя сборка с ошибкой';
    case 'unknown':
      return 'Статус неизвестен';
    default:
      return 'Готово к запуску';
  }
}

function statusBadgeClass(status) {
  switch (status) {
    case 'running':
      return 'bg-amber-50 text-amber-800';
    case 'ok':
      return 'bg-green-50 text-green-800';
    case 'error':
      return 'bg-red-50 text-red-800';
    default:
      return 'bg-gray-100 text-gray-700';
  }
}

function formatBytes(bytes) {
  if (!bytes) return '';
  return `${(bytes / 1024 / 1024).toFixed(1)} МБ`;
}

export default function MobileAppBuildSection() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [notes, setNotes] = useState('');
  const pollRef = useRef(null);

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await apiRequest('/admin/mobile-app/build/status');
      setInfo(data);
      setError(null);
      return data;
    } catch (e) {
      if (!silent) setError(e?.message || 'Не удалось получить статус сборки');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [loadStatus]);

  useEffect(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
    if (info?.running || info?.status === 'running') {
      pollRef.current = setInterval(() => {
        loadStatus({ silent: true });
      }, POLL_MS);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [info?.running, info?.status, loadStatus]);

  const startBuild = async () => {
    const ok = window.confirm(
      'Запустить удалённую сборку APK через EAS Build?\n\n' +
        'Сборка занимает ~15–30 минут. По завершении APK автоматически ' +
        'попадёт в /downloads и будет отдан приложению через /api/mobile/meta.'
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/mobile-app/build/start', {
        method: 'POST',
        body: JSON.stringify({ notes: notes.trim() || null }),
      });
      setInfo(data);
      setNotice('Сборка запущена. Статус обновляется автоматически.');
    } catch (e) {
      setError(e?.message || 'Не удалось запустить сборку');
      await loadStatus({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const status = info?.status || 'idle';
  const canRun = info?.can_run !== false;
  const running = Boolean(info?.running || status === 'running');
  const logTail = Array.isArray(info?.log_tail) ? info.log_tail : [];
  const apk = info?.apk || null;

  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">Сборка APK</h3>
      <p className="mb-4 text-sm text-gray-500">
        Удалённая сборка через EAS Build: результат сохраняется в{' '}
        <code>/downloads</code> и автоматически прописывается в настройки
        «Версия APK» / «Ссылка на APK». Перед сборкой увеличьте версию в{' '}
        <code>mobile/app/app.json</code> и задеплойте репозиторий — EAS собирает
        код с сервера.
      </p>

      {info && !canRun && info?.reason && !running ? (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {info.reason}
        </div>
      ) : null}

      <div className="mb-3">
        <label className="block">
          <span className="mb-1 block text-sm font-medium text-gray-700">
            Примечание к обновлению (необязательно)
          </span>
          <input
            type="text"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Что нового в этой сборке"
            value={notes}
            disabled={running || busy}
            onChange={(e) => setNotes(e.target.value)}
          />
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
            status
          )}`}
        >
          {loading ? 'Загрузка…' : statusLabel(status)}
        </span>
        <button
          type="button"
          onClick={startBuild}
          disabled={busy || loading || running || !canRun}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy || running ? 'Сборка выполняется…' : 'Собрать APK'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => loadStatus()}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
        >
          Обновить статус
        </button>
      </div>

      {apk?.url ? (
        <p className="mt-3 text-sm text-gray-600">
          Последний APK:{' '}
          <a
            href={apk.url}
            className="font-medium text-indigo-600 hover:underline"
            download
          >
            {apk.name}
          </a>
          {apk.size_bytes ? ` (${formatBytes(apk.size_bytes)})` : ''}
          {apk.updated_at
            ? ` — ${new Date(apk.updated_at).toLocaleString('ru-RU')}`
            : ''}
        </p>
      ) : null}

      {info?.started_at ? (
        <p className="mt-1 text-xs text-gray-500">
          Последний запуск: {new Date(info.started_at).toLocaleString('ru-RU')}
          {info.version ? ` · версия ${info.version}` : ''}
          {info.build_id ? ` · build ${String(info.build_id).slice(0, 8)}` : ''}
        </p>
      ) : null}

      {info?.error ? (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {info.error}
        </p>
      ) : null}

      {logTail.length > 0 ? (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm font-medium text-gray-700">
            Лог сборки (хвост)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-950 p-3 text-xs whitespace-pre-wrap break-all text-gray-100">
            {logTail.join('\n')}
          </pre>
        </details>
      ) : null}

      <Toast message={error} variant="error" onClose={() => setError(null)} />
      <Toast message={notice} variant="success" onClose={() => setNotice(null)} />
    </div>
  );
}
