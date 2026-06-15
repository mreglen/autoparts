import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

function statusPill(integration) {
  if (!integration?.api_key_configured) {
    return { label: 'Не настроено', className: 'bg-gray-100 text-gray-700' };
  }
  if (!integration?.is_enabled) {
    return { label: 'Отключено', className: 'bg-amber-100 text-amber-800' };
  }
  return { label: 'Подключено', className: 'bg-green-100 text-green-800' };
}

export default function OpenRouterSection() {
  const [integration, setIntegration] = useState(null);
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [modelId, setModelId] = useState('');
  const [customModelId, setCustomModelId] = useState('');
  const [dailyLimit, setDailyLimit] = useState('50');
  const [perOrgLimit, setPerOrgLimit] = useState('10');
  const [isEnabled, setIsEnabled] = useState(false);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrgIds, setSelectedOrgIds] = useState([]);
  const [testSample, setTestSample] = useState(null);

  const loadData = useCallback(async () => {
    const [integrationData, orgData] = await Promise.all([
      apiRequest('/admin/openrouter/integration'),
      apiRequest('/admin/openrouter/organizations'),
    ]);
    setIntegration(integrationData);
    setOrganizations(Array.isArray(orgData) ? orgData : []);
    setModelId(integrationData?.model_id || '');
    setDailyLimit(String(integrationData?.daily_limit ?? 50));
    setPerOrgLimit(String(integrationData?.per_org_daily_limit ?? 10));
    setIsEnabled(Boolean(integrationData?.is_enabled));
    const recommended = integrationData?.recommended_models || [];
    if (integrationData?.model_id && !recommended.includes(integrationData.model_id)) {
      setCustomModelId(integrationData.model_id);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadData();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить настройки OpenRouter');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const recommendedModels = integration?.recommended_models || [
    'meta-llama/llama-3.3-70b-instruct:free',
    'google/gemma-3-12b-it:free',
    'qwen/qwen-2.5-7b-instruct:free',
    'openrouter/free',
  ];

  const effectiveModelId = modelId === '__custom__' ? customModelId.trim() : modelId;

  const filteredOrganizations = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (row) =>
        (row.name || '').toLowerCase().includes(q) ||
        (row.id || '').toLowerCase().includes(q)
    );
  }, [organizations, orgSearch]);

  const pill = statusPill(integration);

  const saveCredentials = async () => {
    if (!apiKey.trim()) {
      setError('Введите API-ключ OpenRouter');
      return;
    }
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/openrouter/credentials', {
        method: 'POST',
        body: JSON.stringify({ api_key: apiKey.trim() }),
      });
      setIntegration(data);
      setApiKey('');
      setNotice('API-ключ сохранён');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения ключа');
    } finally {
      setSaving(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const data = await apiRequest('/admin/openrouter/settings', {
        method: 'PATCH',
        body: JSON.stringify({
          model_id: effectiveModelId,
          is_enabled: isEnabled,
          daily_limit: parseInt(dailyLimit, 10) || 50,
          per_org_daily_limit: parseInt(perOrgLimit, 10) || 10,
        }),
      });
      setIntegration(data);
      setNotice('Настройки OpenRouter сохранены');
    } catch (e) {
      setError(e?.message || 'Ошибка сохранения настроек');
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setError(null);
    setNotice(null);
    setTestSample(null);
    try {
      const result = await apiRequest('/admin/openrouter/test', { method: 'POST' });
      setTestSample(result);
      setNotice('Подключение успешно');
      await loadData();
    } catch (e) {
      setError(e?.message || 'Тест подключения не удался');
    } finally {
      setTesting(false);
    }
  };

  const toggleOrganization = async (org, enabled) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/admin/openrouter/organizations/${org.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: enabled }),
      });
      await loadData();
      setNotice(enabled ? `Доступ включён: ${org.name || org.id}` : `Доступ выключен: ${org.name || org.id}`);
    } catch (e) {
      setError(e?.message || 'Ошибка обновления организации');
    } finally {
      setSaving(false);
    }
  };

  const bulkUpdateOrganizations = async (enabled) => {
    if (selectedOrgIds.length === 0) {
      setError('Выберите хотя бы одну организацию');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await apiRequest('/admin/openrouter/organizations/bulk', {
        method: 'POST',
        body: JSON.stringify({ organization_ids: selectedOrgIds, is_enabled: enabled }),
      });
      setSelectedOrgIds([]);
      await loadData();
      setNotice(enabled ? 'Доступ включён для выбранных организаций' : 'Доступ выключен для выбранных организаций');
    } catch (e) {
      setError(e?.message || 'Ошибка массового обновления');
    } finally {
      setSaving(false);
    }
  };

  const toggleSelected = (orgId) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId]
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <p className="text-sm text-gray-500">Загрузка OpenRouter…</p>
      </div>
    );
  }

  return (
    <>
      {error && (
        <div className="mb-4 rounded-lg bg-red-50 text-red-800 text-sm px-4 py-3 border border-red-100">
          {error}
        </div>
      )}
      {notice && (
        <div className="mb-4 rounded-lg bg-green-50 text-green-800 text-sm px-4 py-3 border border-green-100">
          {notice}
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h2 className="text-lg font-semibold text-gray-900">OpenRouter — генерация описаний</h2>
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${pill.className}`}>
            {pill.label}
          </span>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          AI-описания для карточек товаров продавцов. Для бесплатного старта используйте модели с суффиксом{' '}
          <code className="text-xs bg-gray-100 px-1 rounded">:free</code> (лимит OpenRouter: 50 запросов/день без пополнения).
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">API-ключ</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="password"
                className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                placeholder="sk-or-v1-…"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                autoComplete="off"
              />
              <button
                type="button"
                onClick={saveCredentials}
                disabled={saving}
                className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                Сохранить ключ
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {integration?.api_key_configured ? 'Ключ сохранён в БД (зашифрован).' : 'Ключ ещё не задан.'}
            </p>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Модель</label>
              <select
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={recommendedModels.includes(modelId) ? modelId : '__custom__'}
                onChange={(e) => setModelId(e.target.value)}
              >
                {recommendedModels.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
                <option value="__custom__">Другая модель…</option>
              </select>
              {modelId === '__custom__' && (
                <input
                  className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
                  placeholder="provider/model:free"
                  value={customModelId}
                  onChange={(e) => setCustomModelId(e.target.value)}
                />
              )}
            </div>
            <div className="flex items-end">
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                  checked={isEnabled}
                  onChange={(e) => setIsEnabled(e.target.checked)}
                />
                <span>
                  <span className="font-medium text-gray-900 block">Включить генерацию</span>
                  <span className="text-sm text-gray-500">Глобальный переключатель для продавцов</span>
                </span>
              </label>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Лимит на сайт / день</label>
              <input
                type="number"
                min="1"
                max="10000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={dailyLimit}
                onChange={(e) => setDailyLimit(e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Лимит на организацию / день</label>
              <input
                type="number"
                min="1"
                max="1000"
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                value={perOrgLimit}
                onChange={(e) => setPerOrgLimit(e.target.value)}
              />
            </div>
          </div>

          <p className="text-sm text-gray-600">
            Сегодня использовано:{' '}
            <strong>
              {integration?.requests_today ?? 0} / {integration?.daily_limit ?? 50}
            </strong>{' '}
            запросов
          </p>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={saveSettings}
              disabled={saving}
              className="rounded-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700 disabled:opacity-50"
            >
              Сохранить настройки
            </button>
            <button
              type="button"
              onClick={runTest}
              disabled={testing || saving || !integration?.api_key_configured}
              className="rounded-md border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {testing ? 'Проверка…' : 'Проверить подключение'}
            </button>
          </div>

          {testSample?.sample && (
            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
              <p className="font-medium text-gray-900 mb-1">Тестовый ответ ({testSample.model})</p>
              <p>{testSample.sample}</p>
            </div>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mt-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-1">Организации с доступом к AI-описаниям</h2>
        <p className="text-sm text-gray-500 mb-4">
          Продавцы выбранных организаций увидят кнопку «Сгенерировать описание» в формах добавления и редактирования товара.
        </p>

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            className="flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm"
            placeholder="Поиск по названию или ID…"
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || selectedOrgIds.length === 0}
            onClick={() => bulkUpdateOrganizations(true)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Включить выбранным
          </button>
          <button
            type="button"
            disabled={saving || selectedOrgIds.length === 0}
            onClick={() => bulkUpdateOrganizations(false)}
            className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Выключить выбранным
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="px-3 py-2 w-10" />
                <th className="px-3 py-2">Организация</th>
                <th className="px-3 py-2">ID</th>
                <th className="px-3 py-2">Доступ</th>
                <th className="px-3 py-2">Вкл.</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrganizations.map((row) => (
                <tr key={row.id} className="border-t border-gray-100">
                  <td className="px-3 py-2">
                    <input
                      type="checkbox"
                      checked={selectedOrgIds.includes(row.id)}
                      onChange={() => toggleSelected(row.id)}
                    />
                  </td>
                  <td className="px-3 py-2">{row.name || '—'}</td>
                  <td className="px-3 py-2 font-mono text-xs">{row.id}</td>
                  <td className="px-3 py-2">
                    <span
                      className={`rounded px-2 py-1 text-xs ${
                        row.ai_description_enabled
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {row.ai_description_enabled ? 'Включён' : 'Выключен'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleOrganization(row, !row.ai_description_enabled)}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      {row.ai_description_enabled ? 'Выключить' : 'Включить'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
