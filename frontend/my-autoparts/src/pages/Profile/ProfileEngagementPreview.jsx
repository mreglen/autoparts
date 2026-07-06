import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  deleteSearchSubscription,
  fetchFavorites,
  fetchSearchSubscriptions,
  fetchViewHistory,
} from '../../redux/slices/UserEngagementSlice';
import { PREVIEW_LIMIT, ProfileSubscriptionsList } from './profileEngagementShared';
import {
  ProfileBlock,
  ProfilePreviewGrid,
  ProfileSectionHeader,
} from './profileUi';

export default function ProfileEngagementPreview() {
  const dispatch = useDispatch();
  const favorites = useSelector((state) => state.userEngagement?.favorites || []);
  const favoritesLoading = useSelector((state) => state.userEngagement?.favoritesLoading);
  const views = useSelector((state) => state.userEngagement?.viewHistory || []);
  const viewsLoading = useSelector((state) => state.userEngagement?.viewHistoryLoading);
  const subscriptions = useSelector((state) => state.userEngagement?.subscriptions || []);
  const subsLoading = useSelector((state) => state.userEngagement?.subscriptionsLoading);

  useEffect(() => {
    dispatch(fetchFavorites());
    dispatch(fetchViewHistory());
    dispatch(fetchSearchSubscriptions());
  }, [dispatch]);

  const favoritePreview = favorites.slice(0, PREVIEW_LIMIT.favorites);
  const viewsPreview = views.slice(0, PREVIEW_LIMIT.views);
  const subsPreview = subscriptions.slice(0, PREVIEW_LIMIT.subscriptions);

  return (
    <>
      <ProfileBlock>
        <ProfileSectionHeader
          title="Избранное"
          to={favorites.length > PREVIEW_LIMIT.favorites ? '/profile/favorites' : undefined}
        />
        <ProfilePreviewGrid items={favoritePreview} loading={favoritesLoading} />
      </ProfileBlock>

      <ProfileBlock>
        <ProfileSectionHeader
          title="Просмотры"
          to={views.length > PREVIEW_LIMIT.views ? '/profile/views' : undefined}
        />
        <ProfilePreviewGrid items={viewsPreview} loading={viewsLoading} />
      </ProfileBlock>

      <ProfileBlock>
        <ProfileSectionHeader
          title="Подписки"
          to={subscriptions.length > PREVIEW_LIMIT.subscriptions ? '/profile/subscriptions' : undefined}
        />
        {subsLoading ? (
          <div className="space-y-0 px-4 pb-4">
            <div className="my-3 h-12 animate-pulse rounded bg-gray-50" />
            <div className="mb-3 h-12 animate-pulse rounded bg-gray-50" />
          </div>
        ) : (
          <ProfileSubscriptionsList
            items={subsPreview}
            onDelete={(id) => dispatch(deleteSearchSubscription(id))}
          />
        )}
      </ProfileBlock>
    </>
  );
}
