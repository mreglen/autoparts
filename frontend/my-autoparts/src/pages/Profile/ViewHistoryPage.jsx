import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../AutoParts/ProductCard';
import { ProductCardSkeletonGrid } from '../../components/skeletons/ProductCardSkeleton';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { clearViewHistory, fetchViewHistory } from '../../redux/slices/UserEngagementSlice';

export default function ViewHistoryPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const items = useSelector((state) => state.userEngagement?.viewHistory || []);
  const loading = useSelector((state) => state.userEngagement?.viewHistoryLoading);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }
    dispatch(fetchViewHistory());
  }, [isReady, isAuthenticated, navigate, dispatch]);

  const handleClear = async () => {
    await dispatch(clearViewHistory());
  };

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">История просмотров</h1>
          <p className="mt-1 text-sm text-gray-600">Последние 50 просмотренных б/у запчастей</p>
        </div>
        {items.length > 0 ? (
          <button
            type="button"
            onClick={handleClear}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Очистить
          </button>
        ) : null}
      </div>

      {loading ? (
        <div className="mt-6">
          <ProductCardSkeletonGrid count={8} />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-gray-700">Вы ещё не просматривали запчасти.</p>
        </div>
      ) : (
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((part) => (
            <ProductCard key={part.id} part={part} />
          ))}
        </div>
      )}
    </div>
  );
}
