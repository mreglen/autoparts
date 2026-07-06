import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useAuthReady } from '../../hooks/useAuthReady';
import AuthLoadingScreen from '../../components/AuthLoadingScreen/AuthLoadingScreen';
import { deleteSearchSubscription, fetchSearchSubscriptions } from '../../redux/slices/UserEngagementSlice';
import { ProfileSubscriptionsList } from './profileEngagementShared';
import { ProfileBlock, profileFullPageShell } from './profileUi';

export default function ProfileSubscriptionsPage() {
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

  if (!isReady || !isAuthenticated) {
    return <AuthLoadingScreen />;
  }

  return (
    <div className={profileFullPageShell}>
      <ProfileBlock>
        {loading ? (
          <div className="space-y-0 px-4 pb-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="my-3 h-12 animate-pulse rounded bg-gray-50" />
            ))}
          </div>
        ) : (
          <ProfileSubscriptionsList
            items={items}
            onDelete={(id) => dispatch(deleteSearchSubscription(id))}
          />
        )}
      </ProfileBlock>
    </div>
  );
}
