import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { logout } from '../../redux/slices/AuthSlice';
import {
  fetchSearchSubscriptions,
  isAuthEngagementError,
  subscribeToSearch,
} from '../../redux/slices/UserEngagementSlice';

export const PENDING_SEARCH_SUBSCRIPTION_KEY = 'pendingSearchSubscription';

function storePendingSearchSubscription(query) {
  const normalized = String(query || '').trim();
  if (normalized.length < 2) return;
  sessionStorage.setItem(PENDING_SEARCH_SUBSCRIPTION_KEY, normalized);
}

export default function SubscribeSearchButton({
  query,
  className = '',
  variant = 'primary',
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, isReady, token } = useAuthReady();
  const loading = useSelector((state) => state.userEngagement?.subscriptionActionLoading);
  const subscriptions = useSelector((state) => state.userEngagement?.subscriptions || []);
  const [notice, setNotice] = useState('');
  const pendingSubscribeRef = useRef(false);

  const normalizedQuery = useMemo(() => (query || '').trim(), [query]);
  const returnPath = `${location.pathname}${location.search}`;

  const goToAuth = useCallback(() => {
    storePendingSearchSubscription(normalizedQuery);
    navigate('/auth', { state: { from: returnPath } });
  }, [navigate, returnPath, normalizedQuery]);

  useEffect(() => {
    if (!isReady || !token || isLoading) return;

    const pendingRaw = sessionStorage.getItem(PENDING_SEARCH_SUBSCRIPTION_KEY);
    if (!pendingRaw) {
      if (isAuthenticated) {
        dispatch(fetchSearchSubscriptions());
      }
      return;
    }

    const pending = pendingRaw.trim();
    if (pending.length < 2) {
      sessionStorage.removeItem(PENDING_SEARCH_SUBSCRIPTION_KEY);
      return;
    }

    const currentNorm = normalizedQuery.toLowerCase();
    const pendingNorm = pending.toLowerCase();
    if (currentNorm && currentNorm !== pendingNorm) {
      return;
    }

    if (pendingSubscribeRef.current) return;
    pendingSubscribeRef.current = true;
    sessionStorage.removeItem(PENDING_SEARCH_SUBSCRIPTION_KEY);

    (async () => {
      const result = await dispatch(subscribeToSearch(pending));
      pendingSubscribeRef.current = false;

      if (subscribeToSearch.fulfilled.match(result)) {
        setNotice('Подписка оформлена. Мы сообщим, когда появится запчасть.');
        window.setTimeout(() => setNotice(''), 3500);
      } else if (subscribeToSearch.rejected.match(result)) {
        const message = result.payload || 'Не удалось оформить подписку';
        if (isAuthEngagementError(message)) {
          storePendingSearchSubscription(pending);
          await dispatch(logout());
          navigate('/auth', { state: { from: returnPath } });
        } else {
          setNotice(message);
          window.setTimeout(() => setNotice(''), 3500);
        }
      }

      dispatch(fetchSearchSubscriptions());
    })();
  }, [dispatch, isReady, token, isLoading, isAuthenticated, normalizedQuery, navigate, returnPath]);

  const alreadySubscribed = useMemo(() => {
    const norm = normalizedQuery.toLowerCase();
    return subscriptions.some(
      (item) => (item.query_text || '').trim().toLowerCase() === norm,
    );
  }, [subscriptions, normalizedQuery]);

  const handleClick = useCallback(async () => {
    if (!normalizedQuery || normalizedQuery.length < 2) return;
    if (!isReady || isLoading) return;

    if (!token) {
      goToAuth();
      return;
    }

    const result = await dispatch(subscribeToSearch(normalizedQuery));

    if (subscribeToSearch.fulfilled.match(result)) {
      setNotice('Подписка оформлена. Мы сообщим, когда появится запчасть.');
      window.setTimeout(() => setNotice(''), 3500);
      dispatch(fetchSearchSubscriptions());
      return;
    }

    if (subscribeToSearch.rejected.match(result) && result.meta?.condition) {
      if (!token) {
        goToAuth();
      } else {
        setNotice('Не удалось оформить подписку. Обновите страницу и попробуйте снова.');
        window.setTimeout(() => setNotice(''), 3500);
      }
      return;
    }

    const message = result.payload || 'Не удалось оформить подписку';
    if (isAuthEngagementError(message)) {
      storePendingSearchSubscription(normalizedQuery);
      await dispatch(logout());
      navigate('/auth', { state: { from: returnPath } });
      return;
    }

    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }, [
    dispatch,
    token,
    isReady,
    isLoading,
    normalizedQuery,
    goToAuth,
    navigate,
    returnPath,
  ]);

  if (!normalizedQuery) return null;

  const buttonClass = variant === 'secondary'
    ? 'border border-indigo-200 bg-indigo-50 text-indigo-800 hover:bg-indigo-100'
    : 'bg-indigo-600 text-white hover:bg-indigo-700';

  return (
    <div className={className}>
      <button
        type="button"
        onClick={handleClick}
        disabled={loading || !isReady || isLoading || alreadySubscribed}
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
