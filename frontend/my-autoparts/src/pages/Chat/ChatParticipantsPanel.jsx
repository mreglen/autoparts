import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import { getProfilePathForParticipant } from '../../utils/publicProfile';

export default function ChatParticipantsPanel({ chatId, isOpen, onClose }) {
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen || !chatId) return undefined;
    let cancelled = false;
    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiRequest(`/chats/${chatId}/participants`);
        if (!cancelled) {
          setParticipants(Array.isArray(data?.participants) ? data.participants : []);
        }
      } catch (e) {
        if (!cancelled) {
          setParticipants([]);
          setError(typeof e === 'string' ? e : 'Не удалось загрузить участников');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [isOpen, chatId]);

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Участники</h3>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 text-gray-500 hover:bg-gray-100"
          aria-label="Закрыть"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2">
        {loading ? (
          <p className="px-2 py-6 text-center text-sm text-gray-500">Загрузка…</p>
        ) : error ? (
          <p className="px-2 py-6 text-center text-sm text-red-600">{error}</p>
        ) : participants.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-gray-500">Нет участников</p>
        ) : (
          <ul className="space-y-1">
            {participants.map((p) => {
              const profilePath = getProfilePathForParticipant(p);
              const roleLabel = [
                p.is_seller ? 'Продавец' : null,
                p.is_buyer ? 'Покупатель' : null,
              ].filter(Boolean).join(' · ');
              const rowClass =
                'flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-gray-50';
              const inner = (
                <>
                  <UserAvatar
                    avatarUrl={p.avatar_url}
                    firstName={p.display_name}
                    size="sm"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{p.display_name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {roleLabel || 'Участник'}
                      {p.public_code ? ` · ID ${p.public_code}` : ''}
                    </p>
                  </div>
                  {profilePath ? (
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : null}
                </>
              );
              return (
                <li key={p.user_id}>
                  {profilePath ? (
                    <Link to={profilePath} onClick={onClose} className={rowClass}>
                      {inner}
                    </Link>
                  ) : (
                    <div className={`${rowClass} text-gray-700`}>{inner}</div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
