import React, { useEffect, useMemo, useState } from 'react';
import { useDispatch } from 'react-redux';
import { createCustomGroupChat, fetchManageableUsers } from '../../redux/slices/ChatSlice';

export default function CreateGroupChatModal({ isOpen, onClose, onCreated, user }) {
  const dispatch = useDispatch();
  const [title, setTitle] = useState('');
  const [search, setSearch] = useState('');
  const [users, setUsers] = useState([]);
  const [selected, setSelected] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isAdmin = Boolean(user?.is_admin);

  useEffect(() => {
    if (!isOpen) return undefined;
    setTitle('');
    setSearch('');
    setSelected([]);
    setError(null);
    return undefined;
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return undefined;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const data = await dispatch(fetchManageableUsers({ q: search, limit: 40 })).unwrap();
        if (!cancelled) setUsers(Array.isArray(data) ? data : []);
      } catch {
        if (!cancelled) setUsers([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }, 280);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [isOpen, search, dispatch]);

  const selectedIds = useMemo(() => new Set(selected.map((u) => u.user_id)), [selected]);

  const toggleUser = (u) => {
    if (u.user_id === user?.id) return;
    setSelected((prev) => {
      if (prev.some((x) => x.user_id === u.user_id)) {
        return prev.filter((x) => x.user_id !== u.user_id);
      }
      return [...prev, u];
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim()) {
      setError('Введите название чата');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const chat = await dispatch(
        createCustomGroupChat({
          title: title.trim(),
          participantIds: selected.map((u) => u.user_id),
          organizationId: isAdmin ? user?.organization_id : undefined,
        })
      ).unwrap();
      onCreated?.(chat);
      onClose();
    } catch (err) {
      setError(typeof err === 'string' ? err : 'Не удалось создать чат');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b border-gray-100 px-5 py-4">
          <h2 className="text-lg font-semibold text-gray-900">Новый чат</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-2 text-gray-500 hover:bg-gray-100">
            ✕
          </button>
        </div>
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="space-y-4 overflow-y-auto px-5 py-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Название</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Например: Отдел продаж"
                className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-500/20"
                maxLength={255}
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Участники {isAdmin ? '(любые пользователи)' : '(сотрудники организации)'}
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Поиск по имени, email, ID"
                className="mb-2 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm outline-none focus:border-indigo-400"
              />
              {selected.length > 0 ? (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {selected.map((u) => (
                    <button
                      key={u.user_id}
                      type="button"
                      onClick={() => toggleUser(u)}
                      className="rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700"
                    >
                      {u.display_name} ×
                    </button>
                  ))}
                </div>
              ) : null}
              <div className="max-h-48 overflow-y-auto rounded-xl border border-gray-100">
                {loading ? (
                  <p className="px-3 py-4 text-center text-sm text-gray-500">Поиск…</p>
                ) : users.length === 0 ? (
                  <p className="px-3 py-4 text-center text-sm text-gray-500">Никого не найдено</p>
                ) : (
                  <ul>
                    {users.map((u) => {
                      const picked = selectedIds.has(u.user_id);
                      const isSelf = u.user_id === user?.id;
                      return (
                        <li key={u.user_id}>
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => toggleUser(u)}
                            className={`flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition ${
                              isSelf ? 'cursor-not-allowed opacity-50' : 'hover:bg-gray-50'
                            } ${picked ? 'bg-indigo-50/80' : ''}`}
                          >
                            <span className="font-medium text-gray-900">{u.display_name}</span>
                            <span className="text-xs text-gray-500">{u.public_code || ''}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
            {error ? <p className="text-sm text-red-600">{error}</p> : null}
          </div>
          <div className="flex gap-2 border-t border-gray-100 px-5 py-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
            >
              {submitting ? 'Создание…' : 'Создать'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
