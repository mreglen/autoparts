import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import Toast from '../../components/UI/Toast';
import { apiRequest } from '../../utils/apiClient';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';
import {
  autoserviceListTableClass,
  autoserviceListTheadRowClass,
  autoserviceListThClass,
  autoserviceListTbodyClass,
  autoserviceListTrClass,
  autoserviceListTdClass,
  autoserviceListTdRightClass,
} from '../../utils/warehouseListUi';

const STATUS_META = {
  sent: { label: 'Отправлено', className: 'bg-success-50 text-success-700 ring-success-100' },
  error: { label: 'Ошибка', className: 'bg-danger-50 text-danger-700 ring-danger-100' },
};

const inputClass = 'sg-pill-input mt-1';

function formatDateTime(value) {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(value) {
  const n = Number(value || 0);
  return `${n.toLocaleString('ru-RU', { minimumFractionDigits: 2, maximumFractionDigits: 4 })} ₽`;
}

function monthStart(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
}

function today() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function SettingsTab() {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [configured, setConfigured] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);

  useEffect(() => {
    apiRequest('/admin/sms/settings')
      .then((data) => {
        setLogin(data?.login || '');
        setConfigured(Boolean(data?.configured));
      })
      .catch(() => setToast({ variant: 'error', message: 'Не удалось загрузить настройки' }))
      .finally(() => setLoading(false));
  }, []);

  const save = async (e) => {
    e.preventDefault();
    setSaving(true);
    try {
      const data = await apiRequest('/admin/sms/settings', {
        method: 'PUT',
        body: JSON.stringify({ login, password: password || undefined }),
      });
      setLogin(data?.login || '');
      setConfigured(Boolean(data?.configured));
      setPassword('');
      setToast({ variant: 'success', message: 'Настройки сохранены' });
    } catch (err) {
      setToast({ variant: 'error', message: err?.message || 'Не удалось сохранить' });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="py-10 text-center text-sm text-ink-muted">Загрузка…</p>;
  }

  return (
    <form onSubmit={save} className="mx-auto max-w-md space-y-4">
      <div>
        <label className="block text-sm font-medium text-ink-soft">Логин SMSC</label>
        <input
          className={inputClass}
          value={login}
          onChange={(e) => setLogin(e.target.value)}
          placeholder="Логин от smsc.ru"
          autoComplete="username"
          maxLength={64}
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-ink-soft">Пароль SMSC</label>
        <input
          type="password"
          className={inputClass}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={configured ? '•••••••• (оставить без изменений)' : 'Пароль от smsc.ru'}
          autoComplete="new-password"
          maxLength={200}
        />
      </div>
      <p className="text-xs text-ink-faint">
        Ключи берутся из аккаунта на smsc.ru. СМС оплачиваются с баланса аккаунта — цена каждой
        отправки сохраняется в истории.
      </p>
      <button
        type="submit"
        disabled={saving || !login.trim()}
        className="min-h-11 w-full rounded-sg-sm bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 disabled:opacity-60"
      >
        {saving ? 'Сохранение…' : 'Сохранить'}
      </button>
      {toast ? (
        <Toast message={toast.message} variant={toast.variant} onClose={() => setToast(null)} />
      ) : null}
    </form>
  );
}

function HistoryTab() {
  const [dateFrom, setDateFrom] = useState(() => monthStart(new Date()));
  const [dateTo, setDateTo] = useState(() => today());
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set('date_from', dateFrom);
      if (dateTo) params.set('date_to', dateTo);
      const result = await apiRequest(`/admin/sms/history?${params.toString()}`);
      setData(result);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить историю');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/admin/sms') load();
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [load]);

  const items = data?.items || [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-xs font-medium text-ink-soft">Период с</label>
          <input
            type="date"
            className="sg-pill-input mt-1"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-ink-soft">по</label>
          <input
            type="date"
            className="sg-pill-input mt-1"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
        <div className="rounded-sg-sm border border-line bg-surface px-4 py-2 text-sm">
          <span className="text-ink-muted">Итого за период: </span>
          <span className="font-semibold text-ink">{formatMoney(data?.total_cost)}</span>
          <span className="ml-2 text-ink-faint">({data?.count ?? 0} сообщ.)</span>
        </div>
      </div>

      {loading ? (
        <p className="py-10 text-center text-sm text-ink-muted">Загрузка…</p>
      ) : error ? (
        <p className="py-10 text-center text-sm text-danger-600">{error}</p>
      ) : items.length === 0 ? (
        <p className="py-10 text-center text-sm text-ink-muted">За период отправок нет</p>
      ) : (
        <>
          <div className="hidden overflow-x-auto sm:block">
            <table className={autoserviceListTableClass}>
              <thead>
                <tr className={autoserviceListTheadRowClass}>
                  <th className={`w-36 ${autoserviceListThClass}`}>Дата</th>
                  <th className={`w-40 ${autoserviceListThClass}`}>Телефон</th>
                  <th className={autoserviceListThClass}>Текст</th>
                  <th className={`w-28 ${autoserviceListThClass}`}>Статус</th>
                  <th className={`w-20 ${autoserviceListThClass} text-right`}>Цена</th>
                </tr>
              </thead>
              <tbody className={autoserviceListTbodyClass}>
                {items.map((item) => {
                  const meta = STATUS_META[item.status] || { label: item.status, className: '' };
                  return (
                    <tr key={item.id} className={autoserviceListTrClass}>
                      <td className={`whitespace-nowrap ${autoserviceListTdClass}`}>
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className={`whitespace-nowrap font-mono ${autoserviceListTdClass}`}>
                        {item.phone}
                      </td>
                      <td className={autoserviceListTdClass}>
                        <span className="block max-w-md truncate" title={item.error_message || item.text}>
                          {item.status === 'error' && item.error_message
                            ? item.error_message
                            : item.text}
                        </span>
                      </td>
                      <td className={autoserviceListTdClass}>
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}>
                          {meta.label}
                        </span>
                      </td>
                      <td className={`tabular-nums ${autoserviceListTdRightClass}`}>
                        {item.status === 'sent' ? formatMoney(item.cost) : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="space-y-2 sm:hidden">
            {items.map((item) => {
              const meta = STATUS_META[item.status] || { label: item.status, className: '' };
              return (
                <div key={item.id} className="rounded-sg-sm border border-line bg-surface px-3 py-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono text-sm text-ink">{item.phone}</span>
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${meta.className}`}>
                      {meta.label}
                    </span>
                  </div>
                  <div className="mt-1 truncate text-xs text-ink-muted" title={item.error_message || item.text}>
                    {item.status === 'error' && item.error_message ? item.error_message : item.text}
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-ink-faint">
                    <span>{formatDateTime(item.created_at)}</span>
                    <span className="font-semibold text-ink">
                      {item.status === 'sent' ? formatMoney(item.cost) : '—'}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

const TABS = [
  { id: 'settings', label: 'Настройки' },
  { id: 'history', label: 'История' },
];

export default function AdminSmsPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const [searchParams, setSearchParams] = useSearchParams();
  const activeTab = searchParams.get('tab') === 'history' ? 'history' : 'settings';

  useEffect(() => {
    if (!isReady) return;
    if (!user?.is_admin) {
      navigate('/', { replace: true });
    }
  }, [isReady, user, navigate]);

  if (!isReady) {
    return <AuthLoadingScreen />;
  }
  if (!user?.is_admin) {
    return null;
  }

  return (
    <div className="mx-auto w-full max-w-5xl px-3 py-4 sm:px-6 sm:py-6">
      <h1 className="mb-4 text-xl font-bold text-ink">SMS</h1>
      <div className="mb-4 flex gap-1 rounded-sg-sm border border-line bg-surface p-1">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setSearchParams({ tab: tab.id })}
            className={`flex-1 rounded-sg-sm px-3 py-2 text-sm font-medium transition ${
              activeTab === tab.id
                ? 'bg-brand-600 text-white'
                : 'text-ink-muted hover:bg-surface-subtle hover:text-ink'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
      {activeTab === 'settings' ? <SettingsTab /> : <HistoryTab />}
    </div>
  );
}
