import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  clearNotificationHistory,
  readNotificationHistory,
} from '../../utils/notificationHistory';
import { useAuthReady } from '../../hooks/useAuthReady';
import {
  ProfileBlock,
  profilePageShell,
  profilePrimaryBtn,
} from './profileUi';

function formatWhen(at) {
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return '';
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  if (date >= startOfToday) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function NotificationCenterPage() {
  const navigate = useNavigate();
  const { user, isReady } = useAuthReady();
  const [items, setItems] = useState([]);

  const reload = useCallback(() => {
    setItems(readNotificationHistory());
  }, []);

  useEffect(() => {
    reload();
    const onUpdate = () => reload();
    window.addEventListener('notificationHistoryUpdated', onUpdate);
    return () => window.removeEventListener('notificationHistoryUpdated', onUpdate);
  }, [reload]);

  if (!isReady) {
    return (
      <div className={`${profilePageShell} animate-pulse`}>
        <div className="h-40 rounded-xl bg-gray-100" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className={profilePageShell}>
        <ProfileBlock>
          <div className="px-4 py-10 text-center">
            <p className="text-[15px] text-gray-900">Войдите в аккаунт</p>
            <Link to="/auth" className={`${profilePrimaryBtn} mt-4`}>
              Войти
            </Link>
          </div>
        </ProfileBlock>
      </div>
    );
  }

  return (
    <div className={profilePageShell}>
      <ProfileBlock>
        <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5">
          <div>
            <p className="text-[15px] font-medium text-gray-900">История уведомлений</p>
            <p className="mt-0.5 text-xs text-gray-400">Последние push на этом устройстве</p>
          </div>
          {items.length > 0 ? (
            <button
              type="button"
              onClick={() => {
                clearNotificationHistory();
                reload();
              }}
              className="shrink-0 text-sm font-medium text-gray-500 hover:text-gray-800"
            >
              Очистить
            </button>
          ) : null}
        </div>

        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-500">
            Пока нет сохранённых уведомлений
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  onClick={() => {
                    if (item.url) navigate(item.url);
                  }}
                  className="w-full px-4 py-3.5 text-left transition-colors hover:bg-gray-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-[15px] font-medium text-gray-900">{item.title}</p>
                      {item.body ? (
                        <p className="mt-0.5 line-clamp-2 text-sm text-gray-600">{item.body}</p>
                      ) : null}
                    </div>
                    <span className="shrink-0 text-[11px] text-gray-400">{formatWhen(item.at)}</span>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </ProfileBlock>

      <p className="mt-4 px-1 text-xs text-gray-400">
        Настройки категорий — в{' '}
        <Link to="/profile/notifications" className="text-brand-600 hover:underline">
          уведомлениях профиля
        </Link>
        .
      </p>
    </div>
  );
}
