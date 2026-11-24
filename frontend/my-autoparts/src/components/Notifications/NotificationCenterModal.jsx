import React, { useEffect } from 'react';
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
} from '../../redux/slices/NotificationSlice';
import { BellIcon } from './NotificationBellButton';

const POLL_INTERVAL_MS = 60000;

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
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    );
  }
  if (MESSAGE_EVENTS.has(eventType)) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
    );
  }
  if (ORDER_EVENTS.has(eventType)) {
    return (
      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden>
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
      </svg>
    );
  }
  return <BellIcon />;
}

function formatNotificationTime(value) {
  const date = parseServerDate(value);
  if (!date) return '';
  const diffMs = Date.now() - date.getTime();
  if (diffMs < 60_000) return 'только что';
  if (diffMs < 3_600_000) return `${Math.max(1, Math.floor(diffMs / 60_000))} мин назад`;
  if (diffMs < 86_400_000) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
  }
  return date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
}

export default function NotificationCenterModal() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { token, user } = useSelector((state) => state.auth);
  const { modalOpen, items, unreadCount, status } = useSelector((state) => state.notifications);

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

  return (
    <Modal
      open={modalOpen}
      onClose={() => dispatch(closeNotificationCenter())}
      title="Уведомления"
      size="lg"
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
        <ul className="divide-y divide-line">
          {items.map((notification) => (
            <li key={notification.id}>
              <button
                type="button"
                onClick={() => handleItemClick(notification)}
                className="flex w-full items-start gap-3 px-1 py-3 text-left transition hover:bg-surface-subtle"
              >
                <span
                  className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-sg ${
                    notification.is_read
                      ? 'bg-surface-muted text-ink-faint'
                      : 'bg-brand-50 text-brand-600'
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
  );
}
