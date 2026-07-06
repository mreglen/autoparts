import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import {
  deleteSearchSubscription,
  fetchSearchSubscriptions,
} from '../../redux/slices/UserEngagementSlice';

function formatDate(value) {
  if (!value) return '—';
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function SearchSubscriptionsPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const items = useSelector((state) => state.userEngagement?.subscriptions || []);
  const loading = useSelector((state) => state.userEngagement?.subscriptionsLoading);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }
    dispatch(fetchSearchSubscriptions());
  }, [isReady, isAuthenticated, navigate, dispatch]);

  const handleDelete = (id) => {
    dispatch(deleteSearchSubscription(id));
  };

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">Подписки на поиск</h1>
      <p className="mt-1 text-sm text-gray-600">
        Уведомления по email и push, когда появится подходящая б/у запчасть
      </p>

      {loading ? (
        <div className="mt-6 space-y-3">
          <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-16 animate-pulse rounded-xl bg-gray-100" />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-gray-700">Нет активных подписок.</p>
          <p className="mt-2 text-sm text-gray-500">
            Подпишитесь на поиск на странице каталога б/у запчастей.
          </p>
        </div>
      ) : (
        <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <ul className="divide-y divide-gray-100">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-5">
                <div>
                  <p className="font-medium text-gray-900">«{item.query_text}»</p>
                  <p className="mt-1 text-xs text-gray-500">
                    С {formatDate(item.created_at)}
                    {item.last_notified_at ? ` · последнее уведомление ${formatDate(item.last_notified_at)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDelete(item.id)}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Удалить
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
