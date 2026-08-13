function cx(...parts) {
  return parts.filter(Boolean).join(' ');
}

export function Skeleton({ className = '' }) {
  return <div className={cx('animate-pulse rounded-sg bg-surface-subtle', className)} />;
}

export function SkeletonCard({ lines = 3, className = '' }) {
  return (
    <div className={cx('rounded-sg-lg border border-line bg-surface p-5 shadow-sg', className)}>
      <Skeleton className="mb-4 h-5 w-1/3" />
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton key={i} className={`h-4 ${i === lines - 1 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}

export function SkeletonHeaderStats({ count = 3 }) {
  return (
    <div className="grid grid-cols-3 gap-4 sm:flex sm:shrink-0 sm:gap-8">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="text-center">
          <Skeleton className="mx-auto h-8 w-16 sm:h-9 sm:w-20" />
          <Skeleton className="mx-auto mt-1.5 h-3 w-12 sm:h-4 sm:w-14" />
        </div>
      ))}
    </div>
  );
}

export function SkeletonListCard() {
  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200/80 bg-white shadow-sm">
      <div className="border-b border-gray-100 px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-lg" />
              <Skeleton className="h-4 w-28" />
            </div>
            <Skeleton className="h-5 w-48 max-w-full" />
            <Skeleton className="h-4 w-36 max-w-full" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-16 lg:ml-auto" />
            <Skeleton className="h-7 w-24 lg:ml-auto" />
            <Skeleton className="h-6 w-20 rounded-full lg:ml-auto" />
          </div>
        </div>
      </div>
      <div className="px-4 py-3 sm:px-5">
        <Skeleton className="h-4 w-40" />
      </div>
    </article>
  );
}

export function SkeletonListCards({ count = 4 }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonListCard key={i} />
      ))}
    </div>
  );
}

export default Skeleton;
