import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { apiRequest } from '../../utils/apiClient';
import { MOBILE_PULL_REFRESH_EVENT } from '../../utils/mobileRouteRefresh';

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

function displayName(user) {
  if (!user) return '—';
  if (user.username) return `@${user.username}`;
  return `ID ${user.telegram_id}`;
}

function VpnUserDetailModal({ user, loading, onClose }) {
  if (loading || !user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
        <div className="rounded-2xl bg-white p-8" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[100dvh] sm:max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-none sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">MarzVPN · {displayName(user)}</h2>
            <p className="mt-0.5 font-mono text-xs text-gray-500">{user.telegram_id}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 text-gray-400 hover:bg-gray-100 hover:text-gray-700"
            aria-label="Закрыть"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <InfoCard label="Зарегистрирован" value={formatDateTime(user.created_at)} />
            <InfoCard label="Подписка до" value={formatDateTime(user.expire_at)} />
            <InfoCard label="Осталось" value={user.remaining_label} highlight={user.is_active} />
            <InfoCard label="Пригласил людей" value={String(user.referrals_count)} />
            <InfoCard label="Marzban" value={user.marzban_username} mono />
            <InfoCard
              label="Ключ"
              value={user.key_valid ? 'валиден' : 'проблема'}
              highlight={user.key_valid}
            />
          </div>

          {user.referrer_id && (
            <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700">
              Пришёл по рефералу:{' '}
              <span className="font-medium">
                {user.referrer_username ? `@${user.referrer_username}` : user.referrer_id}
              </span>
            </div>
          )}

          {user.verify_note && (
            <div className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm text-amber-900">
              Проверка: {user.verify_note}
              {user.last_verified_at ? ` · ${formatDateTime(user.last_verified_at)}` : ''}
            </div>
          )}

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">
              Приглашённые ({user.invited?.length || 0})
            </h3>
            {!user.invited?.length ? (
              <p className="text-sm text-gray-500">Пока никого не пригласил</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {user.invited.map((row) => (
                  <li key={row.telegram_id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">
                        {row.username ? `@${row.username}` : row.telegram_id}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(row.created_at)} · +{row.reward_days} дн. рефереру
                      </div>
                    </div>
                    <div className="text-right text-xs text-gray-600">{row.remaining_label}</div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function InfoCard({ label, value, highlight, mono }) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="text-xs font-medium uppercase tracking-wide text-gray-500">{label}</div>
      <div
        className={`mt-1 text-sm font-semibold ${
          highlight === false ? 'text-red-600' : highlight ? 'text-emerald-700' : 'text-gray-900'
        } ${mono ? 'font-mono text-xs break-all' : ''}`}
      >
        {value || '—'}
      </div>
    </div>
  );
}

export default function AdminVpnPage() {
  const navigate = useNavigate();
  const { isReady, user } = useAuthReady();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [detail, setDetail] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest('/admin/vpn/users');
      setUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить пользователей VPN');
      setUsers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!isReady) return;
    if (!user?.is_admin) {
      navigate('/', { replace: true });
      return;
    }
    loadUsers();
  }, [isReady, user, navigate, loadUsers]);

  useEffect(() => {
    const onPullRefresh = (event) => {
      if (event.detail?.pathname === '/admin/vpn') loadUsers();
    };
    window.addEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
    return () => window.removeEventListener(MOBILE_PULL_REFRESH_EVENT, onPullRefresh);
  }, [loadUsers]);

  const openDetail = useCallback(async (telegramId) => {
    setSelectedId(telegramId);
    setDetail(null);
    setDetailLoading(true);
    try {
      const data = await apiRequest(`/admin/vpn/users/${telegramId}`);
      setDetail(data);
    } catch (err) {
      setError(err?.message || 'Не удалось загрузить пользователя');
      setSelectedId(null);
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const uname = (u.username || '').toLowerCase();
      const mid = String(u.telegram_id);
      const mban = (u.marzban_username || '').toLowerCase();
      return uname.includes(q) || mid.includes(q) || mban.includes(q);
    });
  }, [users, searchQuery]);

  if (!isReady) return <AuthLoadingScreen />;

  return (
    <div className="mt-4 sm:mt-5 px-4 sm:px-0">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">VPN</h1>
          <p className="mt-1 text-sm text-gray-500">Пользователи MarzVPN (@marzvpn_bot)</p>
        </div>
        <div className="text-sm text-gray-500">
          Всего: <span className="font-semibold text-gray-900">{users.length}</span>
        </div>
      </div>

      <div className="mb-6 max-w-md">
        <label className="mb-1 block text-sm font-medium text-gray-700">Поиск</label>
        <input
          type="text"
          placeholder="Telegram ID, @username, marzban..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-indigo-500 sm:text-sm"
        />
      </div>

      {error && (
        <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          {error}
          <button type="button" onClick={loadUsers} className="ml-3 text-sm font-medium underline">
            Повторить
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <h2 className="text-xl font-semibold text-gray-900">
            {searchQuery ? 'Ничего не найдено' : 'Нет пользователей VPN'}
          </h2>
        </div>
      ) : (
        <>
          <div className="hidden md:block overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Пользователь</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Telegram ID</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Регистрация</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Подписка</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Пригласил</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase text-gray-600" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {filtered.map((u) => (
                  <tr
                    key={u.telegram_id}
                    className="cursor-pointer hover:bg-gray-50/50"
                    onClick={() => openDetail(u.telegram_id)}
                  >
                    <td className="px-4 py-4">
                      <div className="text-sm font-semibold text-gray-900">{displayName(u)}</div>
                      <div className="font-mono text-xs text-gray-500">{u.marzban_username}</div>
                    </td>
                    <td className="px-4 py-4 font-mono text-sm text-gray-700">{u.telegram_id}</td>
                    <td className="px-4 py-4 text-sm text-gray-600">{formatDateTime(u.created_at)}</td>
                    <td className="px-4 py-4 text-sm">
                      <span className={u.is_active ? 'text-emerald-700 font-medium' : 'text-red-600'}>
                        {u.remaining_label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{u.referrals_count}</td>
                    <td className="px-4 py-4 text-right">
                      <button
                        type="button"
                        className="rounded-lg bg-indigo-50 px-3 py-1.5 text-sm font-medium text-indigo-700 hover:bg-indigo-100"
                        onClick={(e) => {
                          e.stopPropagation();
                          openDetail(u.telegram_id);
                        }}
                      >
                        Открыть
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="md:hidden space-y-3">
            {filtered.map((u) => (
              <button
                key={u.telegram_id}
                type="button"
                onClick={() => openDetail(u.telegram_id)}
                className="w-full rounded-xl border border-gray-200 bg-white p-4 text-left shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-gray-900">{displayName(u)}</div>
                    <div className="mt-0.5 font-mono text-xs text-gray-500">{u.telegram_id}</div>
                  </div>
                  <span className={`text-xs font-medium ${u.is_active ? 'text-emerald-700' : 'text-red-600'}`}>
                    {u.remaining_label}
                  </span>
                </div>
                <div className="mt-3 flex justify-between text-xs text-gray-500">
                  <span>с {formatDateTime(u.created_at)}</span>
                  <span>пригласил: {u.referrals_count}</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      {selectedId != null && (
        <VpnUserDetailModal
          user={detail}
          loading={detailLoading}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
          }}
        />
      )}
    </div>
  );
}
