import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';
import { clearPublicSiteConfigCache } from '../../redux/slices/PublicInfoSlice';

function statusPill(integration, { prefix = '' } = {}) {
  const loginOk = prefix
    ? integration?.[`${prefix}login_configured`]
    : integration?.login_configured;
  const passwordOk = prefix
    ? integration?.[`${prefix}password_configured`]
    : integration?.password_configured;
  const quotaExhausted = prefix
    ? integration?.[`${prefix}quota_exhausted`]
    : integration?.quota_exhausted;
  const lastTestOk = prefix
    ? integration?.[`${prefix}last_test_ok`]
    : integration?.last_test_ok;
  const lastTestError = prefix
    ? integration?.[`${prefix}last_test_error`]
    : integration?.last_test_error;
  const isEnabled = prefix
    ? integration?.[`${prefix}is_enabled`]
    : integration?.is_enabled;

  if (!loginOk || !passwordOk) {
    return { label: 'Не настроено', className: 'bg-gray-100 text-gray-700' };
  }
  if (quotaExhausted) {
    return { label: 'Лимит', className: 'bg-red-100 text-red-800' };
  }
  if (lastTestError && !lastTestOk) {
    return { label: 'Ошибка', className: 'bg-red-100 text-red-800' };
  }
  if (!lastTestOk) {
    return { label: 'Не проверено', className: 'bg-amber-100 text-amber-800' };
  }
  if (!isEnabled) {
    return { label: 'Отключено', className: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'Подключено', className: 'bg-green-100 text-green-800' };
}

function quotaPill(integration) {
  const limit = Number(integration?.daily_request_limit) || 0;
  if (limit <= 0) {
    return { label: 'Без лимита', className: 'bg-gray-100 text-gray-700' };
  }
  if (integration?.quota_exhausted) {
    return { label: 'Лимит исчерпан', className: 'bg-red-100 text-red-800' };
  }
  const remaining = Number(integration?.requests_remaining);
  if (Number.isFinite(remaining) && remaining / limit <= 0.1) {
    return { label: 'Мало осталось', className: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'OK', className: 'bg-green-100 text-green-800' };
}

export default function LaximoCatSection() {
  const [integration, setIntegration] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [docTesting, setDocTesting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [baseUrl, setBaseUrl] = useState('https://ws.laximo.ru/restApi/v1');
  const [dailyLimit, setDailyLimit] = useState('500');
  const [productCardDailyLimit, setProductCardDailyLimit] = useState('10');
  const [isEnabled, setIsEnabled] = useState(false);
  const [docLogin, setDocLogin] = useState('');
  const [docPassword, setDocPassword] = useState('');
  const [docBaseUrl, setDocBaseUrl] = useState('https://ws.laximo.ru/restApi/v1');
  const [docIsEnabled, setDocIsEnabled] = useState(false);
  const [snapshotsFallbackEnabled, setSnapshotsFallbackEnabled] = useState(true);

  const loadData = useCallback(async () => {
    const data = await apiRequest('/admin/laximo-cat/integration');
    setIntegration(data);
    setBaseUrl(data?.base_url || 'https://ws.laximo.ru/restApi/v1');
    setDailyLimit(String(data?.daily_request_limit ?? 500));
    setProductCardDailyLimit(String(data?.product_card_daily_request_limit ?? 10));
    setIsEnabled(Boolean(data?.is_enabled));
    setDocBaseUrl(data?.doc_base_url || 'https://ws.laximo.ru/restApi/v1');
    setDocIsEnabled(Boolean(data?.doc_is_enabled));
    setSnapshotsFallbackEnabled(data?.snapshots_fallback_enabled !== false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadData();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить настройки Laximo.CAT');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const pill = statusPill(integration);
  const docPill = statusPill(integration, { prefix: 'doc_' });
  const qPill = quotaPill(integration);

  const canEnable = useMemo(
    () => Boolean(integration?.last_test_ok) && !integration?.quota_exhausted,
    [integration],
  );

  const canEnableDoc = useMemo(
    () => Boolean(integration?.doc_last_test_ok) && !integration?.doc_quota_exhausted,
    [integration],
  );

  const saveCredentials = async () => {
    if (!login.trim() && !password.trim()) {
      setError('Введите логин и/или пароль');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = {};
      if (login.trim()) body.login = login.trim();
      if (password.trim()) body.password = password.trim();
      const data = await apiRequest('/admin/laximo-cat/credentials', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setIntegration(data);
      setIsEnabled(Boolean(data?.is_enabled));
      setLogin('');
      setPassword('');
      setNotice('Учётные данные сохранены. Нужна повторная проверка API.');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/laximo-cat/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          base_url: baseUrl.trim(),
          daily_request_limit: parseInt(dailyLimit, 10) || 0,
          product_card_daily_request_limit: parseInt(productCardDailyLimit, 10) || 0,
          is_enabled: isEnabled,
          doc_base_url: docBaseUrl.trim(),
          doc_is_enabled: docIsEnabled,
          snapshots_fallback_enabled: snapshotsFallbackEnabled,
        }),
      });
      setIntegration(data);
      setIsEnabled(Boolean(data?.is_enabled));
      setDocIsEnabled(Boolean(data?.doc_is_enabled));
      setSnapshotsFallbackEnabled(data?.snapshots_fallback_enabled !== false);
      clearPublicSiteConfigCache();
      setNotice('Настройки сохранены');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения настроек');
      setIsEnabled(Boolean(integration?.is_enabled));
      setDocIsEnabled(Boolean(integration?.doc_is_enabled));
    } finally {
      setSaving(false);
    }
  };

  const saveDocCredentials = async () => {
    if (!docLogin.trim() && !docPassword.trim()) {
      setError('Введите логин и/или пароль DOC');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const body = {};
      if (docLogin.trim()) body.login = docLogin.trim();
      if (docPassword.trim()) body.password = docPassword.trim();
      const data = await apiRequest('/admin/laximo-cat/doc/credentials', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      setIntegration(data);
      setDocIsEnabled(Boolean(data?.doc_is_enabled));
      setDocLogin('');
      setDocPassword('');
      setNotice('Учётные данные DOC сохранены. Нужна повторная проверка API.');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения DOC');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiRequest('/admin/laximo-cat/test', { method: 'POST' });
      await loadData();
      clearPublicSiteConfigCache();
      if (result?.ok) {
        setNotice(`API доступен (${result.catalogs_count ?? 0} каталогов)`);
      } else {
        setError(result?.error || 'Проверка не удалась');
      }
    } catch (e) {
      setError(e?.message || 'Проверка не удалась');
      await loadData();
    } finally {
      setTesting(false);
    }
  };

  const runDocTest = async () => {
    setDocTesting(true);
    setError(null);
    setNotice(null);
    try {
      const result = await apiRequest('/admin/laximo-cat/doc/test', { method: 'POST' });
      await loadData();
      if (result?.ok) {
        setNotice(`DOC API доступен (FindOEM: ${result.replacements_count ?? 0} замен)`);
      } else {
        setError(result?.error || 'Проверка DOC не удалась');
      }
    } catch (e) {
      setError(e?.message || 'Проверка DOC не удалась');
      await loadData();
    } finally {
      setDocTesting(false);
    }
  };

  const resetQuota = async () => {
    if (!window.confirm('Сбросить дневной счётчик запросов CAT?')) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/laximo-cat/quota/reset', { method: 'POST' });
      setIntegration(data);
      setNotice('Счётчик запросов CAT сброшен');
    } catch (e) {
      setError(e?.message || 'Не удалось сбросить счётчик');
    } finally {
      setSaving(false);
    }
  };

  const resetDocQuota = async () => {
    if (!window.confirm('Сбросить дневной счётчик запросов DOC?')) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/laximo-cat/doc/quota/reset', { method: 'POST' });
      setIntegration(data);
      setNotice('Счётчик запросов DOC сброшен');
    } catch (e) {
      setError(e?.message || 'Не удалось сбросить счётчик DOC');
    } finally {
      setSaving(false);
    }
  };

  const resetProductCardQuota = async () => {
    if (!window.confirm('Сбросить дневной счётчик HTTP-запросов для карточек товаров?')) return;
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/laximo-cat/product-card/quota/reset', { method: 'POST' });
      setIntegration(data);
      setNotice('Счётчик запросов для карточек сброшен');
    } catch (e) {
      setError(e?.message || 'Не удалось сбросить счётчик карточек');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-gray-500">Загрузка…</p>
      </div>
    );
  }

  const used = Number(integration?.requests_today) || 0;
  const docUsed = Number(integration?.doc_requests_today) || 0;
  const limit = Number(integration?.daily_request_limit) || 0;
  const productCardUsed = Number(integration?.product_card_requests_today) || 0;
  const productCardLimit = Number(integration?.product_card_daily_request_limit) || 0;
  const productCardRemaining = integration?.product_card_requests_remaining;
  const remaining = integration?.requests_remaining;
  const docRemaining = integration?.doc_requests_remaining;

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
          <h2 className="text-lg font-semibold text-gray-900">Laximo.CAT</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.className}`}>
            {pill.label}
          </span>
        </div>

        {(integration?.quota_exhausted || integration?.last_upstream_error) && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {integration?.quota_exhausted
              ? 'Дневной лимит запросов исчерпан.'
              : null}
            {integration?.last_upstream_error ? (
              <span className={integration?.quota_exhausted ? ' block mt-1' : ''}>
                Upstream: {integration.last_upstream_error}
              </span>
            ) : null}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Логин</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={integration?.login_configured ? '••••••••' : 'логин'}
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Пароль</label>
              <input
                type="password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                placeholder={integration?.password_configured ? '••••••••' : 'пароль'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {integration?.login_configured && integration?.password_configured
              ? 'Учётные данные сохранены'
              : 'Логин и пароль ещё не заданы'}
          </p>
          <button
            type="button"
            onClick={saveCredentials}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Сохранить
          </button>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">Base URL</label>
            <input
              type="url"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Лимит запросов / сутки</label>
              <input
                type="number"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">0 — без лимита (общий CAT)</p>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                HTTP-запросы для карточек / сутки
              </label>
              <input
                type="number"
                min="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                value={productCardDailyLimit}
                onChange={(e) => setProductCardDailyLimit(e.target.value)}
              />
              <p className="mt-1 text-xs text-gray-500">
                Каждый FindPartReferences / FindApplicableVehicles = 1 запрос. По умолчанию 10.
              </p>
            </div>
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer select-none items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={isEnabled}
                disabled={!canEnable && !isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Включить</span>
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-900">Квота CAT</span>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${qPill.className}`}>
                {qPill.label}
              </span>
            </div>
            <p className="text-sm text-gray-700">
              Использовано{' '}
              <strong>
                {used}
                {limit > 0 ? ` из ${limit}` : ''}
              </strong>
              {remaining != null ? (
                <>
                  {' '}
                  · осталось <strong>{remaining}</strong>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={resetQuota}
              disabled={saving}
              className="mt-2 text-xs text-indigo-600 hover:underline disabled:opacity-50"
            >
              Сбросить счётчик сегодня
            </button>
          </div>

          <div className="rounded-lg border border-indigo-100 bg-indigo-50/60 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-900">Квота карточек товаров</span>
              {integration?.product_card_quota_exhausted ? (
                <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">
                  Лимит исчерпан
                </span>
              ) : (
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-800">
                  OK
                </span>
              )}
            </div>
            <p className="text-sm text-gray-700">
              HTTP к Laximo для применимости:{' '}
              <strong>
                {productCardUsed}
                {productCardLimit > 0 ? ` из ${productCardLimit}` : ''}
              </strong>
              {productCardRemaining != null ? (
                <>
                  {' '}
                  · осталось <strong>{productCardRemaining}</strong>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={resetProductCardQuota}
              disabled={saving}
              className="mt-2 text-xs text-indigo-600 hover:underline disabled:opacity-50"
            >
              Сбросить счётчик карточек
            </button>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-gray-900">Снимки каталога (offline)</span>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={snapshotsFallbackEnabled}
                  onChange={(e) => setSnapshotsFallbackEnabled(e.target.checked)}
                />
                Fallback без API
              </label>
            </div>
            <p className="text-sm text-gray-700">
              VIN: <strong>{Number(integration?.snapshots_vin) || 0}</strong>
              {' · '}
              узлы: <strong>{Number(integration?.snapshots_nodes) || 0}</strong>
              {' · '}
              всего: <strong>{Number(integration?.snapshots_total) || 0}</strong>
              {' · '}
              схемы: <strong>{Number(integration?.snapshot_assets) || 0}</strong>
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Сохраняются только уже открытые VIN и узлы. При отключении Laximo отдаются из снимков.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Сохранить настройки
            </button>
            <button
              type="button"
              onClick={runTest}
              disabled={
                testing ||
                saving ||
                !integration?.login_configured ||
                !integration?.password_configured
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? 'Проверка…' : 'Проверить API'}
            </button>
          </div>

          {integration?.last_test_error && !integration?.last_test_ok ? (
            <p className="text-sm text-red-700">Ошибка проверки: {integration.last_test_error}</p>
          ) : null}
          {integration?.last_test_ok && integration?.last_test_catalogs_count != null ? (
            <p className="text-sm text-gray-600">
              Последняя проверка: {integration.last_test_catalogs_count} каталогов
            </p>
          ) : null}
        </div>
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Laximo.DOC</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${docPill.className}`}>
            {docPill.label}
          </span>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Отдельные учётные данные для аналогов (FindOEM). Лимит запросов в сутки — общий с CAT
          (отдельный счётчик DOC).
        </p>

        {(integration?.doc_quota_exhausted || integration?.doc_last_upstream_error) && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
            {integration?.doc_quota_exhausted ? 'Дневной лимит запросов DOC исчерпан.' : null}
            {integration?.doc_last_upstream_error ? (
              <span className={integration?.doc_quota_exhausted ? ' block mt-1' : ''}>
                Upstream: {integration.doc_last_upstream_error}
              </span>
            ) : null}
          </div>
        )}

        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Логин DOC</label>
              <input
                type="text"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder={integration?.doc_login_configured ? '••••••••' : 'логин'}
                value={docLogin}
                onChange={(e) => setDocLogin(e.target.value)}
                autoComplete="off"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Пароль DOC</label>
              <input
                type="password"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
                placeholder={integration?.doc_password_configured ? '••••••••' : 'пароль'}
                value={docPassword}
                onChange={(e) => setDocPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {integration?.doc_login_configured && integration?.doc_password_configured
              ? 'Учётные данные DOC сохранены'
              : 'Логин и пароль DOC ещё не заданы'}
          </p>
          <button
            type="button"
            onClick={saveDocCredentials}
            disabled={saving}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            Сохранить DOC
          </button>

          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">DOC Base URL</label>
            <input
              type="url"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm"
              value={docBaseUrl}
              onChange={(e) => setDocBaseUrl(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <label className="flex cursor-pointer select-none items-center gap-3">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                checked={docIsEnabled}
                disabled={!canEnableDoc && !docIsEnabled}
                onChange={(e) => setDocIsEnabled(e.target.checked)}
              />
              <span className="font-medium text-gray-900">Включить DOC (аналоги)</span>
            </label>
          </div>

          <div className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-3">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className="text-sm font-medium text-gray-900">Квота DOC</span>
            </div>
            <p className="text-sm text-gray-700">
              Использовано{' '}
              <strong>
                {docUsed}
                {limit > 0 ? ` из ${limit}` : ''}
              </strong>
              {docRemaining != null ? (
                <>
                  {' '}
                  · осталось <strong>{docRemaining}</strong>
                </>
              ) : null}
            </p>
            <button
              type="button"
              onClick={resetDocQuota}
              disabled={saving}
              className="mt-2 text-xs text-indigo-600 hover:underline disabled:opacity-50"
            >
              Сбросить счётчик DOC сегодня
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Сохранить настройки DOC
            </button>
            <button
              type="button"
              onClick={runDocTest}
              disabled={
                docTesting ||
                saving ||
                !integration?.doc_login_configured ||
                !integration?.doc_password_configured
              }
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {docTesting ? 'Проверка…' : 'Проверить DOC (FindOEM)'}
            </button>
          </div>

          {integration?.doc_last_test_error && !integration?.doc_last_test_ok ? (
            <p className="text-sm text-red-700">Ошибка проверки DOC: {integration.doc_last_test_error}</p>
          ) : null}
          {integration?.doc_last_test_ok ? (
            <p className="text-sm text-gray-600">Последняя проверка DOC: успешно</p>
          ) : null}
        </div>
      </div>
    </>
  );
}
