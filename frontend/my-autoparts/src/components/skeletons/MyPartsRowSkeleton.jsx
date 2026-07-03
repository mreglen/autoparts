import React from 'react';

export default function MyPartsRowSkeleton({ renderMode = 'table' }) {
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
    <tr className="animate-pulse">
      <td className="px-4 py-4">
        <div className="h-4 w-4 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-4" colSpan={4}>
        <div className="flex items-center gap-3">
          <div className="h-14 w-14 shrink-0 rounded-lg bg-gray-200" />
          <div className="min-w-0 flex-1 space-y-2">
            <div className="h-4 w-2/3 rounded bg-gray-200" />
            <div className="h-3 w-1/2 rounded bg-gray-200" />
          </div>
        </div>
      </td>
      <td className="px-4 py-4 text-center">
        <div className="mx-auto h-4 w-8 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-4 w-16 rounded bg-gray-200" />
      </td>
      <td className="px-4 py-4">
        <div className="h-8 w-20 rounded bg-gray-200" />
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
