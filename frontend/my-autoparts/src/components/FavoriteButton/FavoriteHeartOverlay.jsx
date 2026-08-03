import { useCallback, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import {
  fetchFavoriteStatus,
  fetchRosskoFavoriteStatus,
  isAuthEngagementError,
  toggleFavorite,
  toggleRosskoFavorite,
} from '../../redux/slices/UserEngagementSlice';
import { productFavoriteKey, rosskoFavoriteKey } from '../../utils/favoriteKeys';

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

export default function FavoriteHeartOverlay({
  productId,
  rossko,
  className = '',
}) {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, isReady, token } = useAuthReady();

  const favoriteKey = rossko
    ? rosskoFavoriteKey(rossko.brand, rossko.partnumber)
    : productFavoriteKey(productId);

  const loading = useSelector(
    (state) => state.userEngagement?.favoriteTogglingKey === favoriteKey,
  );

  const isFavorite = useSelector(
    (state) => Boolean(state.userEngagement?.favoriteByKey?.[favoriteKey]),
  );

  const favoriteStatusKnown = useSelector(
    (state) => Object.prototype.hasOwnProperty.call(
      state.userEngagement?.favoriteByKey || {},
      favoriteKey,
    ),
  );

  const returnPath = `${location.pathname}${location.search}`;

  const goToAuth = useCallback(() => {
    navigate('/auth', { state: { from: returnPath } });
  }, [navigate, returnPath]);

  useEffect(() => {
    if (!isReady || !token || !isAuthenticated || !favoriteKey) return;
    if (loading) return;
    if (favoriteStatusKnown) return;
    if (rossko) {
      dispatch(fetchRosskoFavoriteStatus({
        brand: rossko.brand,
        partnumber: rossko.partnumber,
      }));
      return;
    }
    dispatch(fetchFavoriteStatus(productId));
  }, [
    dispatch,
    isReady,
    token,
    isAuthenticated,
    favoriteKey,
    productId,
    rossko?.brand,
    rossko?.partnumber,
    favoriteStatusKnown,
    loading,
    // intentionally not depending on whole `rossko` object (new ref each render)
  ]);

  const handleClick = useCallback(async (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof e.nativeEvent?.stopImmediatePropagation === 'function') {
      e.nativeEvent.stopImmediatePropagation();
    }
    if (isLoading || !isReady) return;
    if (!token || !isAuthenticated) {
      goToAuth();
      return;
    }
    if (rossko) {
      const result = await dispatch(toggleRosskoFavorite({
        brand: rossko.brand,
        partnumber: rossko.partnumber,
        guid: rossko.guid,
        title: rossko.title,
        minPrice: rossko.minPrice,
        isFavorite,
      }));
      if (toggleRosskoFavorite.rejected.match(result) && isAuthEngagementError(result.payload)) {
        goToAuth();
      }
      return;
    }
    const result = await dispatch(toggleFavorite({ productId, isFavorite }));
    if (toggleFavorite.rejected.match(result) && isAuthEngagementError(result.payload)) {
      goToAuth();
    }
  }, [
    dispatch,
    isAuthenticated,
    isLoading,
    isReady,
    token,
    isFavorite,
    productId,
    rossko,
    goToAuth,
  ]);

  if (!favoriteKey) return null;

  return (
    <button
      type="button"
      onClick={handleClick}
      onMouseDown={(e) => {
        e.preventDefault();
        e.stopPropagation();
      }}
      onPointerDown={(e) => {
        e.stopPropagation();
      }}
      disabled={loading || isLoading}
      aria-pressed={isFavorite}
      aria-label={isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'}
      className={`absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-gray-200/80 bg-white/90 shadow-sm backdrop-blur-sm transition-colors hover:bg-white disabled:opacity-50 ${className}`}
    >
      <HeartIcon filled={isFavorite} className="h-4 w-4" />
    </button>
  );
}
