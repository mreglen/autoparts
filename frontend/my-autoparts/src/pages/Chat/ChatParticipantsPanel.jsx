import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
import { apiRequest } from '../../utils/apiClient';
import UserAvatar from '../../components/UserAvatar/UserAvatar';
import { getProfilePathForParticipant } from '../../utils/publicProfile';
import {
  addChatParticipant,
  fetchManageableUsers,
  removeChatParticipant,
} from '../../redux/slices/ChatSlice';

export default function ChatParticipantsPanel({
  chatId,
  isOpen,
  onClose,
  canManage = false,
  onChanged,
}) {
  const dispatch = useDispatch();
  const [loading, setLoading] = useState(false);
  const [participants, setParticipants] = useState([]);
  const [error, setError] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const loadParticipants = useCallback(async () => {
    if (!chatId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest(`/chats/${chatId}/participants`);
      setParticipants(Array.isArray(data?.participants) ? data.participants : []);
    } catch (e) {
      setParticipants([]);
      setError(typeof e === 'string' ? e : 'Не удалось загрузить участников');
    } finally {
      setLoading(false);
    }
  }, [chatId]);

  useEffect(() => {
    if (!isOpen || !chatId) return undefined;
    loadParticipants();
    return undefined;
  }, [isOpen, chatId, loadParticipants]);

  useEffect(() => {
    if (!addOpen || !canManage) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const data = await dispatch(
          fetchManageableUsers({ q: search, chatId, limit: 30 })
        ).unwrap();
        if (!cancelled) {
          const existing = new Set(participants.map((p) => p.user_id));
          setCandidates((Array.isArray(data) ? data : []).filter((u) => !existing.has(u.user_id)));
        }
      } catch {
        if (!cancelled) setCandidates([]);
      } finally {
        if (!cancelled) setSearchLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [addOpen, search, chatId, canManage, participants, dispatch]);

  const handleAdd = async (userId) => {
    setActionLoading(true);
    try {
      await dispatch(addChatParticipant({ chatId, userId })).unwrap();
      setAddOpen(false);
      setSearch('');
      await loadParticipants();
      onChanged?.();
    } catch (e) {
      alert(typeof e === 'string' ? e : 'Не удалось добавить');
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemove = async (userId) => {
    if (!window.confirm('Удалить участника из чата?')) return;
    setActionLoading(true);
    try {
      await dispatch(removeChatParticipant({ chatId, userId })).unwrap();
      await loadParticipants();
      onChanged?.();
    } catch (e) {
      alert(typeof e === 'string' ? e : 'Не удалось удалить');
    } finally {
      setActionLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="absolute inset-0 z-20 flex flex-col bg-white">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Участники</h3>
        <div className="flex items-center gap-1">
          {canManage ? (
            <button
              type="button"
              onClick={() => setAddOpen((v) => !v)}
              className="rounded-lg px-2.5 py-1.5 text-xs font-medium text-indigo-600 hover:bg-indigo-50"
            >
              {addOpen ? 'Закрыть' : '+ Добавить'}
            </button>
          ) : null}
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
      </div>

      {addOpen && canManage ? (
        <div className="border-b border-gray-100 bg-gray-50 px-3 py-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Найти пользователя…"
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
          />
          <div className="mt-2 max-h-36 overflow-y-auto rounded-lg border border-gray-100 bg-white">
            {searchLoading ? (
              <p className="px-2 py-3 text-center text-xs text-gray-500">Поиск…</p>
            ) : candidates.length === 0 ? (
              <p className="px-2 py-3 text-center text-xs text-gray-500">Нет результатов</p>
            ) : (
              <ul>
                {candidates.map((u) => (
                  <li key={u.user_id}>
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={() => handleAdd(u.user_id)}
                      className="flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-indigo-50 disabled:opacity-50"
                    >
                      <span className="font-medium text-gray-900">{u.display_name}</span>
                      <span className="text-xs text-indigo-600">Добавить</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      ) : null}

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
              const inner = (
                <>
                  <UserAvatar avatarUrl={p.avatar_url} firstName={p.display_name} size="sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-gray-900">{p.display_name}</p>
                    <p className="truncate text-xs text-gray-500">
                      {roleLabel || 'Участник'}
                      {p.public_code ? ` · ID ${p.public_code}` : ''}
                    </p>
                  </div>
                  {canManage ? (
                    <button
                      type="button"
                      disabled={actionLoading}
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleRemove(p.user_id);
                      }}
                      className="shrink-0 rounded-lg px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      Убрать
                    </button>
                  ) : profilePath ? (
                    <svg className="h-4 w-4 shrink-0 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  ) : null}
                </>
              );
              return (
                <li key={p.user_id}>
                  {profilePath && !canManage ? (
                    <Link
                      to={profilePath}
                      onClick={onClose}
                      className="flex items-center gap-3 rounded-xl px-2 py-2.5 transition hover:bg-gray-50"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <div className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-gray-700">
                      {profilePath ? (
                        <Link to={profilePath} onClick={onClose} className="flex min-w-0 flex-1 items-center gap-3">
                          <UserAvatar avatarUrl={p.avatar_url} firstName={p.display_name} size="sm" />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-gray-900">{p.display_name}</p>
                            <p className="truncate text-xs text-gray-500">
                              {roleLabel || 'Участник'}
                              {p.public_code ? ` · ID ${p.public_code}` : ''}
                            </p>
                          </div>
                        </Link>
                      ) : (
                        inner
                      )}
                    </div>
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
