import { useSelector } from 'react-redux';

export function selectShowSiteReviews(state) {
  return state.publicInfo.showSiteReviews !== false;
}

export function useShowSiteReviews() {
  return useSelector(selectShowSiteReviews);
}

export function selectShowYandexBadge(state) {
  return state.publicInfo.showYandexBadge !== false;
}

export function useShowYandexBadge() {
  return useSelector(selectShowYandexBadge);
}
