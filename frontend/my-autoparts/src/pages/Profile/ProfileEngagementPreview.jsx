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
  ProfileShowMoreButton,
} from './profileUi';

function EngagementPreviewSection({ title, items, loading, moreTo, previewItems, previewLimit }) {
  return (
    <ProfileBlock>
      <ProfileSectionHeader title={title} />
      <ProfilePreviewGrid items={previewItems} loading={loading} />
      <ProfileShowMoreButton to={moreTo} visible={items.length > previewLimit} />
    </ProfileBlock>
  );
}

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
      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <EngagementPreviewSection
          title="Избранное"
          items={favorites}
          loading={favoritesLoading}
          moreTo="/profile/favorites"
          previewItems={favoritePreview}
          previewLimit={PREVIEW_LIMIT.favorites}
        />
        <EngagementPreviewSection
          title="Просмотры"
          items={views}
          loading={viewsLoading}
          moreTo="/profile/views"
          previewItems={viewsPreview}
          previewLimit={PREVIEW_LIMIT.views}
        />
      </div>

      <ProfileBlock>
        <ProfileSectionHeader title="Подписки" />
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
        <ProfileShowMoreButton
          to="/profile/subscriptions"
          visible={subscriptions.length > PREVIEW_LIMIT.subscriptions}
        />
      </ProfileBlock>
    </>
  );
}
