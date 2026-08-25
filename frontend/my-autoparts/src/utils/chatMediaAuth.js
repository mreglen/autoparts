import { useEffect, useState } from 'react';
import { API_BASE } from './apiClient';

const blobCache = new Map();

function cacheKey(mediaId, thumbnail) {
  return `${mediaId}:${thumbnail ? 'thumb' : 'full'}`;
}

export function getChatMediaPath(mediaId, { thumbnail = false } = {}) {
  return thumbnail
    ? `/chats/media/${mediaId}/thumbnail`
    : `/chats/media/${mediaId}`;
}

export async function fetchChatMediaBlobUrl(mediaId, { thumbnail = false } = {}) {
  if (mediaId == null || String(mediaId).startsWith('temp_')) {
    throw new Error('Invalid media id');
  }

  const key = cacheKey(mediaId, thumbnail);
  if (blobCache.has(key)) {
    return blobCache.get(key);
  }

  const token = localStorage.getItem('token');
  if (!token) {
    throw new Error('Not authenticated');
  }

  const response = await fetch(`${API_BASE}${getChatMediaPath(mediaId, { thumbnail })}`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Media fetch failed: ${response.status}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  blobCache.set(key, objectUrl);
  return objectUrl;
}

export function revokeChatMediaBlobUrl(mediaId, { thumbnail = false } = {}) {
  const key = cacheKey(mediaId, thumbnail);
  const url = blobCache.get(key);
  if (url) {
    URL.revokeObjectURL(url);
    blobCache.delete(key);
  }
}

export async function downloadChatMedia(mediaId, filename = 'file') {
  const blobUrl = await fetchChatMediaBlobUrl(mediaId);
  const anchor = document.createElement('a');
  anchor.href = blobUrl;
  anchor.download = filename;
  anchor.rel = 'noopener';
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}

export function useChatMediaBlobUrl(mediaId, { thumbnail = false, enabled = true } = {}) {
  const [url, setUrl] = useState('');
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!enabled || mediaId == null || String(mediaId).startsWith('temp_')) {
      setUrl('');
      setError(false);
      setLoading(false);
      return undefined;
    }

    let cancelled = false;
    setLoading(true);
    setError(false);

    fetchChatMediaBlobUrl(mediaId, { thumbnail })
      .then((blobUrl) => {
        if (!cancelled) setUrl(blobUrl);
      })
      .catch(() => {
        if (!cancelled) setError(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [mediaId, thumbnail, enabled]);

  return { url, error, loading };
}
