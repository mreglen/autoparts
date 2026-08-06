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

export default Skeleton;
