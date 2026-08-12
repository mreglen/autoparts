import { resolveOgImageUrl } from '../../../utils/seoConstants';

function resolveImageSrc(imageUrl) {
  if (!imageUrl) return null;
  if (imageUrl.startsWith('http')) return imageUrl;
  return resolveOgImageUrl(imageUrl.startsWith('/') ? imageUrl : `/${imageUrl}`);
}

export default function NewPartDetailThumb({ imageUrl, alt, className = '' }) {
  const src = resolveImageSrc(imageUrl);

  return (
    <div
      className={`flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-surface-subtle sm:h-24 sm:w-24 ${className}`}
    >
      {src ? (
        <img
          src={src}
          alt={alt || ''}
          className="h-full w-full object-contain p-1.5"
          loading="lazy"
        />
      ) : (
        <svg className="h-8 w-8 text-ink-faint sm:h-9 sm:w-9" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
      )}
    </div>
  );
}
