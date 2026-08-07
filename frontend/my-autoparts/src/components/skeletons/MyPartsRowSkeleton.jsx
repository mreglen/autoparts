import React from 'react';

export default function MyPartsRowSkeleton({ renderMode = 'table', withCheckbox = true }) {
  if (renderMode === 'card') {
    return (
      <div className="animate-pulse rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex gap-3">
          <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/2 rounded bg-gray-200" />
            <div className="h-4 w-1/3 rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <tr className="animate-pulse border-b border-gray-100">
      {withCheckbox && (
        <td className="w-12 px-3 py-3 align-middle">
          <div className="h-4 w-4 rounded bg-gray-200" />
        </td>
      )}
      <td className="px-3 py-3 align-middle">
        <div className="flex items-center gap-3">
          <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
            <div className="h-3 w-4/5 rounded bg-gray-100" />
          </div>
        </div>
      </td>
      <td className="w-32 px-3 py-3 align-middle">
        <div className="ml-auto h-4 w-16 rounded bg-gray-200" />
        <div className="ml-auto mt-2 h-3 w-10 rounded bg-gray-100" />
      </td>
      <td className="w-28 px-3 py-3 align-middle text-right">
        <div className="ml-auto h-8 w-8 rounded-lg bg-gray-200" />
      </td>
    </tr>
  );
}

export function MyPartsSkeletonList({ count = 8, renderMode = 'table' }) {
  if (renderMode === 'card') {
    return (
      <div className="space-y-3 md:hidden" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <MyPartsRowSkeleton key={index} renderMode="card" />
        ))}
      </div>
    );
  }

  return (
    <>
      <tbody className="hidden divide-y divide-gray-200 bg-white md:table-row-group" aria-hidden="true">
        {Array.from({ length: count }, (_, index) => (
          <MyPartsRowSkeleton key={index} renderMode="table" />
        ))}
      </tbody>
      <div className="space-y-3 md:hidden" aria-hidden="true">
        {Array.from({ length: Math.min(count, 5) }, (_, index) => (
          <MyPartsRowSkeleton key={index} renderMode="card" />
        ))}
      </div>
    </>
  );
}
