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

function statusLabel(status) {
  if (status === 'banned') return 'бан';
  if (status === 'disabled') return 'отключён';
  return 'активен';
}

function statusClass(status) {
  if (status === 'banned') return 'bg-red-100 text-red-800';
  if (status === 'disabled') return 'bg-amber-100 text-amber-800';
  return 'bg-emerald-100 text-emerald-800';
}

function paymentStatusClass(status) {
  if (status === 'paid') return 'text-emerald-700';
  if (status === 'failed' || status === 'cancelled') return 'text-red-600';
  if (status === 'refunded') return 'text-amber-700';
  return 'text-gray-600';
}

function ActionButton({ children, onClick, disabled, tone = 'neutral' }) {
  const tones = {
    neutral: 'bg-gray-100 text-gray-800 hover:bg-gray-200',
    primary: 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100',
    danger: 'bg-red-50 text-red-700 hover:bg-red-100',
    warn: 'bg-amber-50 text-amber-800 hover:bg-amber-100',
    success: 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
  };
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-sm font-medium disabled:opacity-50 ${tones[tone] || tones.neutral}`}
    >
      {children}
    </button>
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

function VpnUserDetailModal({
  user,
  loading,
  busy,
  actionError,
  onClose,
  onAction,
  daysInput,
  setDaysInput,
  paymentForm,
  setPaymentForm,
}) {
  if (loading || !user) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose} role="presentation">
        <div className="rounded-2xl bg-white p-8" onClick={(e) => e.stopPropagation()}>
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-b-2 border-indigo-600" />
        </div>
      </div>
    );
  }

  const mz = user.marzban || {};
  const accountStatus = user.account_status || 'active';

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="flex max-h-[100dvh] sm:max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-none sm:rounded-2xl bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between border-b border-gray-100 px-5 py-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">MarzVPN · {displayName(user)}</h2>
            <p className="mt-0.5 font-mono text-xs text-gray-500">{user.telegram_id}</p>
            <span className={`mt-2 inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(accountStatus)}`}>
              {statusLabel(accountStatus)}
            </span>
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

        <div className="overflow-y-auto px-5 py-4 space-y-5">
          {actionError && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {actionError}
            </div>
          )}

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

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Marzban · онлайн / трафик</h3>
            {!mz.available ? (
              <p className="text-sm text-gray-500">
                {mz.error ? `Не удалось получить данные: ${mz.error}` : 'Нет данных из Marzban'}
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InfoCard
                  label="Онлайн"
                  value={mz.is_online ? 'сейчас онлайн' : 'офлайн'}
                  highlight={!!mz.is_online}
                />
                <InfoCard label="Последний онлайн" value={formatDateTime(mz.online_at)} />
                <InfoCard
                  label="Трафик"
                  value={`${mz.used_traffic_label || '—'} / ${mz.data_limit_label || '∞'}`}
                />
                <InfoCard label="Статус Marzban" value={mz.status || '—'} />
                <InfoCard label="За всё время" value={mz.lifetime_used_traffic_label || '—'} />
              </div>
            )}
          </div>

          <div>
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Действия</h3>
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <input
                type="number"
                min={1}
                max={3650}
                value={daysInput}
                onChange={(e) => setDaysInput(e.target.value)}
                className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                aria-label="Дней"
              />
              <ActionButton
                tone="primary"
                disabled={busy}
                onClick={() => onAction('extend', { days: Number(daysInput) })}
              >
                Выдать дни
              </ActionButton>
              {accountStatus === 'disabled' ? (
                <ActionButton tone="success" disabled={busy} onClick={() => onAction('enable')}>
                  Включить
                </ActionButton>
              ) : (
                <ActionButton tone="warn" disabled={busy || accountStatus === 'banned'} onClick={() => onAction('disable')}>
                  Отключить
                </ActionButton>
              )}
              {accountStatus === 'banned' ? (
                <ActionButton tone="success" disabled={busy} onClick={() => onAction('unban')}>
                  Снять бан
                </ActionButton>
              ) : (
                <ActionButton tone="danger" disabled={busy} onClick={() => onAction('ban')}>
                  Забанить
                </ActionButton>
              )}
              <ActionButton
                tone="neutral"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Сбросить ключ? Старая ссылка перестанет работать.')) {
                    onAction('reset-key');
                  }
                }}
              >
                Сброс ключа
              </ActionButton>
              <ActionButton
                tone="neutral"
                disabled={busy}
                onClick={() => {
                  if (window.confirm('Обнулить трафик в Marzban?')) {
                    onAction('reset-traffic');
                  }
                }}
              >
                Сброс трафика
              </ActionButton>
            </div>
          </div>

          {(user.subscription_url || user.crypt4_link) && (
            <div className="space-y-2">
              {user.subscription_url && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Subscription</div>
                  <div className="mt-1 break-all font-mono text-xs text-gray-800">{user.subscription_url}</div>
                </div>
              )}
              {user.crypt4_link && (
                <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                  <div className="text-xs font-medium uppercase tracking-wide text-gray-500">Ключ Happ</div>
                  <div className="mt-1 break-all font-mono text-xs text-gray-800">{user.crypt4_link}</div>
                </div>
              )}
            </div>
          )}

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
            <h3 className="mb-2 text-sm font-semibold text-gray-800">Платежи</h3>
            <div className="mb-3 grid grid-cols-2 sm:grid-cols-4 gap-2">
              <input
                type="number"
                min={0}
                step="1"
                placeholder="₽"
                value={paymentForm.amount_rub}
                onChange={(e) => setPaymentForm((f) => ({ ...f, amount_rub: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <input
                type="number"
                min={0}
                placeholder="дней"
                value={paymentForm.days_granted}
                onChange={(e) => setPaymentForm((f) => ({ ...f, days_granted: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              />
              <select
                value={paymentForm.status}
                onChange={(e) => setPaymentForm((f) => ({ ...f, status: e.target.value }))}
                className="rounded-md border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="paid">paid</option>
                <option value="pending">pending</option>
                <option value="failed">failed</option>
                <option value="refunded">refunded</option>
                <option value="cancelled">cancelled</option>
              </select>
              <ActionButton
                tone="primary"
                disabled={busy}
                onClick={() =>
                  onAction('payment', {
                    amount_rub: Number(paymentForm.amount_rub || 0),
                    days_granted: Number(paymentForm.days_granted || 0),
                    status: paymentForm.status,
                    note: paymentForm.note || undefined,
                    apply_days: true,
                  })
                }
              >
                Записать
              </ActionButton>
            </div>
            <input
              type="text"
              placeholder="Комментарий (необязательно)"
              value={paymentForm.note}
              onChange={(e) => setPaymentForm((f) => ({ ...f, note: e.target.value }))}
              className="mb-3 w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
            />
            {!user.payments?.length ? (
              <p className="text-sm text-gray-500">Платежей пока нет</p>
            ) : (
              <ul className="divide-y divide-gray-100 rounded-xl border border-gray-100">
                {user.payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <div className="font-medium text-gray-900">
                        {Number(p.amount_rub).toLocaleString('ru-RU')} ₽
                        {p.days_granted ? ` · +${p.days_granted} дн.` : ''}
                      </div>
                      <div className="text-xs text-gray-500">
                        {formatDateTime(p.created_at)}
                        {p.note ? ` · ${p.note}` : ''}
                        {p.provider ? ` · ${p.provider}` : ''}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${paymentStatusClass(p.status)}`}>{p.status}</span>
                      {p.status === 'pending' && (
                        <ActionButton
                          tone="success"
                          disabled={busy}
                          onClick={() => onAction('patch-payment', { id: p.id, status: 'paid' })}
                        >
                          paid
                        </ActionButton>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

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
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [daysInput, setDaysInput] = useState('30');
  const [paymentForm, setPaymentForm] = useState({
    amount_rub: '299',
    days_granted: '30',
    status: 'paid',
    note: '',
  });

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
    setActionError(null);
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

  const handleAction = useCallback(
    async (type, payload = {}) => {
      if (!selectedId) return;
      setBusy(true);
      setActionError(null);
      try {
        let data;
        if (type === 'extend') {
          const days = Number(payload.days);
          if (!Number.isFinite(days) || days < 1) {
            throw new Error('Укажите число дней ≥ 1');
          }
          data = await apiRequest(`/admin/vpn/users/${selectedId}/extend`, {
            method: 'POST',
            body: JSON.stringify({ days }),
          });
        } else if (type === 'disable') {
          data = await apiRequest(`/admin/vpn/users/${selectedId}/disable`, { method: 'POST' });
        } else if (type === 'enable') {
          data = await apiRequest(`/admin/vpn/users/${selectedId}/enable`, { method: 'POST' });
        } else if (type === 'ban') {
          data = await apiRequest(`/admin/vpn/users/${selectedId}/ban`, { method: 'POST' });
        } else if (type === 'unban') {
          data = await apiRequest(`/admin/vpn/users/${selectedId}/unban`, { method: 'POST' });
        } else if (type === 'reset-key') {
          data = await apiRequest(`/admin/vpn/users/${selectedId}/reset-key`, { method: 'POST' });
        } else if (type === 'reset-traffic') {
          data = await apiRequest(`/admin/vpn/users/${selectedId}/reset-traffic`, { method: 'POST' });
        } else if (type === 'payment') {
          data = await apiRequest(`/admin/vpn/users/${selectedId}/payments`, {
            method: 'POST',
            body: JSON.stringify(payload),
          });
          setPaymentForm((f) => ({ ...f, note: '' }));
        } else if (type === 'patch-payment') {
          await apiRequest(`/admin/vpn/payments/${payload.id}`, {
            method: 'PATCH',
            body: JSON.stringify({ status: payload.status }),
          });
          data = await apiRequest(`/admin/vpn/users/${selectedId}`);
        } else {
          throw new Error('Неизвестное действие');
        }
        setDetail(data);
        await loadUsers();
      } catch (err) {
        setActionError(err?.message || 'Ошибка действия');
      } finally {
        setBusy(false);
      }
    },
    [selectedId, loadUsers]
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return users;
    return users.filter((u) => {
      const uname = (u.username || '').toLowerCase();
      const mid = String(u.telegram_id);
      const mban = (u.marzban_username || '').toLowerCase();
      const st = (u.account_status || '').toLowerCase();
      return uname.includes(q) || mid.includes(q) || mban.includes(q) || st.includes(q);
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
          placeholder="Telegram ID, @username, marzban, статус..."
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
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Статус</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Подписка</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase text-gray-600">Платежи</th>
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
                      <div className="font-mono text-xs text-gray-500">{u.telegram_id}</div>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${statusClass(u.account_status)}`}>
                        {statusLabel(u.account_status)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm">
                      <span className={u.is_active ? 'text-emerald-700 font-medium' : 'text-red-600'}>
                        {u.remaining_label}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-sm text-gray-700">{u.payments_paid_count || 0}</td>
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
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(u.account_status)}`}>
                    {statusLabel(u.account_status)}
                  </span>
                </div>
                <div className="mt-3 flex justify-between text-xs text-gray-500">
                  <span className={u.is_active ? 'text-emerald-700' : 'text-red-600'}>{u.remaining_label}</span>
                  <span>платежей: {u.payments_paid_count || 0}</span>
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
          busy={busy}
          actionError={actionError}
          daysInput={daysInput}
          setDaysInput={setDaysInput}
          paymentForm={paymentForm}
          setPaymentForm={setPaymentForm}
          onAction={handleAction}
          onClose={() => {
            setSelectedId(null);
            setDetail(null);
            setActionError(null);
          }}
        />
      )}
    </div>
  );
}
