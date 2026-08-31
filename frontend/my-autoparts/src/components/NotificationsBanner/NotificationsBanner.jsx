import { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { Link } from 'react-router-dom';
import { isPwaStandalone } from '../../utils/pwaStandalone';

function isIosSafari() {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const iOS = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  return iOS && !/CriOS|FxiOS|EdgiOS/.test(ua);
}

/**
 * Soft prompt to enable browser push notifications.
 * Must be rendered below the fixed header spacer (not above layouts).
 */
export default function NotificationsBanner({ className = '' }) {
  const { token, user } = useSelector((state) => state.auth);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!token || !user) {
      setVisible(false);
      return;
    }
    if (localStorage.getItem('notifications_banner_dismissed') === '1') {
      setVisible(false);
      return;
    }
    if (!('Notification' in window) || Notification.permission === 'granted') {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [token, user]);

  if (!visible) return null;

  const iosHint = isIosSafari() && !isPwaStandalone();

  return (
    <div className={`px-3 pt-3 sm:px-1 lg:px-2 ${className}`.trim()}>
      <div className="mx-auto max-w-7xl rounded-sg-lg border border-line bg-surface px-3.5 py-3 shadow-sg-sm sm:px-4">
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-brand-600">
            <svg
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth="1.75"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0"
              />
            </svg>
          </div>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-ink">Включите уведомления</p>
            <p className="mt-0.5 text-sm leading-snug text-ink-muted">
              {iosHint
                ? 'На iPhone добавьте сайт на экран «Домой», затем включите push в настройках профиля.'
                : 'Чтобы не пропустить заказы и сообщения в чате.'}
            </p>
            <div className="mt-2.5 flex flex-wrap items-center gap-2">
              <Link
                to="/profile/notifications"
                className="inline-flex min-h-9 items-center justify-center rounded-full bg-brand-600 px-3.5 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2"
              >
                Настроить
              </Link>
              <button
                type="button"
                onClick={() => {
                  localStorage.setItem('notifications_banner_dismissed', '1');
                  setVisible(false);
                }}
                className="inline-flex min-h-9 items-center justify-center rounded-full px-3 text-sm font-medium text-ink-muted transition hover:bg-surface-subtle hover:text-ink"
              >
                Не сейчас
              </button>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              localStorage.setItem('notifications_banner_dismissed', '1');
              setVisible(false);
            }}
            className="-mr-1 -mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-ink-faint transition hover:bg-surface-subtle hover:text-ink-soft"
            aria-label="Закрыть"
          >
            <svg className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
