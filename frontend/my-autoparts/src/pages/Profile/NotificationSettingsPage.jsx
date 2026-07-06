import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import { subscribeToPushNotifications } from '../../redux/slices/ChatSlice';
import { useAuthReady } from '../../hooks/useAuthReady';
import {
  ProfileBlock,
  profilePageShell,
  profilePrimaryBtn,
} from './profileUi';

function IconPush() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
    </svg>
  );
}

function IconEmail() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function Switch({ checked, disabled, onChange, label }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
        checked ? 'bg-indigo-600' : 'bg-gray-200'
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow transition ${
          checked ? 'translate-x-5' : 'translate-x-0'
        }`}
      />
    </button>
  );
}

function ChannelRow({ icon, label, hint, checked, disabled, onChange }) {
  return (
    <div className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5 last:border-b-0">
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-indigo-600">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-medium text-gray-900">{label}</p>
        {hint ? <p className="mt-0.5 truncate text-xs text-gray-400">{hint}</p> : null}
      </div>
      <Switch checked={checked} disabled={disabled} onChange={onChange} label={label} />
    </div>
  );
}

function NotificationsSkeleton() {
  return (
    <div className={`${profilePageShell} animate-pulse`}>
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {[1, 2].map((i) => (
          <div key={i} className="flex items-center gap-3 border-b border-gray-100 px-4 py-3.5 last:border-b-0">
            <div className="h-10 w-10 rounded-xl bg-gray-100" />
            <div className="flex-1 space-y-2">
              <div className="h-4 w-24 rounded bg-gray-100" />
              <div className="h-3 w-32 rounded bg-gray-50" />
            </div>
            <div className="h-7 w-12 rounded-full bg-gray-100" />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const dispatch = useDispatch();
  const { user, isReady } = useAuthReady();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pushSubscribing, setPushSubscribing] = useState(false);
  const [prefs, setPrefs] = useState({
    notify_push_enabled: true,
    notify_email_enabled: true,
    has_push_subscription: false,
  });
  const [toast, setToast] = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const loadPreferences = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest('/notifications/preferences');
      setPrefs({
        notify_push_enabled: data.notify_push_enabled !== false,
        notify_email_enabled: data.notify_email_enabled !== false,
        has_push_subscription: Boolean(data.has_push_subscription),
      });
    } catch (error) {
      showToast(error?.message || 'Ошибка загрузки', 'error');
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    if (user) loadPreferences();
  }, [user, loadPreferences]);

  const savePreference = async (patch) => {
    setSaving(true);
    try {
      const data = await apiRequest('/notifications/preferences', {
        method: 'PATCH',
        body: JSON.stringify(patch),
      });
      setPrefs({
        notify_push_enabled: data.notify_push_enabled !== false,
        notify_email_enabled: data.notify_email_enabled !== false,
        has_push_subscription: Boolean(data.has_push_subscription),
      });
      showToast('Сохранено');
    } catch (error) {
      showToast(error?.message || 'Ошибка', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    setPushSubscribing(true);
    try {
      const result = await dispatch(subscribeToPushNotifications({ prompt: true }));
      if (result?.success) {
        showToast('Push подключён');
        await loadPreferences();
      } else {
        showToast('Разрешите уведомления в браузере', 'error');
      }
    } finally {
      setPushSubscribing(false);
    }
  };

  if (!isReady) {
    return <NotificationsSkeleton />;
  }

  if (!user) {
    return (
      <div className={profilePageShell}>
        <ProfileBlock>
          <div className="px-4 py-10 text-center">
            <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-600">
              <IconPush />
            </span>
            <p className="text-[15px] text-gray-900">Войдите в аккаунт</p>
            <Link to="/auth" className={`${profilePrimaryBtn} mt-4`}>
              Войти
            </Link>
          </div>
        </ProfileBlock>
      </div>
    );
  }

  if (loading) {
    return <NotificationsSkeleton />;
  }

  const pushHint = prefs.notify_push_enabled
    ? (prefs.has_push_subscription ? 'Подключено' : 'Нужно подключить')
    : 'Выключено';
  const emailHint = user.email || null;

  const needsPushSetup = prefs.notify_push_enabled && !prefs.has_push_subscription;

  return (
    <div className={profilePageShell}>
      <ProfileBlock>
        <ChannelRow
          icon={<IconPush />}
          label="Push"
          hint={pushHint}
          checked={prefs.notify_push_enabled}
          disabled={saving}
          onChange={(value) => savePreference({ notify_push_enabled: value })}
        />
        <ChannelRow
          icon={<IconEmail />}
          label="Email"
          hint={emailHint}
          checked={prefs.notify_email_enabled}
          disabled={saving}
          onChange={(value) => savePreference({ notify_email_enabled: value })}
        />
      </ProfileBlock>

      {needsPushSetup ? (
        <ProfileBlock>
          <div className="flex flex-col items-stretch gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-600">Разрешите уведомления в этом браузере</p>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={pushSubscribing}
              className={`${profilePrimaryBtn} w-full sm:w-auto`}
            >
              {pushSubscribing ? '…' : 'Подключить'}
            </button>
          </div>
        </ProfileBlock>
      ) : null}

      {toast ? (
        <div
          className={`fixed bottom-20 left-1/2 z-50 max-w-sm -translate-x-1/2 rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg ring-1 sm:bottom-8 ${
            toast.type === 'error'
              ? 'bg-red-600 text-white ring-red-500/30'
              : 'bg-gray-900 text-white ring-gray-700/50'
          }`}
          role="status"
        >
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}
