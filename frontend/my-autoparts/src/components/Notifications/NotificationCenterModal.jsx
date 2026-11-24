import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import Modal from '../UI/Modal';
import Button from '../UI/Button';
import { parseServerDate } from '../../utils/serverDate';
import { resolveNotificationUrl } from '../../utils/notificationLink';
import {
  closeNotificationCenter,
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  openNotificationCenter,
} from '../../redux/slices/NotificationSlice';
import { BellIcon } from './NotificationBellButton';

const POLL_INTERVAL_MS = 20000;
const TOAST_DURATION_MS = 6000;

const ORDER_EVENTS = new Set(['new_order_seller', 'order_status_buyer', 'return_request_seller', 'return_status_buyer']);
const MESSAGE_EVENTS = new Set(['chat_message', 'avito_messenger']);
const AUTOSERVICE_EVENTS = new Set([
  'autoservice_planner_daily',
  'autoservice_new_inspection',
  'autoservice_booking_accepted',
  'autoservice_booking_confirmed',
  'autoservice_booking_cancelled',
  'autoservice_booking_reminder',
  'autoservice_booking_cancelled_staff',
  'autoservice_application_reviewed',
  'repair_order_status_changed',
]);

function notificationIcon(eventType) {
  if (AUTOSERVICE_EVENTS.has(eventType)) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  if (MESSAGE_EVENTS.has(eventType)) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (ORDER_EVENTS.has(eventType)) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    );
  }
  return <BellIcon className="h-4 w-4" />;
}

function pluralRu(n, forms) {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return forms[1];
  return forms[2];
}

function formatNotificationTime(value) {
  const date = parseServerDate(value);
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'только что';
  if (diffMs < 3_600_000) {
    const mins = Math.floor(diffMs / 60_000);
    return `${mins} ${pluralRu(mins, ['минуту', 'минуты', 'минут'])} назад`;
  }
  if (diffMs < 86_400_000) {
    const hours = Math.floor(diffMs / 3_600_000);
    return `${hours} ${pluralRu(hours, ['час', 'часа', 'часов'])} назад`;
  }
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  if (date.getTime() >= startOfToday.getTime() - 86_400_000) {
    return 'вчера';
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function sortedNotifications(items) {
  return [...items].sort((a, b) => {
    const da = parseServerDate(a.created_at)?.getTime() || 0;
    const db = parseServerDate(b.created_at)?.getTime() || 0;
    return db - da;
  });
}

export default function NotificationCenterModal() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, user } = useSelector((state) => state.auth);
  const { modalOpen, items, unreadCount, status } = useSelector((state) => state.notifications);
  const [toast, setToast] = useState(null);
  const seenIdsRef = useRef(null);
  const toastTimerRef = useRef(null);

  useEffect(() => {
    if (!token || !user) return undefined;
    dispatch(fetchNotifications());
    const timer = window.setInterval(() => dispatch(fetchNotifications()), POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [dispatch, token, user]);

  useEffect(() => {
    if (modalOpen) dispatch(fetchNotifications());
  }, [dispatch, modalOpen]);

  useEffect(() => {
    if (!token || !user) {
      dispatch(closeNotificationCenter());
    }
  }, [dispatch, token, user]);

  useEffect(() => {
    if (seenIdsRef.current === null) {
      seenIdsRef.current = new Set(items.map((item) => item.id));
      return;
    }
    const fresh = sortedNotifications(items).filter((item) => !seenIdsRef.current.has(item.id));
    items.forEach((item) => seenIdsRef.current.add(item.id));
    if (fresh.length > 0 && !modalOpen) {
      setToast(fresh[0]);
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => setToast(null), TOAST_DURATION_MS);
    }
  }, [items, modalOpen]);

  useEffect(() => () => window.clearTimeout(toastTimerRef.current), []);

  if (!token || !user) return null;

  const handleItemClick = (notification) => {
    if (!notification.is_read) {
      dispatch(markNotificationRead(notification.id));
    }
    const url = resolveNotificationUrl(notification);
    if (url) {
      dispatch(closeNotificationCenter());
      navigate(url);
    }
  };

  const handleToastClick = () => {
    setToast(null);
    dispatch(openNotificationCenter());
  };

  return (
    <>
      {toast ? (
        <button
          type="button"
          onClick={handleToastClick}
          className="fixed left-4 top-4 z-[90] flex max-w-sm items-start gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-left shadow-sg-lg transition hover:bg-surface-subtle"
        >
          <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600">
            {notificationIcon(toast.event_type)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-semibold text-ink">{toast.title}</span>
            <span className="block text-xs text-ink-muted">Новое уведомление</span>
          </span>
        </button>
      ) : null}

      <Modal
        open={modalOpen}
        onClose={() => dispatch(closeNotificationCenter())}
        title="Уведомления"
        size="lg"
        className="sm:h-[560px]"
        headerActions={unreadCount > 0 ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => dispatch(markAllNotificationsRead())}
          >
            Прочитать все
          </Button>
        ) : null}
      >
        {status === 'loading' && items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Загрузка…</p>
        ) : items.length === 0 ? (
          <p className="py-8 text-center text-sm text-ink-muted">Нет уведомлений</p>
        ) : (
          <ul className="-mx-1 divide-y divide-line-soft">
            {sortedNotifications(items).map((notification) => (
              <li key={notification.id}>
                <button
                  type="button"
                  onClick={() => handleItemClick(notification)}
                  className={`flex w-full items-start gap-3 rounded-lg px-2 py-3 text-left transition ${
                    notification.is_read ? 'hover:bg-surface-subtle' : 'bg-brand-50/40 hover:bg-brand-50/70'
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      notification.is_read
                        ? 'bg-surface-muted text-ink-faint'
                        : 'bg-brand-100 text-brand-700'
                    }`}
                  >
                    {notificationIcon(notification.event_type)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-3">
                      <span
                        className={`truncate text-sm ${
                          notification.is_read ? 'font-medium text-ink-soft' : 'font-semibold text-ink'
                        }`}
                      >
                        {notification.title}
                      </span>
                      <span className="shrink-0 text-[11px] text-ink-faint">
                        {formatNotificationTime(notification.created_at)}
                      </span>
                    </span>
                    {notification.body ? (
                      <span className="mt-0.5 line-clamp-2 block text-xs text-ink-muted">
                        {notification.body}
                      </span>
                    ) : null}
                  </span>
                  {!notification.is_read ? (
                    <span className="mt-2 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Непрочитано" />
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Modal>
    </>
  );
}
