import { useEffect } from 'react';
import { useShowYandexBadge } from '../../utils/siteReviewsPublic';

export default function HeaderBadgeHeightSync() {
  const showYandexBadge = useShowYandexBadge();

  useEffect(() => {
    document.documentElement.classList.toggle('sg-yandex-badge-on', showYandexBadge);
    return () => {
      document.documentElement.classList.remove('sg-yandex-badge-on');
    };
  }, [showYandexBadge]);

  return null;
}
