import { SITE_ORIGIN } from './breadcrumbs';

export const FAVICON_SVG_PATH = '/favicons/favicon.svg';
export const FAVICON_SVG_URL = `${SITE_ORIGIN}${FAVICON_SVG_PATH}`;
export const DEFAULT_OG_IMAGE_URL = `${SITE_ORIGIN}/favicons/apple-touch-icon.png`;

export function resolveOgImageUrl(imageUrl) {
  const value = typeof imageUrl === 'string' ? imageUrl.trim() : '';
  return value || DEFAULT_OG_IMAGE_URL;
}
