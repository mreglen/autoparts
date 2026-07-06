import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { fetchFavorites } from '../../redux/slices/UserEngagementSlice';
import ProfileEngagementProductsPage from './ProfileEngagementProductsPage';

export default function ProfileFavoritesPage() {
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

  return <ProfileEngagementProductsPage items={items} loading={loading} />;
}
