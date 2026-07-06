import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import { subscribeToPushNotifications } from '../../redux/slices/ChatSlice';

function ToggleRow({ label, description, checked, disabled, onChange }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-indigo-600' : 'bg-gray-200'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

export default function NotificationSettingsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
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
    window.setTimeout(() => setToast(null), 3500);
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
      showToast(error?.message || 'Не удалось загрузить настройки', 'error');
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
      showToast('Настройки сохранены');
    } catch (error) {
      showToast(error?.message || 'Не удалось сохранить', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleEnablePush = async () => {
    setPushSubscribing(true);
    try {
      const result = await dispatch(subscribeToPushNotifications({ prompt: true }));
      if (result?.success) {
        showToast('Push-уведомления включены');
        await loadPreferences();
      } else {
        showToast('Не удалось включить push. Проверьте разрешения браузера.', 'error');
      }
    } finally {
      setPushSubscribing(false);
    }
  };

  if (!user) {
    return (
      <div className="px-4 py-8 text-center text-gray-500">
        <Link to="/auth" className="text-indigo-600 hover:underline">Войдите</Link>, чтобы настроить уведомления.
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-6 sm:px-0">
      <h1 className="text-2xl font-semibold text-gray-900">Уведомления</h1>
      <p className="mt-2 text-sm text-gray-600">
        Управляйте push- и email-уведомлениями о заказах, сообщениях и модерации.
      </p>

      {toast && (
        <div
          className={`mt-4 rounded-lg px-4 py-3 text-sm ${
            toast.type === 'error'
              ? 'bg-red-50 text-red-800 ring-1 ring-red-100'
              : 'bg-emerald-50 text-emerald-800 ring-1 ring-emerald-100'
          }`}
        >
          {toast.message}
        </div>
      )}

      {loading ? (
        <div className="mt-6 animate-pulse space-y-3">
          <div className="h-20 rounded-xl bg-gray-100" />
          <div className="h-20 rounded-xl bg-gray-100" />
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <ToggleRow
            label="Push-уведомления"
            description="Мгновенные уведомления в браузере (PWA)"
            checked={prefs.notify_push_enabled}
            disabled={saving}
            onChange={(value) => savePreference({ notify_push_enabled: value })}
          />

          {!prefs.has_push_subscription && prefs.notify_push_enabled && (
            <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <p className="text-sm text-indigo-900">
                Push ещё не подключён в этом браузере.
              </p>
              <button
                type="button"
                onClick={handleEnablePush}
                disabled={pushSubscribing}
                className="mt-3 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                {pushSubscribing ? 'Подключение…' : 'Включить push-уведомления'}
              </button>
            </div>
          )}

          <ToggleRow
            label="Email-уведомления"
            description="Письма на адрес профиля, если push недоступен или отключён"
            checked={prefs.notify_email_enabled}
            disabled={saving}
            onChange={(value) => savePreference({ notify_email_enabled: value })}
          />

          <p className="text-xs text-gray-500 pt-2">
            Если push отключён — важные уведомления придут на email ({user.email || 'укажите email в профиле'}).
          </p>
        </div>
      )}
    </div>
  );
}
