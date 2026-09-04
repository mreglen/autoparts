import React, { useCallback, useEffect, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

function statusPill(integration) {
  if (!integration?.bot_token_configured) {
    return { label: 'Не настроено', className: 'bg-gray-100 text-gray-700' };
  }
  if (!integration?.is_enabled) {
    return { label: 'Отключено', className: 'bg-amber-100 text-amber-800' };
  }
  if (integration?.service_active || integration?.applied) {
    return { label: 'Работает', className: 'bg-green-100 text-green-800' };
  }
  return { label: 'Токен сохранён', className: 'bg-blue-100 text-blue-800' };
}

export default function VpnBotSection() {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [botToken, setBotToken] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);

  const loadData = useCallback(async () => {
    const data = await apiRequest('/admin/vpn-bot/integration');
    setIntegration(data);
    setIsEnabled(Boolean(data?.is_enabled));
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadData();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить настройки VPN-бота');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const saveCredentials = async () => {
    if (!botToken.trim()) {
      setError('Введите токен бота от @BotFather');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/vpn-bot/credentials', {
        method: 'POST',
        body: JSON.stringify({ bot_token: botToken.trim() }),
      });
      setIntegration(data);
      setIsEnabled(Boolean(data?.is_enabled));
      setBotToken('');
      setNotice(data?.last_apply_status || 'Токен сохранён');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения токена');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/vpn-bot/settings', {
        method: 'PATCH',
        body: JSON.stringify({ is_enabled: isEnabled }),
      });
      setIntegration(data);
      setNotice(data?.last_apply_status || 'Настройки сохранены');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const reapply = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/vpn-bot/apply', { method: 'POST' });
      setIntegration(data);
      setNotice(data?.last_apply_status || 'Применено');
    } catch (e) {
      setError(e?.message || 'Не удалось применить на сервере');
    } finally {
      setSaving(false);
    }
  };

  const pill = statusPill(integration);

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-gray-500">Загрузка VPN-бота…</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-xl border border-green-100 bg-green-50 px-4 py-3 text-sm text-green-800">
          {notice}
        </div>
      )}

      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">VPN Telegram-бот</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.className}`}>
            {pill.label}
          </span>
        </div>

        <p className="mb-4 text-sm text-gray-600">
          Публичный бот выдачи VLESS-ключей Marzban. Токен берётся у{' '}
          <a
            href="https://t.me/BotFather"
            target="_blank"
            rel="noreferrer"
            className="text-indigo-600 hover:underline"
          >
            @BotFather
          </a>
          , сохраняется в БД (шифрованно) и применяется к службе на сервере.
        </p>

        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Токен бота</label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                type="password"
                className="flex-1 rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                placeholder="123456789:AA..."
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={saveCredentials}
                disabled={saving}
                className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Сохранить токен
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-500">
              {integration?.bot_token_configured
                ? 'Токен уже сохранён (значение не показывается)'
                : 'Токен ещё не задан'}
            </p>
          </div>

          <label className="flex cursor-pointer select-none items-center gap-3">
            <input
              type="checkbox"
              className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
              disabled={!integration?.bot_token_configured}
            />
            <span className="font-medium text-gray-900">Бот включён (systemd)</span>
          </label>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving || !integration?.bot_token_configured}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:opacity-50"
            >
              Сохранить включение
            </button>
            <button
              type="button"
              onClick={reapply}
              disabled={saving || !integration?.bot_token_configured}
              className="rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm text-indigo-800 hover:bg-indigo-100 disabled:opacity-50"
            >
              Применить на сервере
            </button>
          </div>

          {integration?.last_apply_status && (
            <p className="text-xs text-gray-500">Последний статус: {integration.last_apply_status}</p>
          )}
        </div>
      </div>
    </>
  );
}
