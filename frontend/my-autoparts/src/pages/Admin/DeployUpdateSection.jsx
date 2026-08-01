import React, { useCallback, useEffect, useRef, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

function statusLabel(status) {
  switch (status) {
    case 'running':
      return 'Выполняется…';
    case 'ok':
      return 'Последний запуск успешен';
    case 'error':
      return 'Последний запуск с ошибкой';
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

export default function DeployUpdateSection() {
  const [info, setInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const pollRef = useRef(null);

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await apiRequest('/admin/deploy-update');
      setInfo(data);
      setError(null);
      return data;
    } catch (e) {
      if (!silent) {
        setError(e?.message || 'Не удалось получить статус обновления');
      }
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
      }, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [info?.running, info?.status, loadStatus]);

  const startUpdate = async () => {
    const ok = window.confirm(
      'Запустить production-обновление (git pull, сборка frontend, перезапуск API)?\n\n' +
        'Сайт может быть недоступен несколько минут. Не закрывайте вкладку до появления статуса.'
    );
    if (!ok) return;

    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/deploy-update', { method: 'POST' });
      setInfo(data);
      setNotice(
        'Обновление запущено. API скоро перезапустится — обновите страницу через 2–5 минут, если интерфейс зависнет.'
      );
    } catch (e) {
      setError(e?.message || 'Не удалось запустить update');
      await loadStatus({ silent: true });
    } finally {
      setBusy(false);
    }
  };

  const status = info?.status || 'idle';
  const canRun = info?.can_run !== false;
  const running = Boolean(info?.running || status === 'running');
  const logTail = Array.isArray(info?.log_tail) ? info.log_tail : [];

  return (
    <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">Обновление сервера</h2>
          <p className="text-sm text-gray-600 mt-1">
            Запускает скрипт <code className="text-xs bg-gray-100 px-1 rounded">update</code> на
            сервере: git pull, сборка фронтенда, перезапуск backend. Нужны права администратора.
          </p>
        </div>
        <span
          className={`inline-flex self-start items-center rounded-full px-2.5 py-1 text-xs font-medium ${statusBadgeClass(
            status
          )}`}
        >
          {loading ? 'Загрузка…' : statusLabel(status)}
        </span>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-700">
          {notice}
        </div>
      )}
      {!canRun && info?.reason && (
        <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          {info.reason}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <button
          type="button"
          disabled={busy || loading || running || !canRun}
          onClick={startUpdate}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-50"
        >
          {busy || running ? 'Обновление выполняется…' : 'Запустить update'}
        </button>
        <button
          type="button"
          disabled={loading}
          onClick={() => loadStatus()}
          className="inline-flex items-center justify-center px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 hover:bg-gray-50 disabled:opacity-50"
        >
          Обновить статус
        </button>
      </div>

      {info?.started_at && (
        <p className="text-xs text-gray-500 mb-2">
          Последний запуск из админки: {new Date(info.started_at).toLocaleString('ru-RU')}
        </p>
      )}

      {logTail.length > 0 && (
        <details className="mt-2">
          <summary className="cursor-pointer text-sm text-gray-700 font-medium">
            Лог update (хвост)
          </summary>
          <pre className="mt-2 max-h-64 overflow-auto rounded-lg bg-gray-950 text-gray-100 text-xs p-3 whitespace-pre-wrap break-all">
            {logTail.join('\n')}
          </pre>
        </details>
      )}
    </section>
  );
}
