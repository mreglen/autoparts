import React, { useEffect, useMemo, useState } from 'react';
import {
  buildListImageUrlFallbackChain,
  pickFullImageUrlNormalized,
  pickListImageUrlNormalized,
} from '../../utils/apiClient';

/**
 * Fast paint via thumb/list URL, then upgrade to full-size when ready.
 * Thumbnail strips should pass upgradeToFull={false}.
 */
export default function ProgressiveProductImage({
  photo,
  alt = '',
  className = '',
  priority = false,
  upgradeToFull = true,
  sizes,
  width,
  height,
}) {
  const listUrl = useMemo(() => pickListImageUrlNormalized(photo), [photo]);
  const fullUrl = useMemo(() => pickFullImageUrlNormalized(photo), [photo]);
  const chain = useMemo(() => buildListImageUrlFallbackChain(photo), [photo]);

  const initial = listUrl || fullUrl || chain[0] || '';
  const [src, setSrc] = useState(initial);
  const [fallbackIdx, setFallbackIdx] = useState(0);

  useEffect(() => {
    const start = listUrl || fullUrl || chain[0] || '';
    setSrc(start);
    setFallbackIdx(0);

    if (!upgradeToFull || !listUrl || !fullUrl || listUrl === fullUrl) return undefined;

    let cancelled = false;
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      if (!cancelled) setSrc(fullUrl);
    };
    img.src = fullUrl;
    return () => {
      cancelled = true;
      img.onload = null;
    };
  }, [listUrl, fullUrl, upgradeToFull, chain]);

  if (!src) return null;

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      width={width}
      height={height}
      sizes={sizes}
      loading={priority ? 'eager' : 'lazy'}
      decoding="async"
      fetchPriority={priority ? 'high' : 'auto'}
      onError={() => {
        const next = fallbackIdx + 1;
        if (chain[next]) {
          setFallbackIdx(next);
          setSrc(chain[next]);
        }
      }}
    />
  );
}
