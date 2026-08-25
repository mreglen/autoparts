import { useEffect, useMemo, useState } from 'react';
import { resolveOgImageUrl } from '../../../utils/seoConstants';

function resolveImageSrc(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return resolveOgImageUrl(imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`);
}

export default function NewPartDetailMobileGallery({
  imageUrl,
  attribution,
  alt,
  className = '',
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);
  const src = useMemo(() => resolveImageSrc(imageUrl), [imageUrl]);

  useEffect(() => {
    setLoaded(false);
    setFailed(false);
  }, [src]);

  useEffect(() => {
    if (!src) return undefined;
    const img = new Image();
    img.src = src;
    return undefined;
  }, [src]);

  return (
    <div
      className={`relative min-h-[40dvh] max-h-[50dvh] w-full overflow-hidden bg-surface-subtle lg:hidden ${className}`}
      style={{ aspectRatio: '4 / 3' }}
    >
      {!src || failed ? (
        <div className="flex h-full min-h-[40dvh] items-center justify-center">
          <svg className="h-16 w-16 text-ink-faint" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
            />
          </svg>
        </div>
      ) : (
        <>
          {!loaded ? (
            <div className="absolute inset-0 animate-pulse bg-surface-muted" aria-hidden />
          ) : null}
          <img
            src={src}
            alt={alt || ''}
            title={attribution || undefined}
            width={800}
            height={600}
            className={`h-full w-full object-contain transition-opacity duration-200 ${loaded ? 'opacity-100' : 'opacity-0'}`}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
          <div
            className="pointer-events-none absolute bottom-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white"
            aria-live="polite"
          >
            1/1
          </div>
        </>
      )}
    </div>
  );
}
