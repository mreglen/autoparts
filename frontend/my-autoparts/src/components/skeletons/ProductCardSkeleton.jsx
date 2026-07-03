import React from 'react';

export default function ProductCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
      <div className="aspect-[4/3] w-full bg-gray-200" />
      <div className="space-y-2 p-2">
        <div className="h-5 w-1/3 rounded bg-gray-200" />
        <div className="h-4 w-full rounded bg-gray-200" />
        <div className="h-4 w-2/3 rounded bg-gray-200" />
      </div>
    </div>
  );
}

export function ProductCardSkeletonGrid({ count = 8, className = 'grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3' }) {
  return (
    <div className={className} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <ProductCardSkeleton key={index} />
      ))}
    </div>
  );
}

export function UsedPartListCardSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-row gap-3 p-3 sm:gap-4 sm:p-4">
        <div className="h-24 w-24 shrink-0 rounded-lg bg-gray-200 sm:h-40 sm:w-40" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="h-5 w-3/4 rounded bg-gray-200" />
          <div className="h-4 w-1/2 rounded bg-gray-200" />
          <div className="h-4 w-full rounded bg-gray-200" />
          <div className="mt-auto h-4 w-1/3 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

export function UsedPartListSkeleton({ count = 6 }) {
  return (
    <div className="space-y-3" aria-hidden="true">
      {Array.from({ length: count }, (_, index) => (
        <UsedPartListCardSkeleton key={index} />
      ))}
    </div>
  );
}
