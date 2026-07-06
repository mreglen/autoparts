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
import { ProfileBlock } from './profileUi';

function formatDate(value) {
  if (!value) return null;
  return new Date(value).toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'short',
  });
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
    <>
      <ProfileBlock title="Недавно смотрели">
        <div className="px-4 py-3">
          {views.length > 0 ? (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                onClick={() => dispatch(clearViewHistory())}
                className="text-sm text-gray-400 hover:text-gray-600"
              >
                Очистить
              </button>
            </div>
          ) : null}

          {viewsLoading ? (
            <ProductCardSkeletonGrid count={3} />
          ) : views.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-400">
              <Link to="/autoparts/used" className="text-[#0099f7] hover:underline">
                Перейти в каталог
              </Link>
            </p>
          ) : (
            <div className="-mx-1 flex gap-2 overflow-x-auto pb-1 scrollbar-thin">
              {views.map((part) => (
                <div key={part.id} className="w-[9.5rem] shrink-0 sm:w-[10.5rem]">
                  <ProductCard part={part} />
                </div>
              ))}
            </div>
          )}
        </div>
      </ProfileBlock>

      <ProfileBlock title="Подписки на поиск">
        {subsLoading ? (
          <div className="space-y-0">
            <div className="mx-4 my-3 h-12 animate-pulse rounded bg-gray-50" />
            <div className="mx-4 mb-3 h-12 animate-pulse rounded bg-gray-50" />
          </div>
        ) : subscriptions.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-400">
            <Link to="/autoparts/used" className="text-[#0099f7] hover:underline">
              Подписаться в каталоге
            </Link>
          </p>
        ) : (
          <ul>
            {subscriptions.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between gap-3 border-b border-gray-100 px-4 py-3.5 last:border-b-0"
              >
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-gray-900">{item.query_text}</p>
                  <p className="mt-0.5 text-sm text-gray-400">
                    {formatDate(item.created_at)}
                    {item.last_notified_at ? ` · ${formatDate(item.last_notified_at)}` : ''}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => dispatch(deleteSearchSubscription(item.id))}
                  className="shrink-0 text-sm text-gray-400 hover:text-red-600"
                >
                  Убрать
                </button>
              </li>
            ))}
          </ul>
        )}
      </ProfileBlock>
    </>
  );
}
