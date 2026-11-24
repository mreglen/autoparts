import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { apiRequest } from '../../utils/apiClient';
import { openAutoserviceClientChat } from '../../redux/slices/ChatSlice';

const BOOKING_STATUS_LABELS = {
  new: 'Новая',
  confirmed: 'Подтверждена',
  in_progress: 'В работе',
  done: 'Выполнена',
  cancelled: 'Отменена',
  review: 'На проверке',
  pending: 'Ожидает',
};

const ORDER_STATUS_LABELS = {
  pending: 'Ожидание',
  in_progress: 'В работе',
  done: 'Выполнен',
  completed: 'Закрыт',
  cancelled: 'Отменён',
  review: 'На проверке',
};

function formatBookingDate(booking) {
  if (!booking?.preferred_date) return '';
  const date = new Date(`${booking.preferred_date}T00:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  const label = date.toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' });
  return booking.preferred_time ? `${label} ${String(booking.preferred_time).slice(0, 5)}` : label;
}

export default function AutoserviceNewClientChatModal({ isOpen, onClose, onCreated }) {
  const dispatch = useDispatch();
  const [search, setSearch] = useState('');
  const [clients, setClients] = useState([]);
  const [loadingClients, setLoadingClients] = useState(false);
  const [selectedClient, setSelectedClient] = useState(null);
  const [topics, setTopics] = useState(null);
  const [loadingTopics, setLoadingTopics] = useState(false);
  const [topic, setTopic] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return undefined;
    setSearch('');
    setClients([]);
    setSelectedClient(null);
    setTopics(null);
    setTopic(null);
    setError(null);
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen || selectedClient) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoadingClients(true);
      try {
        const data = await apiRequest(`/autoservice/chats/clients?q=${encodeURIComponent(search)}&limit=50`);
        if (!cancelled) setClients(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setClients([]);
      } finally {
        if (!cancelled) setLoadingClients(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, search, selectedClient]);

  useEffect(() => {
    if (!selectedClient) return undefined;
    let cancelled = false;
    setLoadingTopics(true);
    setTopics(null);
    setTopic({ type: 'general' });
    apiRequest(`/autoservice/chats/clients/${selectedClient.id}/topics`)
      .then((data) => {
        if (!cancelled) setTopics(data);
      })
      .catch(() => {
        if (!cancelled) setError('Не удалось загрузить записи и заказы клиента');
      })
      .finally(() => {
        if (!cancelled) setLoadingTopics(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedClient]);

  const handleOpen = async () => {
    if (!topic || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const chat = await dispatch(
        openAutoserviceClientChat({
          clientId: selectedClient?.id,
          bookingId: topic.type === 'booking' ? topic.id : null,
          repairOrderId: topic.type === 'order' ? topic.id : null,
        })
      ).unwrap();
      onCreated?.(chat);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Не удалось открыть чат');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const topicButtonClass = (active) =>
    `flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left text-sm transition ${
      active
        ? 'border-brand-300 bg-brand-50/80'
        : 'border-gray-100 hover:bg-gray-50'
    }`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">
            {selectedClient ? `Чат с ${selectedClient.name}` : 'Написать клиенту'}
          </h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100" aria-label="Закрыть">
            ✕
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col">
          {!selectedClient ? (
            <>
              <div className="border-b border-gray-100 px-5 py-3">
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Поиск клиента по имени или телефону"
                  className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-brand-400 focus:ring-2 focus:ring-brand-500/20"
                  autoFocus
                />
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
                {loadingClients ? (
                  <p className="px-3 py-6 text-center text-sm text-gray-500">Поиск…</p>
                ) : clients.length === 0 ? (
                  <p className="px-3 py-6 text-center text-sm text-gray-500">Клиенты не найдены</p>
                ) : (
                  <ul>
                    {clients.map((c) => {
                      const hasAccount = Boolean(c.user_id);
                      return (
                        <li key={c.id}>
                          <button
                            type="button"
                            disabled={!hasAccount}
                            onClick={() => setSelectedClient(c)}
                            className={`flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-left transition ${
                              hasAccount ? 'hover:bg-gray-50' : 'cursor-not-allowed opacity-60'
                            }`}
                          >
                            <span className="min-w-0">
                              <span className="block truncate text-sm font-medium text-gray-900">{c.name}</span>
                              <span className="block truncate text-xs text-gray-500">{c.phone}</span>
                            </span>
                            {!hasAccount ? (
                              <span className="flex-shrink-0 text-xs text-gray-400">нет аккаунта</span>
                            ) : null}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Тема переписки</p>
                  <button
                    type="button"
                    onClick={() => setTopic({ type: 'general' })}
                    className={topicButtonClass(topic?.type === 'general')}
                  >
                    <span className="font-medium text-gray-900">Общая переписка</span>
                    <span className="text-xs text-gray-400">без привязки к заказу</span>
                  </button>
                </div>

                {loadingTopics ? (
                  <p className="py-4 text-center text-sm text-gray-500">Загрузка…</p>
                ) : topics ? (
                  <>
                    {topics.bookings?.length ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Записи на осмотр
                        </p>
                        <div className="space-y-1.5">
                          {topics.bookings.map((b) => {
                            const active = topic?.type === 'booking' && topic.id === b.id;
                            return (
                              <button
                                key={`b-${b.id}`}
                                type="button"
                                onClick={() => setTopic({ type: 'booking', id: b.id })}
                                className={topicButtonClass(active)}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-gray-900">
                                    Запись №{b.id} · {formatBookingDate(b)}
                                  </span>
                                  <span className="block truncate text-xs text-gray-500">
                                    {[b.vehicle_label, BOOKING_STATUS_LABELS[b.status] || b.status]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}

                    {topics.orders?.length ? (
                      <div>
                        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                          Заказ-наряды
                        </p>
                        <div className="space-y-1.5">
                          {topics.orders.map((o) => {
                            const active = topic?.type === 'order' && topic.id === o.id;
                            const number = o.order_number || `№${o.id}`;
                            return (
                              <button
                                key={`o-${o.id}`}
                                type="button"
                                onClick={() => setTopic({ type: 'order', id: o.id })}
                                className={topicButtonClass(active)}
                              >
                                <span className="min-w-0">
                                  <span className="block truncate text-sm font-medium text-gray-900">
                                    Заказ-наряд №{number}
                                  </span>
                                  <span className="block truncate text-xs text-gray-500">
                                    {[o.vehicle_label, ORDER_STATUS_LABELS[o.status] || o.status]
                                      .filter(Boolean)
                                      .join(' · ')}
                                  </span>
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : null}

                {error ? <p className="text-sm text-red-600">{error}</p> : null}
              </div>
              <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  className="rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Назад
                </button>
                <button
                  type="button"
                  onClick={handleOpen}
                  disabled={!topic || submitting}
                  className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                >
                  {submitting ? 'Открытие…' : 'Открыть чат'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
