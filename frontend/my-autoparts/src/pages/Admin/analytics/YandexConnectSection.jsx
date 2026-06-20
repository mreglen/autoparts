import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../../utils/apiClient';
import { Section } from './AnalyticsUi';

const YANDEX_OAUTH_APP_URL = 'https://oauth.yandex.ru/';

export default function YandexConnectSection() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [integration, setIntegration] = useState(null);
  const [authorizeUrl, setAuthorizeUrl] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [verificationCode, setVerificationCode] = useState('');

  const fetchAuthorizeUrl = useCallback(async () => {
    try {
      const auth = await apiRequest('/admin/yandex/oauth/authorize-url');
      setAuthorizeUrl(auth.authorize_url || '');
    } catch {
      setAuthorizeUrl('');
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/yandex/integration');
      setIntegration(data);
      setClientId(data.client_id || '');
      if (data.client_id && !data.connected) {
        await fetchAuthorizeUrl();
      } else {
        setAuthorizeUrl('');
      }
    } catch (e) {
      setError(e?.message || 'Не удалось загрузить статус Яндекса');
    } finally {
      setLoading(false);
    }
  }, [fetchAuthorizeUrl]);

  useEffect(() => {
    load();
  }, [load]);

  const saveCredentials = async () => {
    const cid = clientId.trim();
    if (!cid) {
      setError('Укажите Client ID');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = { client_id: cid };
      if (clientSecret.trim()) {
        payload.client_secret = clientSecret.trim();
      } else if (!integration?.client_secret_configured) {
        setError('Укажите Client secret (первое сохранение)');
        setSaving(false);
        return;
      }
      const data = await apiRequest('/admin/yandex/credentials', {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      setIntegration(data);
      setClientSecret('');
      if (!data.connected) {
        await fetchAuthorizeUrl();
      }
    } catch (e) {
      setError(e?.message || 'Не удалось сохранить учётные данные');
    } finally {
      setSaving(false);
    }
  };

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
      setAuthorizeUrl('');
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
  const credentialsReady = Boolean(integration?.client_id && integration?.client_secret_configured);

  return (
    <Section
      title="Яндекс Вебмастер"
      subtitle="OAuth для вкладки «Итерации» и SEO KPI"
    >
      <div className="space-y-4 px-4 py-3 text-sm text-gray-600">
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
        ) : null}

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="font-medium text-gray-800">Шаг 1. Учётные данные приложения</p>
          <p className="text-xs text-gray-500">
            Создайте OAuth-приложение на{' '}
            <a
              href={YANDEX_OAUTH_APP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-indigo-600 hover:underline"
            >
              oauth.yandex.ru
            </a>
            . Redirect URI:{' '}
            <code className="rounded bg-white px-1 py-0.5 text-xs">
              https://oauth.yandex.ru/verification_code
            </code>
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">Client ID</span>
              <input
                type="text"
                value={clientId}
                onChange={(e) => setClientId(e.target.value)}
                placeholder="76422e7e…"
                className="rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-gray-500">
                Client secret
                {integration?.client_secret_configured ? ' (оставьте пустым, чтобы не менять)' : ''}
              </span>
              <input
                type="password"
                value={clientSecret}
                onChange={(e) => setClientSecret(e.target.value)}
                placeholder="••••••••"
                className="rounded border border-gray-300 bg-white px-3 py-2 font-mono text-sm"
                autoComplete="off"
              />
            </label>
          </div>
          <button
            type="button"
            onClick={saveCredentials}
            disabled={saving}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            {saving ? 'Сохранение…' : 'Сохранить Client ID и secret'}
          </button>
          {credentialsReady ? (
            <p className="text-xs text-green-700">Учётные данные сохранены</p>
          ) : null}
        </div>

        {!connected ? (
          <div className="rounded-lg border border-gray-200 p-4 space-y-3">
            <p className="font-medium text-gray-800">Шаг 2. Получить код подтверждения</p>
            <ol className="list-decimal space-y-1 pl-5 text-xs text-gray-600">
              <li>Сохраните Client ID и secret (шаг 1).</li>
              <li>
                Нажмите{' '}
                <strong>«Войти через Яндекс»</strong> — откроется окно авторизации.
              </li>
              <li>Разрешите доступ приложению к данным Вебмастера.</li>
              <li>
                Яндекс перенаправит на страницу{' '}
                <a
                  href="https://oauth.yandex.ru/verification_code"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-indigo-600 hover:underline"
                >
                  oauth.yandex.ru/verification_code
                </a>
                , где будет показан <strong>код подтверждения</strong> (6–7 символов).
              </li>
              <li>Скопируйте код и вставьте в поле ниже.</li>
            </ol>

            {credentialsReady && authorizeUrl ? (
              <a
                href={authorizeUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block rounded-lg bg-yellow-400 px-4 py-2 text-sm font-medium text-gray-900 hover:bg-yellow-300"
              >
                Войти через Яндекс
              </a>
            ) : (
              <p className="text-xs text-amber-700">
                Сначала сохраните Client ID и Client secret — появится кнопка входа.
              </p>
            )}

            <div className="flex flex-wrap items-end gap-2 pt-1">
              <label className="flex flex-col gap-1">
                <span className="text-xs text-gray-500">Код подтверждения</span>
                <input
                  type="text"
                  value={verificationCode}
                  onChange={(e) => setVerificationCode(e.target.value)}
                  placeholder="xxxxxx"
                  disabled={!credentialsReady}
                  className="rounded border border-gray-300 px-3 py-2 font-mono text-sm disabled:bg-gray-100"
                />
              </label>
              <button
                type="button"
                onClick={connect}
                disabled={connecting || !credentialsReady}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
              >
                {connecting ? 'Подключение…' : 'Подключить'}
              </button>
            </div>
          </div>
        ) : null}

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
