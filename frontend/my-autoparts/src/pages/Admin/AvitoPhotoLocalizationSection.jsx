import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { apiRequest } from '../../utils/apiClient';

export default function AvitoPhotoLocalizationSection() {
  const [organizations, setOrganizations] = useState([]);
  const [totalAvitoPhotos, setTotalAvitoPhotos] = useState(0);
  const [selectedOrgIds, setSelectedOrgIds] = useState([]);
  const [orgSearch, setOrgSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  const loadOrgs = useCallback(async () => {
    const data = await apiRequest('/admin/photos/localize-external/orgs');
    const rows = Array.isArray(data?.organizations) ? data.organizations : [];
    setOrganizations(rows);
    setTotalAvitoPhotos(Number(data?.total_avito_photos) || 0);
    setSelectedOrgIds((prev) => {
      const available = new Set(rows.map((row) => row.org_id));
      const kept = prev.filter((id) => available.has(id));
      if (kept.length) return kept;
      return rows.map((row) => row.org_id);
    });
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await loadOrgs();
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Не удалось загрузить организации с фото Avito');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadOrgs]);

  const filteredOrganizations = useMemo(() => {
    const q = orgSearch.trim().toLowerCase();
    if (!q) return organizations;
    return organizations.filter(
      (row) =>
        (row.org_name || '').toLowerCase().includes(q)
        || (row.org_id || '').toLowerCase().includes(q),
    );
  }, [organizations, orgSearch]);

  const selectedCount = selectedOrgIds.length;
  const selectedPhotoCount = useMemo(() => {
    const selected = new Set(selectedOrgIds);
    return organizations
      .filter((row) => selected.has(row.org_id))
      .reduce((sum, row) => sum + (Number(row.avito_photo_count) || 0), 0);
  }, [organizations, selectedOrgIds]);

  const allFilteredSelected = filteredOrganizations.length > 0
    && filteredOrganizations.every((row) => selectedOrgIds.includes(row.org_id));

  const toggleOrg = (orgId) => {
    setSelectedOrgIds((prev) => (
      prev.includes(orgId)
        ? prev.filter((id) => id !== orgId)
        : [...prev, orgId]
    ));
  };

  const selectAllFiltered = () => {
    setSelectedOrgIds((prev) => {
      const next = new Set(prev);
      filteredOrganizations.forEach((row) => next.add(row.org_id));
      return Array.from(next);
    });
  };

  const clearFiltered = () => {
    const filteredIds = new Set(filteredOrganizations.map((row) => row.org_id));
    setSelectedOrgIds((prev) => prev.filter((id) => !filteredIds.has(id)));
  };

  const runLocalization = async ({ dryRun }) => {
    if (!selectedOrgIds.length) {
      setError('Выберите хотя бы одну организацию');
      return;
    }
    if (!dryRun) {
      const ok = window.confirm(
        `Скачать ${selectedPhotoCount} фото Avito для ${selectedOrgIds.length} орг. `
        + 'и сохранить локально на сервере? Операция может занять много времени.',
      );
      if (!ok) return;
    }

    setBusy(true);
    setError(null);
    try {
      const res = await apiRequest('/admin/photos/localize-external', {
        method: 'POST',
        body: JSON.stringify({
          dry_run: dryRun,
          org_ids: selectedOrgIds,
          all_external: false,
        }),
      });
      setResult(res);
      if (!dryRun) {
        await loadOrgs();
      }
    } catch (e) {
      setError(e?.message || 'Не удалось запустить локализацию фото');
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
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Фото с Avito</h2>

      {error ? (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <div className="mb-3 flex flex-wrap items-center gap-2 text-sm text-gray-600">
        <span>
          Организаций с Avito-фото:{' '}
          <span className="font-semibold text-gray-900">{organizations.length}</span>
        </span>
        <span className="text-gray-300">·</span>
        <span>
          Всего фото:{' '}
          <span className="font-semibold text-gray-900">{totalAvitoPhotos}</span>
        </span>
        <span className="text-gray-300">·</span>
        <span>
          Выбрано: <span className="font-semibold text-gray-900">{selectedCount}</span>
          {' '}орг. / <span className="font-semibold text-gray-900">{selectedPhotoCount}</span> фото
        </span>
      </div>

      {organizations.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-4 py-6 text-sm text-gray-500">
          Внешних Avito-ссылок в товарах не найдено — всё уже локально или фото нет.
        </p>
      ) : (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <input
              type="search"
              value={orgSearch}
              onChange={(e) => setOrgSearch(e.target.value)}
              disabled={busy}
              placeholder="Поиск организации…"
              className="block w-full max-w-sm rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:w-64"
            />
            <button
              type="button"
              onClick={allFilteredSelected ? clearFiltered : selectAllFiltered}
              disabled={busy || filteredOrganizations.length === 0}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              {allFilteredSelected ? 'Снять выбор' : 'Выбрать все (в списке)'}
            </button>
            <button
              type="button"
              onClick={() => loadOrgs()}
              disabled={busy}
              className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
            >
              Обновить список
            </button>
          </div>

          <div className="mb-4 max-h-72 overflow-auto rounded-lg border border-gray-200">
            <ul className="divide-y divide-gray-100">
              {filteredOrganizations.map((row) => {
                const checked = selectedOrgIds.includes(row.org_id);
                return (
                  <li key={row.org_id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-gray-50">
                      <input
                        type="checkbox"
                        className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        checked={checked}
                        disabled={busy}
                        onChange={() => toggleOrg(row.org_id)}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-gray-900">
                          {row.org_name || 'Без названия'}
                        </span>
                        <span className="block truncate font-mono text-xs text-gray-500">
                          {row.org_id}
                        </span>
                      </span>
                      <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800 ring-1 ring-amber-200">
                        {row.avito_photo_count} фото
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => runLocalization({ dryRun: true })}
              disabled={busy || selectedCount === 0}
              className="inline-flex items-center rounded-md border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            >
              {busy ? 'Выполняется…' : 'Проверить (dry-run)'}
            </button>
            <button
              type="button"
              onClick={() => runLocalization({ dryRun: false })}
              disabled={busy || selectedCount === 0}
              className="inline-flex items-center rounded-md bg-indigo-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? 'Выполняется…' : 'Скачать и сохранить локально'}
            </button>
          </div>
        </>
      )}

      {result ? (
        <div className="mt-4 space-y-3 rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">
            Результат: {result.dry_run ? 'проверка (без изменений)' : 'выполнение'}
          </p>
          <p>
            Найдено: <span className="font-semibold">{result.matched}</span>, заменено:{' '}
            <span className="font-semibold">{result.migrated}</span>, ошибок:{' '}
            <span className="font-semibold">{result.failed}</span>
          </p>
          {Array.isArray(result.by_org) && result.by_org.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-gray-900">По организациям:</p>
              <ul className="max-h-40 space-y-1 overflow-auto pr-1 text-xs text-gray-600">
                {result.by_org.map((row) => (
                  <li key={row.org_id}>
                    <span className="font-medium text-gray-800">{row.org_name || row.org_id}</span>
                    : найдено {row.matched}, заменено {row.migrated}, ошибок {row.failed}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {Array.isArray(result.failures) && result.failures.length > 0 ? (
            <div>
              <p className="mb-1 font-medium text-gray-900">Ошибки (первые записи):</p>
              <ul className="max-h-44 space-y-1 overflow-auto pr-1">
                {result.failures.map((row) => (
                  <li key={`${row.photo_id}-${row.reason}`} className="text-xs text-gray-600">
                    photo_id={row.photo_id}: {row.reason}
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
