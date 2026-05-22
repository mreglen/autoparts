import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { apiAxios } from '../../utils/apiClient';
import AuditEntityPicker from '../../components/Audit/AuditEntityPicker';
import AuditSearchInput from '../../components/Audit/AuditSearchInput';
import { AuditDetailsStructured } from './auditDetailsView';
import {
  buildAuditQueryParams,
  formatAuditDate,
  getMonthRangeDefaults,
  labelCategory,
  labelEventType,
  parseDetails,
} from './auditDisplay';

function AuditDetailModal({ event, meta, onClose }) {
  if (!event) return null;
  const details = parseDetails(event);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-xl">
        <div className="flex items-start justify-between gap-4 border-b border-gray-100 px-6 py-5">
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Событие #{event.id}</h3>
            <p className="mt-1 text-sm text-gray-500">{formatAuditDate(event.created_at)}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
            aria-label="Закрыть"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4 text-sm">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <span className="text-gray-500">Категория</span>
              <p className="font-medium">{labelCategory(event.category, meta)}</p>
            </div>
            <div>
              <span className="text-gray-500">Тип</span>
              <p className="font-medium">{labelEventType(event.event_type, meta)}</p>
            </div>
            <div>
              <span className="text-gray-500">Пользователь</span>
              <p className="font-medium">{event.actor_name || event.email || '—'}</p>
              {event.user_public_code && (
                <p className="text-xs text-gray-500 font-mono">ID {event.user_public_code}</p>
              )}
            </div>
            <div>
              <span className="text-gray-500">Организация</span>
              <p className="font-medium">{event.organization_name || event.organization_id || '—'}</p>
              {event.organization_id && event.organization_name && (
                <p className="text-xs font-mono text-gray-500">{event.organization_id}</p>
              )}
            </div>
            <div>
              <span className="text-gray-500">IP</span>
              <p className="font-medium font-mono">{event.ip_address || '—'}</p>
            </div>
            {event.entity_type && (
              <div className="sm:col-span-2">
                <span className="text-gray-500">Объект</span>
                <p className="font-medium font-mono">
                  {event.entity_type} #{event.entity_id}
                </p>
              </div>
            )}
          </div>
          {event.summary && (
            <div>
              <span className="text-gray-500">Описание</span>
              <p className="mt-1 rounded-lg bg-gray-50 p-3 text-gray-800">{event.summary}</p>
            </div>
          )}
          <div>
            <span className="text-gray-500">Детали</span>
            <div className="mt-2 rounded-lg border border-gray-100 bg-white p-4">
              {details != null ? (
                <AuditDetailsStructured data={details} />
              ) : (
                <p className="text-gray-500">—</p>
              )}
            </div>
            {details != null && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-700">
                  Показать технические данные (JSON)
                </summary>
                <pre className="mt-2 max-h-48 overflow-auto rounded-lg bg-gray-900 p-3 text-xs text-green-100">
                  {JSON.stringify(details, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
        <div className="border-t border-gray-100 px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  );
}

const fetchOrganizations = async (q) => {
  const res = await apiAxios.get('/audit/meta/organizations', { params: { q, limit: 20 } });
  return res.data?.items || [];
};

const fetchUsers = async (q) => {
  const res = await apiAxios.get('/audit/meta/users', { params: { q, limit: 20 } });
  return res.data?.items || [];
};

export default function AuditLogPage() {
  const { user, permissionCodes } = useSelector((state) => state.auth);
  const defaults = useMemo(() => getMonthRangeDefaults(), []);

  const hasAccess =
    user?.is_admin ||
    (user?.is_employee && permissionCodes?.includes('admin.audit'));

  const [dateFrom, setDateFrom] = useState(defaults.dateFrom);
  const [dateTo, setDateTo] = useState(defaults.dateTo);
  const [category, setCategory] = useState('all');
  const [eventType, setEventType] = useState('all');
  const [organizationId, setOrganizationId] = useState('');
  const [orgDisplay, setOrgDisplay] = useState('');
  const [userQuery, setUserQuery] = useState('');
  const [userDisplay, setUserDisplay] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(50);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [rows, setRows] = useState([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState(null);

  const loadMeta = useCallback(async () => {
    try {
      const res = await apiAxios.get('/audit/meta/filters');
      setMeta(res.data);
    } catch {
      /* optional */
    }
  }, []);

  const loadEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = buildAuditQueryParams({
        dateFrom,
        dateTo,
        category,
        eventType,
        organizationId,
        userQuery,
        search,
        page,
        limit,
      });
      const res = await apiAxios.get('/audit/events', { params });
      setRows(res.data?.rows || []);
      setTotal(res.data?.total ?? 0);
      setPages(res.data?.pages ?? 0);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || 'Ошибка загрузки');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo, category, eventType, organizationId, userQuery, search, page, limit]);

  useEffect(() => {
    if (hasAccess) loadMeta();
  }, [hasAccess, loadMeta]);

  useEffect(() => {
    if (hasAccess) loadEvents();
  }, [hasAccess, loadEvents]);

  if (!user) return <Navigate to="/auth" replace />;
  if (!hasAccess) return <Navigate to="/" replace />;

  const categoryOptions = meta?.categories?.length
    ? meta.categories
    : Object.entries(meta?.category_labels || {}).map(([code, label]) => ({ code, label }));

  const eventTypeOptions = meta?.event_types?.length
    ? meta.event_types
    : [];

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="max-md:hidden text-2xl font-bold text-gray-800">Журнал событий</h1>
          <p className="text-sm text-gray-500">Все события платформы</p>
        </div>
        {!loading && (
          <p className="text-sm text-gray-600">
            Найдено: <span className="font-semibold">{total}</span>
          </p>
        )}
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 rounded-xl border border-gray-200 bg-white p-4 shadow-sm md:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">С даты</label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">По дату</label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Категория</label>
          <select
            value={category}
            onChange={(e) => { setCategory(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">Все</option>
            {categoryOptions.map((c) => (
              <option key={c.code} value={c.code}>{c.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Тип события</label>
          <select
            value={eventType}
            onChange={(e) => { setEventType(e.target.value); setPage(1); }}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:ring-indigo-500"
          >
            <option value="all">Все</option>
            {eventTypeOptions.map((t) => (
              <option key={t.code} value={t.code}>{t.label}</option>
            ))}
          </select>
        </div>

        <AuditEntityPicker
          label="Организация"
          placeholder="Название или ID организации"
          value={organizationId}
          displayValue={orgDisplay}
          onChange={(v) => {
            setOrgDisplay(v);
            if (!v.trim()) {
              setOrganizationId('');
              setPage(1);
            }
          }}
          onSelect={(opt) => {
            if (!opt) {
              setOrganizationId('');
              setOrgDisplay('');
            } else {
              setOrganizationId(opt.id);
              setOrgDisplay(opt.name ? `${opt.name}` : opt.id);
            }
            setPage(1);
          }}
          fetchOptions={fetchOrganizations}
          getOptionKey={(o) => o.id}
          renderOption={(o) => (
            <div>
              <div className="text-sm font-medium text-gray-900">{o.name || o.id}</div>
              <div className="text-xs font-mono text-gray-500">{o.id}</div>
            </div>
          )}
        />

        <AuditEntityPicker
          label="Пользователь"
          placeholder="ID, ФИО или email"
          value={userQuery}
          displayValue={userDisplay}
          onChange={(v) => {
            setUserDisplay(v);
            setUserQuery(v);
            setPage(1);
          }}
          onSelect={(opt) => {
            if (!opt) {
              setUserQuery('');
              setUserDisplay('');
            } else {
              setUserQuery(opt.public_code);
              setUserDisplay(opt.display_name || opt.email || opt.public_code);
            }
            setPage(1);
          }}
          fetchOptions={fetchUsers}
          getOptionKey={(u) => `${u.id}-${u.public_code}`}
          renderOption={(u) => (
            <div>
              <div className="text-sm font-medium text-gray-900">
                {u.display_name || u.email || '—'}
              </div>
              <div className="text-xs font-mono text-gray-500">{u.public_code}</div>
            </div>
          )}
        />

        <AuditSearchInput
          value={search}
          onChange={setSearch}
          onApply={() => setPage(1)}
        />
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {loading ? (
        <div className="flex flex-col items-center py-16">
          <div className="mb-4 h-10 w-10 animate-spin rounded-full border-2 border-indigo-600 border-t-transparent" />
          <p className="text-gray-600">Загрузка событий...</p>
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white py-16 text-center text-gray-500">
          События не найдены
        </div>
      ) : (
        <>
        <div className="md:hidden space-y-3">
          {rows.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setSelected(row)}
              className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm active:bg-indigo-50/40"
            >
              <p className="text-xs text-gray-500">{formatAuditDate(row.created_at)}</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                  {labelCategory(row.category, meta)}
                </span>
                <span className="text-sm font-medium text-gray-900">
                  {row.event_type_label || labelEventType(row.event_type, meta)}
                </span>
              </div>
              <p className="mt-2 text-sm text-gray-700 break-words">
                {row.actor_name || row.email || '—'}
              </p>
              <p className="mt-1 text-sm text-gray-600 break-words">
                {row.organization_name || row.organization_id || '—'}
              </p>
              {row.summary && (
                <p className="mt-2 line-clamp-2 text-sm text-gray-500">{row.summary}</p>
              )}
            </button>
          ))}
        </div>

        <div className="hidden md:block overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="border-b border-gray-100 bg-gray-50/80 text-left text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-4 py-3">Дата</th>
                  <th className="px-4 py-3">Категория</th>
                  <th className="px-4 py-3">Тип</th>
                  <th className="px-4 py-3">Пользователь</th>
                  <th className="px-4 py-3">Организация</th>
                  <th className="px-4 py-3">Описание</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    onClick={() => setSelected(row)}
                    className="cursor-pointer border-b border-gray-100 transition-colors hover:bg-indigo-50/40"
                  >
                    <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                      {formatAuditDate(row.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                        {labelCategory(row.category, meta)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800">
                      {row.event_type_label || labelEventType(row.event_type, meta)}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div>{row.actor_name || row.email || '—'}</div>
                      {row.user_public_code && (
                        <div className="text-xs font-mono text-gray-500">{row.user_public_code}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      <div className="text-sm">{row.organization_name || row.organization_id || '—'}</div>
                      {row.organization_id && row.organization_name && (
                        <div className="text-xs font-mono text-gray-500">{row.organization_id}</div>
                      )}
                    </td>
                    <td className="max-w-xs truncate px-4 py-3 text-gray-600">
                      {row.summary || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        </>
      )}

      {pages > 1 && (
        <div className="mt-4 flex items-center justify-center gap-4">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-sm text-gray-600">
            Стр. {page} из {pages}
          </span>
          <button
            type="button"
            disabled={page >= pages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm disabled:opacity-40"
          >
            Вперёд
          </button>
        </div>
      )}

      <AuditDetailModal event={selected} meta={meta} onClose={() => setSelected(null)} />
    </div>
  );
}
