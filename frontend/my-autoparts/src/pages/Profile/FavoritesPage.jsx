import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import ProductCard from '../AutoParts/ProductCard';
import { ProductCardSkeletonGrid } from '../../components/skeletons/ProductCardSkeleton';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { fetchFavorites } from '../../redux/slices/UserEngagementSlice';

export default function FavoritesPage() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { isReady, isAuthenticated } = useAuthReady();
  const items = useSelector((state) => state.userEngagement?.favorites || []);
  const loading = useSelector((state) => state.userEngagement?.favoritesLoading);

  useEffect(() => {
    if (!isReady) return;
    if (!isAuthenticated) {
      navigate('/auth', { replace: true });
      return;
    }
    dispatch(fetchFavorites());
  }, [isReady, isAuthenticated, navigate, dispatch]);

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
      <h1 className="text-2xl font-bold text-gray-900">Избранное</h1>
      <p className="mt-1 text-sm text-gray-600">Сохранённые б/у запчасти</p>

      {loading ? (
        <div className="mt-6">
          <ProductCardSkeletonGrid count={8} />
        </div>
      ) : items.length === 0 ? (
        <div className="mt-10 rounded-2xl border border-dashed border-gray-200 bg-gray-50 px-6 py-12 text-center">
          <p className="text-gray-700">Пока нет избранных запчастей.</p>
          <p className="mt-2 text-sm text-gray-500">Нажмите «В избранное» на карточке товара.</p>
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
