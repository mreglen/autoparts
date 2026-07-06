import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { clearViewHistory, fetchViewHistory } from '../../redux/slices/UserEngagementSlice';
import ProfileEngagementProductsPage from './ProfileEngagementProductsPage';

export default function ProfileViewsPage() {
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

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <ProfileEngagementProductsPage
      items={items}
      loading={loading}
      headerAction={items.length > 0 ? (
        <button
          type="button"
          onClick={() => dispatch(clearViewHistory())}
          className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
        >
          Очистить
        </button>
      ) : null}
    />
  );
}
