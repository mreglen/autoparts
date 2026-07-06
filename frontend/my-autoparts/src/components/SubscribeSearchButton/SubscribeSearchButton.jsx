import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { fetchSearchSubscriptions, subscribeToSearch } from '../../redux/slices/UserEngagementSlice';

export default function SubscribeSearchButton({
  query,
  className = '',
  variant = 'primary',
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useSelector((state) => state.auth.user);
  const loading = useSelector((state) => state.userEngagement?.subscriptionActionLoading);
  const subscriptions = useSelector((state) => state.userEngagement?.subscriptions || []);
  const [notice, setNotice] = useState('');

  const normalizedQuery = useMemo(() => (query || '').trim(), [query]);

  useEffect(() => {
    if (!user) return;
    dispatch(fetchSearchSubscriptions());
  }, [dispatch, user]);

  const alreadySubscribed = useMemo(() => {
    const norm = normalizedQuery.toLowerCase();
    return subscriptions.some(
      (item) => (item.query_text || '').trim().toLowerCase() === norm,
    );
  }, [subscriptions, normalizedQuery]);

  const handleClick = useCallback(async () => {
    if (!normalizedQuery || normalizedQuery.length < 2) return;
    if (!user) {
      navigate('/auth', { state: { from: location.pathname + location.search } });
      return;
    }
    const result = await dispatch(subscribeToSearch(normalizedQuery));
    if (subscribeToSearch.fulfilled.match(result)) {
      setNotice('Подписка оформлена. Мы сообщим, когда появится запчасть.');
      window.setTimeout(() => setNotice(''), 3500);
    } else {
      setNotice(result.payload || 'Не удалось оформить подписку');
      window.setTimeout(() => setNotice(''), 3500);
    }
  }, [dispatch, user, normalizedQuery, navigate, location]);

  if (!normalizedQuery) return null;

  const buttonClass = variant === 'secondary'
    ? 'border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
    : 'bg-indigo-600 text-white hover:bg-indigo-700';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || alreadySubscribed}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`}
      >
        {alreadySubscribed ? 'Вы подписаны на этот поиск' : 'Подписаться на этот поиск'}
      </button>
      {notice ? (
        <p className="mt-2 text-sm text-gray-600">{notice}</p>
      ) : null}
      {!alreadySubscribed ? (
        <p className="mt-1 text-xs text-gray-500">
          Email и push, когда появится подходящая б/у запчасть
        </p>
      ) : null}
    </div>
  );
}
