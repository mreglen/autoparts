import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import ProductCard from '../AutoParts/ProductCard';
import { ProductCardSkeletonGrid } from '../../components/skeletons/ProductCardSkeleton';
import {
  clearViewHistory,
  deleteSearchSubscription,
  fetchSearchSubscriptions,
  fetchViewHistory,
} from '../../redux/slices/UserEngagementSlice';

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
}

function EmptyHint({ children }) {
  return <p className="py-8 text-center text-sm text-gray-400">{children}</p>;
}

export default function ProfileActivitySection() {
  const dispatch = useDispatch();
  const views = useSelector((state) => state.userEngagement?.viewHistory || []);
  const viewsLoading = useSelector((state) => state.userEngagement?.viewHistoryLoading);
  const subscriptions = useSelector((state) => state.userEngagement?.subscriptions || []);
  const subsLoading = useSelector((state) => state.userEngagement?.subscriptionsLoading);

  useEffect(() => {
    dispatch(fetchViewHistory());
    dispatch(fetchSearchSubscriptions());
  }, [dispatch]);

  return (
    <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="px-5 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-gray-900">Просмотры</h3>
          {views.length > 0 ? (
            <button
              type="button"
              onClick={() => dispatch(clearViewHistory())}
              className="text-xs text-gray-400 transition-colors hover:text-gray-600"
            >
              Очистить
            </button>
          ) : null}
        </div>

        {viewsLoading ? (
          <div className="mt-3">
            <ProductCardSkeletonGrid count={4} />
          </div>
        ) : views.length === 0 ? (
          <EmptyHint>
            Пока ничего нет.{' '}
            <Link to="/autoparts/used" className="text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
              Каталог б/у
            </Link>
          </EmptyHint>
        ) : (
          <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {views.map((part) => (
              <ProductCard key={part.id} part={part} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-gray-100 px-5 py-4 sm:px-6">
        <h3 className="text-sm font-semibold text-gray-900">Подписки на поиск</h3>

        {subsLoading ? (
          <div className="mt-3 space-y-2">
            <div className="h-11 animate-pulse rounded-lg bg-gray-50" />
            <div className="h-11 animate-pulse rounded-lg bg-gray-50" />
          </div>
        ) : subscriptions.length === 0 ? (
          <EmptyHint>
            Нет подписок.{' '}
            <Link to="/autoparts/used" className="text-gray-600 underline-offset-2 hover:text-gray-900 hover:underline">
              Найти в каталоге
            </Link>
          </EmptyHint>
        ) : (
          <ul className="mt-3 divide-y divide-gray-100">
            {subscriptions.map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-3 first:pt-0">
                <div className="min-w-0">
                  <p className="truncate text-sm text-gray-900">{item.query_text}</p>
                  <p className="mt-0.5 text-xs text-gray-400">
                    {formatDate(item.created_at)}
                    {item.last_notified_at ? ` · ${formatDate(item.last_notified_at)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch(deleteSearchSubscription(item.id))}
                  className="shrink-0 text-xs text-gray-400 transition-colors hover:text-red-600"
                >
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
