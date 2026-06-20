import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../utils/apiClient';
import { Section } from './AnalyticsUi';

export default function YandexConnectSection() {
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [integration, setIntegration] = useState(null);
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/yandex/integration');
      setIntegration(data);
      if (!data.connected) {
        const auth = await apiRequest('/admin/yandex/oauth/authorize-url');
        setAuthorizeUrl(auth.authorize_url || '');
      }
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить статус Яндекса');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const connect = async () => {
    const code = verificationCode.trim();
    if (!code) {
      setError('Вставьте код подтверждения с oauth.yandex.ru');
      return;
    }
    setConnecting(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/yandex/oauth/exchange-code', {
        method: 'POST',
        body: JSON.stringify({ code, host_url: 'https://svoygarage.ru' }),
      });
      setIntegration(data);
      setVerificationCode('');
    } catch (e) {
      setError(e?.message || 'Не удалось обменять код');
    } finally {
      setConnecting(false);
    }
  };

  const ensureHost = async () => {
    setConnecting(true);
    setError(null);
    try {
      await apiRequest('/admin/yandex/host/ensure', {
        method: 'POST',
        body: JSON.stringify({ host_url: 'https://svoygarage.ru' }),
      });
      await load();
    } catch (e) {
      setError(e?.message || 'Не удалось привязать сайт');
    } finally {
      setConnecting(false);
    }
  };

  if (loading) {
    return (
      <Section title="Яндекс Вебмастер">
        <p className="px-4 py-3 text-sm text-gray-500">Загрузка…</p>
      </Section>
    );
  }

  const connected = integration?.connected;
  const hostReady = connected && integration?.host_id;

  return (
    <Section
      title="Яндекс Вебмастер"
      subtitle="OAuth для вкладки «Итерации» и SEO KPI"
    >
      <div className="space-y-3 px-4 py-3 text-sm text-gray-600">
        {connected ? (
          <p className="text-green-700">
            OAuth подключён
            {integration.host_id ? (
              <>
                {' '}
                · host_id <span className="font-mono text-xs">{integration.host_id}</span>
              </>
            ) : (
              ' · host_id не привязан — нажмите «Привязать сайт»'
            )}
          </p>
        ) : (
          <>
            <p>
              Client ID сохранён. Получите код на странице Яндекса и вставьте его ниже.
            </p>
            {authorizeUrl ? (
              <a
                href={authorizeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-yellow-400 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-yellow-300"
              >
                Войти через Яндекс
              </a>
            ) : null}
            <div className="flex flex-wrap items-end gap-2">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Код подтверждения</span>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="xxxxxx"
                  className="rounded border border-gray-300 px-3 py-2 font-mono text-sm"
                />
              </label>
              <button
                type="button"
                onClick={connect}
                disabled={connecting}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {connecting ? 'Подключение…' : 'Подключить'}
              </button>
            </div>
          </>
        )}

        {error ? <p className="text-red-600">{error}</p> : null}

        {connected && !hostReady ? (
          <button
            type="button"
            onClick={ensureHost}
            disabled={connecting}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            {connecting ? '…' : 'Привязать svoygarage.ru'}
          </button>
        ) : null}
      </div>
    </Section>
  );
}
