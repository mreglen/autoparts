import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { fetchSearchSubscriptions, subscribeToSearch } from '../../redux/slices/UserEngagementSlice';

function isAuthErrorMessage(message) {
  const text = String(message || '').toLowerCase();
  return (
    text.includes('401')
    || text.includes('unauthorized')
    || text.includes('not authenticated')
    || text.includes('учетные данные')
    || text.includes('учётные данные')
    || text.includes('сессия')
  );
}

export default function SubscribeSearchButton({
  query,
  className = '',
  variant = 'primary',
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, isReady } = useAuthReady();
  const loading = useSelector((state) => state.userEngagement?.subscriptionActionLoading);
  const subscriptions = useSelector((state) => state.userEngagement?.subscriptions || []);
  const [notice, setNotice] = useState('');

  const normalizedQuery = useMemo(() => (query || '').trim(), [query]);
  const returnPath = `${location.pathname}${location.search}`;

  const goToAuth = useCallback(() => {
    navigate('/auth', { state: { from: returnPath } });
  }, [navigate, returnPath]);

  useEffect(() => {
    if (!isReady || !isAuthenticated) return;
    dispatch(fetchSearchSubscriptions());
  }, [dispatch, isReady, isAuthenticated]);

  const alreadySubscribed = useMemo(() => {
    const norm = normalizedQuery.toLowerCase();
    return subscriptions.some(
      (item) => (item.query_text || '').trim().toLowerCase() === norm,
    );
  }, [subscriptions, normalizedQuery]);

  const handleClick = useCallback(async () => {
    if (!normalizedQuery || normalizedQuery.length < 2) return;
    if (isLoading) return;
    if (!isAuthenticated) {
      goToAuth();
      return;
    }
    const result = await dispatch(subscribeToSearch(normalizedQuery));
    if (subscribeToSearch.fulfilled.match(result)) {
      setNotice('Подписка оформлена. Мы сообщим, когда появится запчасть.');
      window.setTimeout(() => setNotice(''), 3500);
      return;
    }
    const message = result.payload || 'Не удалось оформить подписку';
    if (isAuthErrorMessage(message)) {
      goToAuth();
      return;
    }
    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }, [dispatch, isAuthenticated, isLoading, normalizedQuery, goToAuth]);

  if (!normalizedQuery) return null;

  const buttonClass = variant === 'secondary'
    ? 'border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
    : 'bg-indigo-600 text-white hover:bg-indigo-700';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || isLoading || alreadySubscribed}
        className={`rounded-lg px-4 py-2 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${buttonClass}`}
      >
        {alreadySubscribed ? 'Вы подписаны на этот поиск' : 'Подписаться на этот поиск'}
      </button>
      {notice ? (
        <p className="mt-2 text-sm text-gray-600">{notice}</p>
      ) : null}
    </div>
  );
}
