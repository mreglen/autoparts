import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import { fetchProfile, logout } from '../../redux/slices/AuthSlice';
import {
  fetchSearchSubscriptions,
  isAuthEngagementError,
  isNetworkEngagementError,
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
  const subscriptionsLoadedRef = useRef(false);

  const normalizedQuery = useMemo(() => (query || '').trim(), [query]);
  const returnPath = `${location.pathname}${location.search}`;

  const goToAuth = useCallback(() => {
    storePendingSearchSubscription(normalizedQuery);
    navigate('/auth', { state: { from: returnPath } });
  }, [navigate, returnPath, normalizedQuery]);

  const ensureSession = useCallback(async () => {
    if (!isReady || isLoading) {
      return { ok: false, reason: 'loading' };
    }
    if (!token) {
      return { ok: false, reason: 'no_token' };
    }
    if (isAuthenticated) {
      return { ok: true };
    }

    const profileResult = await dispatch(fetchProfile());
    if (fetchProfile.fulfilled.match(profileResult)) {
      return { ok: true };
    }

    const message = profileResult.payload || '';
    if (isAuthEngagementError(message)) {
      return { ok: false, reason: 'auth' };
    }
    return {
      ok: false,
      reason: 'profile',
      message: message || 'Не удалось проверить сессию',
    };
  }, [dispatch, isReady, isLoading, token, isAuthenticated]);

  const handleAuthFailure = useCallback(async (pendingQuery) => {
    storePendingSearchSubscription(pendingQuery || normalizedQuery);
    await dispatch(logout());
    navigate('/auth', { state: { from: returnPath } });
  }, [dispatch, navigate, returnPath, normalizedQuery]);

  const handleSubscribeResult = useCallback(async (result, pendingQuery) => {
    if (subscribeToSearch.fulfilled.match(result)) {
      setNotice('Подписка оформлена. Мы сообщим, когда появится запчасть.');
      window.setTimeout(() => setNotice(''), 3500);
      dispatch(fetchSearchSubscriptions());
      return;
    }

    if (!subscribeToSearch.rejected.match(result)) return;

    if (result.meta?.condition) {
      const session = await ensureSession();
      if (session.reason === 'no_token') {
        goToAuth();
      } else if (!session.ok) {
        setNotice('Подождите, проверяем сессию…');
        window.setTimeout(() => setNotice(''), 2500);
      } else {
        setNotice('Не удалось оформить подписку. Попробуйте ещё раз.');
        window.setTimeout(() => setNotice(''), 3500);
      }
      return;
    }

    const message = result.payload || 'Не удалось оформить подписку';
    if (isNetworkEngagementError(message)) {
      setNotice('Проверьте соединение и попробуйте снова.');
      window.setTimeout(() => setNotice(''), 3500);
      return;
    }

    if (isAuthEngagementError(message)) {
      const profileResult = await dispatch(fetchProfile());
      if (!fetchProfile.fulfilled.match(profileResult)) {
        await handleAuthFailure(pendingQuery);
        return;
      }
      setNotice('Не удалось оформить подписку. Попробуйте ещё раз.');
      window.setTimeout(() => setNotice(''), 3500);
      return;
    }

    setNotice(message);
    window.setTimeout(() => setNotice(''), 3500);
  }, [dispatch, ensureSession, goToAuth, handleAuthFailure]);

  useEffect(() => {
    if (!isReady || isLoading || !isAuthenticated) return;
    if (subscriptionsLoadedRef.current) return;
    subscriptionsLoadedRef.current = true;
    dispatch(fetchSearchSubscriptions());
  }, [dispatch, isReady, isLoading, isAuthenticated]);

  useEffect(() => {
    if (!isReady || isLoading || !isAuthenticated) return;

    const pendingRaw = sessionStorage.getItem(PENDING_SEARCH_SUBSCRIPTION_KEY);
    if (!pendingRaw) return;

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

    (async () => {
      const session = await ensureSession();
      if (!session.ok) {
        pendingSubscribeRef.current = false;
        if (session.reason === 'auth') {
          await handleAuthFailure(pending);
        }
        return;
      }

      sessionStorage.removeItem(PENDING_SEARCH_SUBSCRIPTION_KEY);
      const result = await dispatch(subscribeToSearch(pending));
      pendingSubscribeRef.current = false;
      await handleSubscribeResult(result, pending);
    })();
  }, [
    dispatch,
    isReady,
    isLoading,
    isAuthenticated,
    normalizedQuery,
    ensureSession,
    handleAuthFailure,
    handleSubscribeResult,
  ]);

  const alreadySubscribed = useMemo(() => {
    const norm = normalizedQuery.toLowerCase();
    return subscriptions.some(
      (item) => (item.query_text || '').trim().toLowerCase() === norm,
    );
  }, [subscriptions, normalizedQuery]);

  const handleClick = useCallback(async () => {
    if (!normalizedQuery || normalizedQuery.length < 2) return;
    if (!isReady || isLoading) return;

    const session = await ensureSession();
    if (session.reason === 'loading') return;
    if (session.reason === 'no_token') {
      goToAuth();
      return;
    }
    if (!session.ok) {
      if (session.reason === 'auth') {
        await handleAuthFailure();
      } else {
        setNotice(session.message || 'Не удалось проверить сессию');
        window.setTimeout(() => setNotice(''), 3500);
      }
      return;
    }

    const result = await dispatch(subscribeToSearch(normalizedQuery));
    await handleSubscribeResult(result, normalizedQuery);
  }, [
    dispatch,
    isReady,
    isLoading,
    normalizedQuery,
    ensureSession,
    goToAuth,
    handleAuthFailure,
    handleSubscribeResult,
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
