import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { clearViewHistory, fetchViewHistory } from '../../redux/slices/UserEngagementSlice';
import { ProfileProductGrid, profileFullPageShell } from './profileUi';

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
    <div className={profileFullPageShell}>
      {items.length > 0 ? (
        <div className="mb-4 flex justify-end">
          <button
            type="button"
            onClick={() => dispatch(clearViewHistory())}
            className="text-sm font-medium text-indigo-600 hover:text-indigo-700"
          >
            Очистить
          </button>
        </div>
      ) : null}
      <ProfileProductGrid items={items} loading={loading} />
    </div>
  );
}
