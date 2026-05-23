import { normalizeImageUrl } from './apiClient';

export function parseMediaList(raw) {
    if (raw == null) return [];
    if (Array.isArray(raw)) return raw;
    if (typeof raw === 'string') {
        const trimmed = raw.trim();
        if (!trimmed) return [];
        try {
            const parsed = JSON.parse(trimmed);
            return Array.isArray(parsed) ? parsed : [trimmed];
        } catch {
            return [trimmed];
        }
    }
    return [];
}

export function getMediaItemUrl(item) {
    if (item == null) return '';
    if (typeof item === 'string') return item.trim();
    if (typeof item === 'object') {
        return (
            item.full_url
            || item.photo_url
            || item.video_url
            || item.url
            || item.path
            || ''
        );
    }
    return '';
}

export function normalizeProductMedia(product) {
    if (!product) return product;
    return {
        ...product,
        photos: parseMediaList(product.photos).map(getMediaItemUrl).filter(Boolean),
        videos: parseMediaList(product.videos).map(getMediaItemUrl).filter(Boolean),
    };
}

export function getFirstMediaUrl(product) {
    const photos = parseMediaList(product?.photos);
    const videos = parseMediaList(product?.videos);
    const first = photos[0] ?? videos[0];
    const url = getMediaItemUrl(first);
    return url ? normalizeImageUrl(url) : null;
}

export function formatMediaForModal(photos = [], videos = []) {
    const items = [
        ...parseMediaList(photos).map(getMediaItemUrl).filter(Boolean),
        ...parseMediaList(videos).map(getMediaItemUrl).filter(Boolean),
    ];

    return items.map((url) => {
        const normalizedUrl = normalizeImageUrl(url);
        const isVideo = normalizedUrl.toLowerCase().match(/\.(mp4|webm|ogg|mov)$/);
        return { type: isVideo ? 'video' : 'image', src: normalizedUrl };
    });
}
