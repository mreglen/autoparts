import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

export default function UnpaidCheckoutSection() {
  const [organizations, setOrganizations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [orgSearch, setOrgSearch] = useState('');
  const [selectedOrgIds, setSelectedOrgIds] = useState([]);

  const loadData = useCallback(async () => {
    const orgData = await apiRequest('/admin/unpaid-checkout/organizations');
    setOrganizations(Array.isArray(orgData) ? orgData : []);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadData();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить организации');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadData]);

  const filteredOrganizations = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (row) =>
        (row.name || '').toLowerCase().includes(q) ||
        (row.id || '').toLowerCase().includes(q)
    );
  }, [organizations, orgSearch]);

  const enabledCount = organizations.filter((row) => row.allow_unpaid_checkout).length;

  const toggleOrganization = async (org, enabled) => {
    setSaving(true);
    setError(null);
    try {
      await apiRequest(`/admin/unpaid-checkout/organizations/${org.id}`, {
        method: 'PUT',
        body: JSON.stringify({ is_enabled: enabled }),
      });
      await loadData();
      setNotice(
        enabled
          ? `Оформление без оплаты включено: ${org.name || org.id}`
          : `Оформление без оплаты выключено: ${org.name || org.id}`
      );
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
      await apiRequest('/admin/unpaid-checkout/organizations/bulk', {
        method: 'POST',
        body: JSON.stringify({ organization_ids: selectedOrgIds, is_enabled: enabled }),
      });
      setSelectedOrgIds([]);
      await loadData();
      setNotice(
        enabled
          ? 'Оформление без оплаты включено для выбранных организаций'
          : 'Оформление без оплаты выключено для выбранных организаций'
      );
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
      <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm text-gray-500">Загрузка…</p>
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
        <div className="mb-2 flex flex-wrap items-center gap-3">
          <h2 className="text-lg font-semibold text-gray-900">Оформление без оплаты</h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-700">
            {enabledCount} вкл.
          </span>
        </div>
        <p className="mb-4 text-sm text-gray-600">
          Сотрудники выбранных организаций увидят кнопку «Оформить без оплаты» внизу оформления
          заказа новых запчастей. Заказ создаётся сразу, без ЮKassa.
        </p>

        <div className="mb-4 flex flex-col gap-2 sm:flex-row">
          <input
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Поиск…"
            value={orgSearch}
            onChange={(e) => setOrgSearch(e.target.value)}
          />
          <button
            type="button"
            disabled={saving || selectedOrgIds.length === 0}
            onClick={() => bulkUpdateOrganizations(true)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Включить выбранным
          </button>
          <button
            type="button"
            disabled={saving || selectedOrgIds.length === 0}
            onClick={() => bulkUpdateOrganizations(false)}
            className="rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm hover:bg-gray-50 disabled:opacity-50"
          >
            Выключить выбранным
          </button>
        </div>

        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-500">
              <tr>
                <th className="w-10 px-3 py-2" />
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
                        row.allow_unpaid_checkout
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {row.allow_unpaid_checkout ? 'Включён' : 'Выключен'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => toggleOrganization(row, !row.allow_unpaid_checkout)}
                      className="text-xs text-indigo-600 hover:underline disabled:opacity-50"
                    >
                      {row.allow_unpaid_checkout ? 'Выключить' : 'Включить'}
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
