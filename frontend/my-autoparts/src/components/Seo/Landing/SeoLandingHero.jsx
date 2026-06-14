import React from 'react';

export default function SeoLandingHero({ h1, statsText, total }) {
  return (
    <header className="mb-6 sm:mb-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight text-gray-900 sm:text-3xl lg:text-4xl">{h1}</h1>
        {total > 0 ? (
          <span className="inline-flex shrink-0 self-start rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 ring-1 ring-indigo-100 sm:text-sm">
            {total} {total === 1 ? 'позиция' : total < 5 ? 'позиции' : 'позиций'}
          </span>
        ) : null}
      </div>
      {statsText ? <p className="mt-2 text-sm text-gray-600 sm:text-base">{statsText}</p> : null}
    </header>
  );
}
