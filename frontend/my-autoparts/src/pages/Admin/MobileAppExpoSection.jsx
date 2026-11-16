import React, { useCallback, useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { apiRequest } from '../../utils/apiClient';
import Toast from '../../components/UI/Toast';

const POLL_MS = 3000;
const URL_WAIT_MS = 120000;

export default function MobileAppExpoSection() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [waitingUrl, setWaitingUrl] = useState(false);
  const [copied, setCopied] = useState(false);
  const pollRef = useRef(null);
  const waitRef = useRef(null);

  const loadStatus = useCallback(async ({ silent = false } = {}) => {
    try {
      const data = await apiRequest('/admin/mobile-app/expo/status');
      setStatus(data);
      setError(null);
      return data;
    } catch (e) {
      if (!silent) setError(e?.message || 'Не удалось получить статус');
      return null;
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStatus();
    pollRef.current = setInterval(() => loadStatus({ silent: true }), POLL_MS);
    return () => {
      clearInterval(pollRef.current);
      clearTimeout(waitRef.current);
    };
  }, [loadStatus]);

  const start = async () => {
    setBusy(true);
    setError(null);
    setWaitingUrl(true);
    clearTimeout(waitRef.current);
    waitRef.current = setTimeout(() => setWaitingUrl(false), URL_WAIT_MS);
    try {
      await apiRequest('/admin/mobile-app/expo/start', { method: 'POST' });
      await loadStatus({ silent: true });
    } catch (e) {
      setError(e?.message || 'Не удалось запустить expo');
      setWaitingUrl(false);
    } finally {
      setBusy(false);
    }
  };

  const stop = async () => {
    setBusy(true);
    setError(null);
    try {
      await apiRequest('/admin/mobile-app/expo/stop', { method: 'POST' });
      await loadStatus({ silent: true });
    } catch (e) {
      setError(e?.message || 'Не удалось остановить expo');
    } finally {
      setBusy(false);
    }
  };

  const copyUrl = async () => {
    if (!status?.url) return;
    try {
      await navigator.clipboard.writeText(status.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard недоступен */
    }
  };

  const running = Boolean(status?.running);
  const url = status?.url || null;
  const showQr = running && url;

  return (
    <div className="mt-6 border-t border-gray-100 pt-5">
      <h3 className="mb-1 text-sm font-semibold text-gray-900">
        Тестирование в Expo Go
      </h3>
      <p className="mb-4 text-sm text-gray-500">
        Запускает <code>npx expo start --tunnel</code> на сервере. Откройте ссылку
        или отсканируйте QR-код в Expo Go на iPhone/Android — работает из любой сети.
      </p>

      {status && !status.mobile_dir_exists ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Каталог mobile/app не найден на сервере — нужен деплой репозитория.
        </div>
      ) : null}
      {status && status.mobile_dir_exists && !status.node_modules_exists ? (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          В mobile/app нет node_modules — запустите обновление на сервере
          (update установит зависимости).
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-3">
        {!running ? (
          <button
            type="button"
            onClick={start}
            disabled={busy || loading || !status?.mobile_dir_exists}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? 'Запуск…' : 'Запустить тестирование'}
          </button>
        ) : (
          <button
            type="button"
            onClick={stop}
            disabled={busy}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {busy ? 'Остановка…' : 'Остановить'}
          </button>
        )}
        <span
          className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ${
            running
              ? 'bg-green-50 text-green-800'
              : 'bg-gray-100 text-gray-600'
          }`}
        >
          {running ? 'Expo запущен' : 'Expo остановлен'}
        </span>
        {waitingUrl && running && !url ? (
          <span className="text-sm text-gray-500">Ожидание ссылки…</span>
        ) : null}
      </div>

      {showQr ? (
        <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center">
          <div className="rounded-xl border border-gray-200 bg-white p-3">
            <QRCodeSVG value={url} size={160} level="M" includeMargin={false} />
          </div>
          <div className="min-w-0">
            <div className="mb-1 text-xs font-medium uppercase text-gray-500">
              Адрес для Expo Go
            </div>
            <div className="flex items-center gap-2">
              <code className="break-all rounded-lg bg-gray-100 px-3 py-2 text-sm text-gray-900">
                {url}
              </code>
              <button
                type="button"
                onClick={copyUrl}
                className="shrink-0 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {copied ? 'Скопировано' : 'Копировать'}
              </button>
            </div>
            <p className="mt-2 text-xs text-gray-500">
              В Expo Go: «Enter URL manually» → вставьте адрес. QR можно
              отсканировать камерой Expo Go.
            </p>
          </div>
        </div>
      ) : null}

      {error ? <Toast message={error} variant="error" onClose={() => setError(null)} /> : null}
    </div>
  );
}
