import { useCallback, useEffect, useRef } from 'react';
import {
  partFormSnapshotHasContent,
  writePartFormSessionCache,
} from '../utils/productDraftUtils';

const LOCAL_SAVE_MS = 800;

/**
 * Debounced sessionStorage cache for part forms (pending / resubmit / edit / add-before-draft).
 */
export default function usePartFormLocalCache({
  mode,
  cacheId,
  enabled = true,
  getSnapshot,
  onRestore,
}) {
  const restoredRef = useRef(false);

  const flushCache = useCallback(() => {
    if (!enabled || cacheId == null) return;
    const snapshot = getSnapshot?.();
    if (!partFormSnapshotHasContent(snapshot)) return;
    writePartFormSessionCache(mode, cacheId, snapshot);
  }, [enabled, cacheId, mode, getSnapshot]);

  useEffect(() => {
    if (!enabled || cacheId == null) return undefined;

    const timer = window.setTimeout(() => {
      flushCache();
    }, LOCAL_SAVE_MS);

    return () => window.clearTimeout(timer);
  }, [enabled, cacheId, flushCache, getSnapshot]);

  useEffect(() => {
    if (!enabled) return undefined;

    const onHide = () => {
      if (document.visibilityState === 'hidden') flushCache();
    };

    document.addEventListener('visibilitychange', onHide);
    window.addEventListener('pagehide', flushCache);

    return () => {
      document.removeEventListener('visibilitychange', onHide);
      window.removeEventListener('pagehide', flushCache);
    };
  }, [enabled, flushCache]);

  const markApiLoaded = useCallback(() => {}, []);

  const tryRestoreFromCache = useCallback((cached) => {
    if (!cached || restoredRef.current || !onRestore) return false;
    if (!partFormSnapshotHasContent(cached)) return false;
    onRestore(cached);
    restoredRef.current = true;
    return true;
  }, [onRestore]);

  return {
    flushCache,
    markApiLoaded,
    tryRestoreFromCache,
  };
}
