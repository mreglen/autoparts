import { resolveOgImageUrl } from '../../../utils/seoConstants';

function resolveImageSrc(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return resolveOgImageUrl(imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`);
}

export default function NewPartDetailThumb({ imageUrl, attribution, alt, className = '' }) {
  const src = resolveImageSrc(imageUrl);

  return (
    <div
      className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-subtle sm:h-24 sm:w-24 ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt || ''}
          title={attribution || undefined}
          className="h-full w-full object-contain p-1.5"
          loading="lazy"
        />
      ) : (
        <svg className="h-8 w-8 text-ink-faint sm:h-9 sm:w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
          />
        </svg>
      )}
    </div>
  );
}
