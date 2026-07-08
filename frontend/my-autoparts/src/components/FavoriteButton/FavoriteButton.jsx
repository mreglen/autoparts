import React, { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import {
  fetchFavoriteStatus,
  isAuthEngagementError,
  toggleFavorite,
} from '../../redux/slices/UserEngagementSlice';
import { productFavoriteKey } from '../../utils/favoriteKeys';

function HeartIcon({ filled, className = 'h-5 w-5' }) {
  if (filled) {
    return (
      <svg className={`${className} text-red-500`} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
        <path d="M11.645 20.91l-.007-.003-.022-.012a15.247 15.247 0 01-.383-.218 25.18 25.18 0 01-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0112 5.052 5.5 5.5 0 0116.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 01-4.244 3.17 15.247 15.247 0 01-.383.219l-.022.012-.007.004-.003.001a.752.752 0 01-.704 0l-.003-.001z" />
      </svg>
    );
  }
  return (
    <svg className={`${className} text-gray-500`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
      />
    </svg>
  );
}

export default function FavoriteButton({
  productId,
  size = 'sm',
  className = '',
  showLabel = true,
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, isReady, token } = useAuthReady();
  const normalizedProductId = Number(productId);
  const favoriteKey = productFavoriteKey(normalizedProductId);
  const isFavorite = useSelector(
    (state) => Boolean(state.userEngagement?.favoriteByKey?.[favoriteKey]),
  );
  const loading = useSelector(
    (state) => state.userEngagement?.favoriteTogglingKey === favoriteKey,
  );

  const returnPath = `${location.pathname}${location.search}`;

  const goToAuth = useCallback(() => {
    navigate('/auth', { state: { from: returnPath } });
  }, [navigate, returnPath]);

  useEffect(() => {
    if (!isReady || !token || !isAuthenticated || !normalizedProductId) return;
    dispatch(fetchFavoriteStatus(normalizedProductId));
  }, [dispatch, isReady, token, isAuthenticated, normalizedProductId]);

  const handleClick = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (!normalizedProductId) return;
    if (isLoading) return;
    if (!isAuthenticated || !token) {
      goToAuth();
      return;
    }
    const result = await dispatch(toggleFavorite({ productId: normalizedProductId, isFavorite }));
    if (toggleFavorite.rejected.match(result) && isAuthEngagementError(result.payload)) {
      goToAuth();
    }
  }, [
    dispatch,
    isAuthenticated,
    isLoading,
    token,
    normalizedProductId,
    isFavorite,
    goToAuth,
  ]);

  const sizeClasses = size === 'sm'
    ? 'min-h-9 gap-1.5 px-2.5 py-1.5 text-xs'
    : 'min-h-10 gap-2 px-3 py-2 text-sm';

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      className={`inline-flex items-center justify-center rounded-lg border font-medium transition-colors disabled:opacity-50 ${
        isFavorite
          ? 'border-red-200 bg-red-50 text-red-600 hover:bg-red-100'
          : 'border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
      } ${sizeClasses} ${className}`}
    >
      <HeartIcon filled={isFavorite} className={`${size === 'sm' ? 'h-4 w-4' : 'h-5 w-5'} transition-transform ${isFavorite ? 'scale-110' : ''}`} />
      {showLabel ? (isFavorite ? 'В избранном' : 'В избранное') : null}
    </button>
  );
}
